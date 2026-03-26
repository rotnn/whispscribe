use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

// ── Progress event ────────────────────────────────────────────────────────────

#[derive(Clone, Serialize)]
pub struct TranscribeProgress {
    pub percent: f64,
    pub status: String,
}

fn emit(app: &AppHandle, percent: f64, status: &str) {
    let _ = app.emit(
        "transcribe_progress",
        TranscribeProgress { percent, status: status.to_string() },
    );
}

// ── Model path ────────────────────────────────────────────────────────────────

fn model_path(app: &AppHandle, model_name: &str) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|d| d.join("models").join(format!("ggml-{}.bin", model_name)))
        .map_err(|e| e.to_string())
}

// ── Audio decode → 16 kHz mono f32 ───────────────────────────────────────────

/// Top-level entry point. Tries symphonia first; falls back to ffmpeg if the
/// format is unsupported (e.g. H.264/AAC in MP4, HEVC in MOV, VP9 in WebM).
///
/// `bundled_ffmpeg` is the path to the binary shipped inside the app bundle,
/// resolved before entering `spawn_blocking` where AppHandle isn't available.
fn decode_audio(file_path: &str, bundled_ffmpeg: Option<PathBuf>) -> Result<Vec<f32>, String> {
    match decode_with_symphonia(file_path) {
        Ok(samples) => Ok(samples),
        Err(_) => decode_with_ffmpeg(file_path, bundled_ffmpeg),
    }
}

/// Decode using symphonia (pure-Rust, no external tool required).
/// Works for: MP3, WAV, FLAC, OGG/Vorbis, AIFF, and some MP4/M4A (ALAC/AAC).
fn decode_with_symphonia(file_path: &str) -> Result<Vec<f32>, String> {
    use symphonia::core::audio::SampleBuffer;
    use symphonia::core::codecs::{DecoderOptions, CODEC_TYPE_NULL};
    use symphonia::core::errors::Error as SError;
    use symphonia::core::formats::FormatOptions;
    use symphonia::core::io::MediaSourceStream;
    use symphonia::core::meta::MetadataOptions;
    use symphonia::core::probe::Hint;

    const TARGET_HZ: u32 = 16_000;

    let file = std::fs::File::open(file_path)
        .map_err(|e| format!("Cannot open file: {e}"))?;

    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = std::path::Path::new(file_path)
        .extension()
        .and_then(|s| s.to_str())
    {
        hint.with_extension(ext);
    }

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())
        .map_err(|e| format!("Unsupported format: {e}"))?;

    let mut fmt = probed.format;

    let track = fmt
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
        .ok_or("No audio track found")?;

    let tid = track.id;
    let sample_rate = track.codec_params.sample_rate.unwrap_or(44_100);
    let channels = track.codec_params.channels.map(|c| c.count()).unwrap_or(1);

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| format!("Codec error: {e}"))?;

    let mut interleaved: Vec<f32> = Vec::new();

    loop {
        let packet = match fmt.next_packet() {
            Ok(p) => p,
            Err(SError::IoError(e)) if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(SError::ResetRequired) => {
                decoder.reset();
                continue;
            }
            Err(e) => return Err(format!("Packet error: {e}")),
        };

        if packet.track_id() != tid {
            continue;
        }

        let decoded = match decoder.decode(&packet) {
            Ok(d) => d,
            Err(SError::IoError(_)) | Err(SError::DecodeError(_)) => continue,
            Err(e) => return Err(format!("Decode error: {e}")),
        };

        let spec = *decoded.spec();
        let cap = decoded.capacity() as u64;
        let mut sb = SampleBuffer::<f32>::new(cap, spec);
        sb.copy_interleaved_ref(decoded);
        interleaved.extend_from_slice(sb.samples());
    }

    if interleaved.is_empty() {
        return Err("Decoded zero samples".into());
    }

    // Mix to mono
    let mono: Vec<f32> = if channels <= 1 {
        interleaved
    } else {
        interleaved
            .chunks_exact(channels)
            .map(|c| c.iter().sum::<f32>() / channels as f32)
            .collect()
    };

    if sample_rate == TARGET_HZ {
        return Ok(mono);
    }

    resample(mono, sample_rate, TARGET_HZ)
}

