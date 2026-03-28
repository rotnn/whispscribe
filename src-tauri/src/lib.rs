mod hardware;
mod downloader;
mod exporter;
mod whisper;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(whisper::TranscribeAbort(std::sync::Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            hardware::get_ram_gb,
            hardware::get_available_ram_gb,
            downloader::download_model,
            downloader::model_is_cached,
            exporter::export_transcript,
            whisper::transcribe,
            whisper::cancel_transcription,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
