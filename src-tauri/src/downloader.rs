use futures_util::StreamExt;
use reqwest::Client;
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};
use tokio::fs;
use tokio::io::AsyncWriteExt;

// ── Model registry ──────────────────────────────────────────────────────────

fn model_urls() -> HashMap<&'static str, &'static str> {
    HashMap::from([
        ("tiny",     "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin"),
        ("small",    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin"),
        ("medium",   "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin"),
        ("large-v3", "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin"),
    ])
}

// ── Progress event payload ───────────────────────────────────────────────────

#[derive(Clone, Serialize)]
pub struct DownloadProgress {
    pub percent: f64,
    pub downloaded_mb: f64,
    pub total_mb: f64,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|d| d.join("models"))
        .map_err(|e| e.to_string())
}

fn model_path(app: &AppHandle, model_name: &str) -> Result<PathBuf, String> {
    Ok(models_dir(app)?.join(format!("ggml-{}.bin", model_name)))
}

// ── Public command ────────────────────────────────────────────────────────────

/// Returns true if the model binary is already cached locally.
#[tauri::command]
pub async fn model_is_cached(app: AppHandle, model_name: String) -> Result<bool, String> {
    let path = model_path(&app, &model_name)?;
    Ok(path.exists())
}

/// Downloads a Whisper model from Hugging Face if not already cached.
/// Streams "download_progress" events to the frontend as it goes.
#[tauri::command]
pub async fn download_model(app: AppHandle, model_name: String) -> Result<(), String> {
    let urls = model_urls();
    let url = urls
        .get(model_name.as_str())
        .ok_or_else(|| format!("Unknown model: {}", model_name))?;

    let dir = models_dir(&app)?;
    fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("Failed to create models dir: {}", e))?;

    let final_path = model_path(&app, &model_name)?;

    // Already cached — emit 100% and return immediately
    if final_path.exists() {
        let _ = app.emit(
            "download_progress",
            DownloadProgress { percent: 100.0, downloaded_mb: 0.0, total_mb: 0.0 },
        );
        return Ok(());
    }

    // Write to a .tmp file; rename on success so a failed download never
    // leaves a corrupt file that looks like a valid cached model.
    let tmp_path = dir.join(format!("ggml-{}.bin.tmp", model_name));

    let result = download_to_tmp(&app, url, &tmp_path, &final_path).await;

    if result.is_err() {
        // Best-effort cleanup of the partial download
        let _ = fs::remove_file(&tmp_path).await;
    }

    result
}

async fn download_to_tmp(
    app: &AppHandle,
    url: &str,
    tmp_path: &PathBuf,
    final_path: &PathBuf,
) -> Result<(), String> {
    let client = Client::builder()
        .user_agent("WhispScribe/0.1")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Server returned HTTP {}", response.status()));
    }

    let total_bytes = response.content_length().unwrap_or(0);
    let total_mb = total_bytes as f64 / (1024.0 * 1024.0);

    let mut file = fs::File::create(tmp_path)
        .await
        .map_err(|e| format!("Failed to create tmp file: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream error: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Write error: {}", e))?;

        downloaded += chunk.len() as u64;

        let downloaded_mb = downloaded as f64 / (1024.0 * 1024.0);
        let percent = if total_bytes > 0 {
            (downloaded as f64 / total_bytes as f64) * 100.0
        } else {
            0.0
        };

        // Non-fatal if the frontend window has closed mid-download
        let _ = app.emit(
            "download_progress",
            DownloadProgress { percent, downloaded_mb, total_mb },
        );
    }

    // Flush and rename atomically
    file.flush().await.map_err(|e| e.to_string())?;
    drop(file);

    fs::rename(tmp_path, final_path)
        .await
        .map_err(|e| format!("Failed to finalise model file: {}", e))?;

    Ok(())
}
