use std::path::{Path, PathBuf};

// ── Public Tauri command ──────────────────────────────────────────────────────

/// Write a transcript to disk in one or more formats.
///
/// * `transcript`  – raw transcript text from `whisper::transcribe`
/// * `formats`     – e.g. `[".txt", ".srt"]`
/// * `save_path`   – destination directory, may start with `~/`
/// * `file_name`   – original audio file name (used to build the output stem)
///
/// Returns the list of absolute paths that were written.
#[tauri::command]
pub fn export_transcript(
    transcript: String,
    formats: Vec<String>,
    save_path: String,
    file_name: String,
) -> Result<Vec<String>, String> {
    let dir = expand_tilde(&save_path);
    let dir = Path::new(&dir);

    std::fs::create_dir_all(dir)
        .map_err(|e| format!("Cannot create '{}': {e}", dir.display()))?;

    // Build output stem: original-name_YYYYMMDD_HHMMSS
    let base = Path::new(&file_name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("transcript");
    let stem = format!("{}_{}", base, current_timestamp());

    let segments = parse_segments(&transcript);

    let mut written: Vec<String> = Vec::new();

    for fmt in &formats {
        let ext = fmt.trim_start_matches('.');
        let path: PathBuf = dir.join(format!("{stem}.{ext}"));

        let content = match ext {
            "txt"  => transcript.clone(),
            "srt"  => to_srt(&segments),
            "vtt"  => to_vtt(&segments),
            "json" => to_json(&segments, &transcript, base),
            "csv"  => to_csv(&segments),
            "md"   => to_md(&transcript, base),
            other  => return Err(format!("Unsupported format: .{other}")),
        };

        std::fs::write(&path, &content)
            .map_err(|e| format!("Cannot write '{}': {e}", path.display()))?;

        written.push(path.to_string_lossy().into_owned());
    }

    Ok(written)
}

// ── Segment model ─────────────────────────────────────────────────────────────

struct Segment {
    start_secs: u64,
    end_secs:   u64,
    text:       String,
}

/// Parse lines of the form `[HH:MM:SS] text` produced by whisper.rs.
/// Falls back to a single whole-transcript segment when no timestamps exist.
fn parse_segments(transcript: &str) -> Vec<Segment> {
    let mut raw: Vec<(u64, String)> = Vec::new(); // (start_secs, text)

    for line in transcript.lines() {
        let line = line.trim();
        if line.is_empty() { continue; }

        if line.starts_with('[') {
            if let Some(close) = line.find(']') {
                let ts_str = &line[1..close];
                if let Some(secs) = parse_hms(ts_str) {
                    let text = line[close + 1..].trim().to_string();
                    if !text.is_empty() {
                        raw.push((secs, text));
                        continue;
                    }
                }
            }
        }
        // No timestamp — treat as continuation of last segment or start a new one
        if let Some(last) = raw.last_mut() {
            last.1.push(' ');
            last.1.push_str(line);
        } else {
            raw.push((0, line.to_string()));
        }
    }

    if raw.is_empty() {
        // No parseable content at all
        if transcript.trim().is_empty() {
            return vec![];
        }
        return vec![Segment {
            start_secs: 0,
            end_secs:   5,
            text:       transcript.trim().to_string(),
        }];
    }

    raw.iter()
        .enumerate()
        .map(|(i, (start, text))| {
            let end = raw
                .get(i + 1)
                .map(|(s, _)| *s)
                .unwrap_or(*start + 5); // 5-second default for final segment
            Segment {
                start_secs: *start,
                end_secs:   end,
                text:       text.clone(),
            }
        })
        .collect()
}

// ── Format writers ────────────────────────────────────────────────────────────

fn to_srt(segments: &[Segment]) -> String {
    if segments.is_empty() { return String::new(); }
    segments
        .iter()
        .enumerate()
        .map(|(i, s)| {
            format!(
                "{}\n{} --> {}\n{}\n",
                i + 1,
                fmt_srt_ts(s.start_secs),
                fmt_srt_ts(s.end_secs),
                s.text.trim(),
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn to_vtt(segments: &[Segment]) -> String {
    if segments.is_empty() { return "WEBVTT\n".to_string(); }
    let body: String = segments
        .iter()
        .map(|s| {
            format!(
                "{} --> {}\n{}\n",
                fmt_vtt_ts(s.start_secs),
                fmt_vtt_ts(s.end_secs),
                s.text.trim(),
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    format!("WEBVTT\n\n{body}")
}

fn to_json(segments: &[Segment], transcript: &str, source: &str) -> String {
    use serde_json::{json, to_string_pretty};

    let segs: Vec<_> = segments
        .iter()
        .enumerate()
        .map(|(i, s)| {
            json!({
                "index": i,
                "start": fmt_hms_str(s.start_secs),
                "end":   fmt_hms_str(s.end_secs),
                "text":  s.text.trim(),
            })
        })
        .collect();

    let obj = json!({
        "source":     source,
        "transcript": transcript.trim(),
        "segments":   segs,
    });

    to_string_pretty(&obj).unwrap_or_default()
}

fn to_csv(segments: &[Segment]) -> String {
    let mut out = String::from("start,end,text\n");
    for s in segments {
        // Quote text field; escape any embedded quotes
        let escaped = s.text.trim().replace('"', "\"\"");
        out.push_str(&format!(
            "{},{},\"{}\"\n",
            fmt_hms_str(s.start_secs),
            fmt_hms_str(s.end_secs),
            escaped,
        ));
    }
    out
}

fn to_md(transcript: &str, title: &str) -> String {
    format!("# {title}\n\n{}\n", transcript.trim())
}

// ── Timestamp helpers ─────────────────────────────────────────────────────────

/// Parse `HH:MM:SS` → total seconds.
fn parse_hms(s: &str) -> Option<u64> {
    let mut parts = s.splitn(3, ':');
    let h: u64 = parts.next()?.parse().ok()?;
    let m: u64 = parts.next()?.parse().ok()?;
    let sec: u64 = parts.next()?.parse().ok()?;
    Some(h * 3600 + m * 60 + sec)
}

/// Seconds → `HH:MM:SS` string.
fn fmt_hms_str(secs: u64) -> String {
    format!("{:02}:{:02}:{:02}", secs / 3600, (secs % 3600) / 60, secs % 60)
}

/// Seconds → SRT timestamp `HH:MM:SS,000`.
fn fmt_srt_ts(secs: u64) -> String {
    format!("{},000", fmt_hms_str(secs))
}

/// Seconds → VTT timestamp `HH:MM:SS.000`.
fn fmt_vtt_ts(secs: u64) -> String {
    format!("{}.000", fmt_hms_str(secs))
}

// ── Path / time utilities ─────────────────────────────────────────────────────

fn expand_tilde(path: &str) -> String {
    let home = || {
        std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .unwrap_or_default()
    };

    if path.starts_with("~/") {
        let h = home();
        if h.is_empty() { return path.to_string(); }
        // Use Path::join so the separator is correct on every platform
        return std::path::Path::new(&h)
            .join(&path[2..])
            .to_string_lossy()
            .into_owned();
    }
    if path == "~" {
        let h = home();
        if !h.is_empty() { return h; }
    }
    path.to_string()
}

/// Returns a `YYYYMMDD_HHMMSS` string without any external crates.
fn current_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let ss  = (secs % 60) as u32;
    let mm  = ((secs / 60) % 60) as u32;
    let hh  = ((secs / 3600) % 24) as u32;
    let days = secs / 86400;
    let (y, mo, d) = epoch_days_to_ymd(days);
    format!("{y:04}{mo:02}{d:02}_{hh:02}{mm:02}{ss:02}")
}

fn epoch_days_to_ymd(mut days: u64) -> (u32, u32, u32) {
    let mut year = 1970u32;
    loop {
        let in_year: u64 = if is_leap(year) { 366 } else { 365 };
        if days < in_year { break; }
        days -= in_year;
        year += 1;
    }
    let month_lens: [u64; 12] = if is_leap(year) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    let mut month = 1u32;
    for &ml in &month_lens {
        if days < ml { break; }
        days -= ml;
        month += 1;
    }
    (year, month, days as u32 + 1)
}

fn is_leap(y: u32) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}