/// Decode using ffmpeg as a subprocess — handles any format ffmpeg supports
/// (H.264/MP4, HEVC/MOV, VP9/WebM, AC3, etc.).
///
/// Converts to a temporary 16 kHz mono WAV, decodes it with symphonia, then
/// deletes the temp file.
fn decode_with_ffmpeg(file_path: &str, bundled_ffmpeg: Option<PathBuf>) -> Result<Vec<f32>, String> {
    use std::process::Command;

    let ffmpeg = find_ffmpeg(bundled_ffmpeg).ok_or_else(|| {
        "ffmpeg not found. Install it with: brew install ffmpeg\n\
         ffmpeg is required to decode MP4, MOV, and WebM files.".to_string()
    })?;

    // Write to a temp file alongside the source so we stay on the same volume
    let tmp_path = format!("{}.whispscribe_tmp.wav", file_path);

    let status = Command::new(&ffmpeg)
        .args([
            "-y",               // overwrite without asking
            "-i", file_path,    // input
            "-ar", "16000",     // output sample rate: 16 kHz
            "-ac", "1",         // output channels: mono
            "-f", "wav",        // output format: WAV
            &tmp_path,          // output path
        ])
        .status()
        .map_err(|e| format!("Failed to launch ffmpeg: {e}"))?;

    if !status.success() {
        let _ = std::fs::remove_file(&tmp_path);
        return Err(format!(
            "ffmpeg exited with status {}. Is the file a valid audio/video file?",
            status
        ));
    }

    // Decode the WAV with symphonia — guaranteed to work since we just wrote it
    let result = decode_with_symphonia(&tmp_path);
    let _ = std::fs::remove_file(&tmp_path); // always clean up
    result.map_err(|e| format!("Failed to decode ffmpeg output: {e}"))
}

/// Resolve ffmpeg to use. Priority order:
///   1. Bundled binary shipped inside the app bundle (always preferred)
///   2. System PATH (`which ffmpeg` on Unix, `where ffmpeg` on Windows)
///   3. Hard-coded Homebrew / common install locations
///
/// On Unix, ensures the chosen binary has its executable bit set before
/// returning it (the Tauri bundler may strip permissions on copy).
fn find_ffmpeg(bundled: Option<PathBuf>) -> Option<PathBuf> {
    // ── 1. Bundled binary ────────────────────────────────────────────────────
    if let Some(path) = bundled {
        if path.exists() {
            ensure_executable(&path);
            return Some(path);
        }
    }

    // ── 2. System PATH ───────────────────────────────────────────────────────
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(out) = std::process::Command::new("which").arg("ffmpeg").output() {
            if out.status.success() {
                let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !s.is_empty() {
                    return Some(PathBuf::from(s));
                }
            }
        }
    }
    #[cfg(target_os = "windows")]
    {
        if let Ok(out) = std::process::Command::new("where").arg("ffmpeg").output() {
            if out.status.success() {
                let s = String::from_utf8_lossy(&out.stdout)
                    .lines()
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_string();
                if !s.is_empty() {
                    return Some(PathBuf::from(s));
                }
            }
        }
    }

    // ── 3. Well-known install locations ─────────────────────────────────────
    let candidates: &[&str] = &[
        "/opt/homebrew/bin/ffmpeg", // Apple Silicon Homebrew
        "/usr/local/bin/ffmpeg",    // Intel Homebrew
        "/usr/bin/ffmpeg",          // Linux system package
    ];

    for &p in candidates {
        if std::path::Path::new(p).exists() {
            return Some(PathBuf::from(p));
        }
    }

    None
}

/// Adds the executable bit on Unix platforms. No-op on Windows.
fn ensure_executable(path: &std::path::Path) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = std::fs::metadata(path) {
            let mut perms = meta.permissions();
            let mode = perms.mode();
            if mode & 0o111 == 0 {
                perms.set_mode(mode | 0o755);
                let _ = std::fs::set_permissions(path, perms);
            }
        }
    }
    #[cfg(not(unix))]
    let _ = path;
}

// ── Bundled binary path (resolved before spawn_blocking) ─────────────────────

/// Returns the expected name of the platform-specific bundled ffmpeg binary,
/// or `None` on unsupported platforms.
fn bundled_ffmpeg_name() -> Option<&'static str> {
    if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        Some("ffmpeg-macos-aarch64")
    } else if cfg!(all(target_os = "macos", target_arch = "x86_64")) {
        Some("ffmpeg-macos-x86_64") // if a universal/x64 build is added later
    } else if cfg!(target_os = "windows") {
        Some("ffmpeg-windows-x86_64.exe")
    } else {
        None
    }
}

/// Resolves the bundled ffmpeg binary using Tauri's resource directory.
///
/// Tauri places resources at `{resource_dir}/{destination}` where `destination`
/// is the key used in `tauri.conf.json > bundle > resources`.
///
/// In dev mode (`tauri dev`) the resource_dir typically resolves to the
/// `src-tauri/` folder, so the binary lives at `src-tauri/{name}` — Tauri
/// copies it there from `src-tauri/resources/{name}` automatically.
pub fn get_bundled_ffmpeg_path(app: &AppHandle) -> Option<PathBuf> {
    let name = bundled_ffmpeg_name()?;
    let resource_dir = app.path().resource_dir().ok()?;

    // Tauri 2 with object-form resources places the file directly in resource_dir
    let direct = resource_dir.join(name);
    if direct.exists() {
        return Some(direct);
    }

    // Fallback: array-form resources preserve the subdirectory
    let subdir = resource_dir.join("resources").join(name);
    if subdir.exists() { Some(subdir) } else { None }
}

