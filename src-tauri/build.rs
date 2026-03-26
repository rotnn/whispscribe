fn main() {
    // Metal GPU acceleration is macOS-only.
    // GGML_METAL and WHISPER_METAL_EMBED_LIBRARY are read by whisper-rs-sys's
    // cmake build. On non-Apple platforms, Foundation.framework does not exist
    // and the cmake build will fail if either variable is set.
    #[cfg(target_os = "macos")]
    {
        println!("cargo:rerun-if-env-changed=WHISPER_METAL_EMBED_LIBRARY");
        unsafe {
            // Tell cmake to enable Metal compute.
            std::env::set_var("GGML_METAL", "1");
            // Embed compiled Metal shaders into the binary so no external
            // .metallib file is needed at runtime.
            std::env::set_var("WHISPER_METAL_EMBED_LIBRARY", "1");
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        unsafe {
            // Explicitly disable Metal and remove any stale env vars that could
            // leak in from the shell or .cargo/config.toml on non-Apple hosts.
            std::env::remove_var("GGML_METAL");
            std::env::remove_var("WHISPER_METAL_EMBED_LIBRARY");
            std::env::set_var("WHISPER_NO_METAL", "1");
        }
    }

    tauri_build::build()
}