fn resample(samples: Vec<f32>, from_hz: u32, to_hz: u32) -> Result<Vec<f32>, String> {
    use rubato::{
        Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType,
        WindowFunction,
    };

    let ratio = to_hz as f64 / from_hz as f64;
    let sinc_params = SincInterpolationParameters {
        sinc_len: 256,
        f_cutoff: 0.95,
        interpolation: SincInterpolationType::Linear,
        oversampling_factor: 256,
        window: WindowFunction::BlackmanHarris2,
    };

    let chunk_size = samples.len();
    let mut resampler = SincFixedIn::<f32>::new(ratio, 2.0, sinc_params, chunk_size, 1)
        .map_err(|e| format!("Resampler init: {e}"))?;

    let resampled = resampler
        .process(&[&samples], None)
        .map_err(|e| format!("Resample error: {e}"))?;

    Ok(resampled.into_iter().next().unwrap_or_default())
}

// ── Pre-flight memory guard ───────────────────────────────────────────────────

/// Minimum available system RAM (bytes) each model needs to run without OOM.
/// These are conservative estimates: model weights + KV cache + audio buffer.
///   tiny     ~500 MB model  → need ~1 GB free
///   small    ~500 MB model  → need ~2 GB free
///   medium   ~1.5 GB model  → need ~4 GB free
///   large-v3 ~3.0 GB model  → need ~6 GB free
fn model_min_available_ram(model: &str) -> u64 {
    const GB: u64 = 1024 * 1024 * 1024;
    match model {
        "tiny"     => (1.0 * GB as f64) as u64,  // 75 MB weights  → ~1.0 GB needed
        "small"    => (1.5 * GB as f64) as u64,  // 465 MB weights → ~1.5 GB needed
        "medium"   => (2.5 * GB as f64) as u64,  // 1.5 GB weights → ~2.5 GB needed
        "large-v3" => (5.0 * GB as f64) as u64,  // 3.0 GB weights → ~5.0 GB needed
        _          => (2.5 * GB as f64) as u64,
    }
}

/// Returns an error if the system doesn't appear to have enough free RAM to
/// run the requested model safely.
///
/// Uses `hardware::available_memory_bytes()` which on macOS reads vm_stat
/// (free + inactive + speculative pages) — the same value Activity Monitor
/// shows — rather than sysinfo's `available_memory()` which only counts
/// "free" pages and typically reads near 0 on a busy macOS machine.
fn check_ram_for_model(model: &str) -> Result<(), String> {
    let available = crate::hardware::available_memory_bytes();
    let available_gb = available as f64 / (1024.0_f64.powi(3));
    let required = model_min_available_ram(model);

    if available < required {
        let suggestion = match model {
            "large-v3" => "medium or small",
            "medium"   => "small or tiny",
            _          => "tiny",
        };
        return Err(format!(
            "Not enough memory to run the {model} model safely.\n\
             Available: {available_gb:.1} GB  \
             Required: {:.1} GB\n\
             Switch to the {suggestion} model in the model selector.",
            required as f64 / (1024.0_f64.powi(3))
        ));
    }

    Ok(())
}

// ── Timestamp formatting ──────────────────────────────────────────────────────

/// Whisper timestamps are in centiseconds (hundredths of a second).
fn fmt_ts(cs: i64) -> String {
    let total_s = cs / 100;
    let h = total_s / 3600;
    let m = (total_s % 3600) / 60;
    let s = total_s % 60;
    format!("{h:02}:{m:02}:{s:02}")
}

// ── Tauri command ─────────────────────────────────────────────────────────────

/// Transcribe an audio/video file using the selected Whisper model.
/// Streams `transcribe_progress` events `{ percent: f64, status: String }`.
#[tauri::command]
pub async fn transcribe(
    app: AppHandle,
    file_path: String,
    model: String,
    language: String,
    timestamps: String,
    translate: bool,
) -> Result<String, String> {
    let model_bin = model_path(&app, &model)?;
    let model_bin_str = model_bin.to_string_lossy().to_string();

    if !model_bin.exists() {
        return Err(format!("Model file not found at: {model_bin_str}"));
    }

    // Resolve the bundled ffmpeg path now, while we still have AppHandle.
    // AppHandle can't be sent into spawn_blocking directly.
    let bundled_ffmpeg = get_bundled_ffmpeg_path(&app);

    emit(&app, 5.0, "Loading model…");

    // All whisper work is CPU-bound and blocking — run on a thread-pool thread.
    let result = tokio::task::spawn_blocking({
        let app = app.clone();

        move || -> Result<String, String> {
            // ── Pre-flight RAM check — must run BEFORE loading the model ─────
            // WhisperContext::new_with_params() maps the model weights into RAM,
            // so checking after that call always sees inflated usage and false-
            // fails. Check here while memory is still at its pre-load baseline.
            check_ram_for_model(&model)?;

            emit(&app, 10.0, "Loading model…");

            // On macOS, attempt Metal GPU acceleration first.
            // If the Metal runtime isn't available (e.g. CI, VM), fall back to CPU.
            #[cfg(target_os = "macos")]
            let ctx = {
                let mut gpu_params = WhisperContextParameters::default();
                gpu_params.use_gpu = true;
                gpu_params.flash_attn = true;
                match WhisperContext::new_with_params(&model_bin_str, gpu_params) {
                    Ok(c) => c,
                    Err(_) => WhisperContext::new_with_params(
                        &model_bin_str,
                        WhisperContextParameters::default(),
                    )
                    .map_err(|e| format!("Failed to load model: {e}"))?,
                }
            };

            #[cfg(not(target_os = "macos"))]
            let ctx = WhisperContext::new_with_params(
                &model_bin_str,
                WhisperContextParameters::default(),
            )
            .map_err(|e| format!("Failed to load model: {e}"))?;

            emit(&app, 22.0, "Decoding audio…");

            let samples = decode_audio(&file_path, bundled_ffmpeg)?;

            if samples.is_empty() {
                return Err("Audio is empty after decoding".into());
            }

            emit(&app, 40.0, "Transcribing…");

            let mut state = ctx.create_state().map_err(|e| e.to_string())?;

            // ── Memory-conservative params ───────────────────────────────────
            // Greedy (best_of=1) uses far less memory than beam search.
            let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });

            // Keep thread count modest — too many threads thrash the cache and
            // each thread allocates its own KV-cache slice.
            params.set_n_threads(4);

            // Don't carry context between segments — saves a full KV-cache copy
            // between chunks and is the biggest single memory saving.
            params.set_no_context(true);

            params.set_print_special(false);
            params.set_print_progress(false);
            params.set_print_realtime(false);
            params.set_print_timestamps(false);

            // Language — pass None for auto-detect, string for explicit
            if language != "auto" {
                params.set_language(Some(&language));
            }

            if translate {
                params.set_translate(true);
            }

            if timestamps == "word" {
                params.set_token_timestamps(true);
            }

            // NOTE: set_progress_callback_safe is intentionally omitted.
            // On Apple Silicon with whisper-rs 0.13 the callback trampoline
            // tries to re-lock a mutex already held by the whisper.cpp thread,
            // causing "failed to lock mutex: Invalid argument (os error 22)".
            // We emit coarse progress milestones around state.full() instead.

            // ── Run inference — catch panics so OOM doesn't kill the process ─
            let full_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                state.full(params, &samples)
            }));

            match full_result {
                Ok(Ok(_)) => {}
                Ok(Err(e)) => return Err(format!("Transcription error: {e}")),
                Err(panic_val) => {
                    let detail = if let Some(s) = panic_val.downcast_ref::<String>() {
                        s.clone()
                    } else if let Some(s) = panic_val.downcast_ref::<&str>() {
                        s.to_string()
                    } else {
                        "unknown panic payload".into()
                    };
                    return Err(format!(
                        "Whisper crashed during inference (likely out of memory): {detail}\n\
                         Try switching to the Small or Medium model."
                    ));
                }
            }

            emit(&app, 92.0, "Formatting output…");

            let n = state.full_n_segments().map_err(|e| e.to_string())?;
            let mut output = String::new();

            for i in 0..n {
                let text = state
                    .full_get_segment_text(i)
                    .map_err(|e| e.to_string())?
                    .trim()
                    .to_string();

                if text.is_empty() {
                    continue;
                }

                match timestamps.as_str() {
                    "none" => {
                        output.push_str(&text);
                        output.push('\n');
                    }
                    _ => {
                        let t0 = state
                            .full_get_segment_t0(i)
                            .map_err(|e| e.to_string())?;
                        output.push_str(&format!("[{}] {}\n", fmt_ts(t0), text));
                    }
                }
            }

            Ok(output)
        }
    })
    .await
    .map_err(|e| format!("Thread join error: {e}"))??;

    emit(&app, 100.0, "Done");
    Ok(result)
}
