fn main() {
    // Metal GPU acceleration is macOS-only. These env vars are read by
    // whisper-rs-sys's cmake build when it compiles whisper.cpp.
    #[cfg(target_os = "macos")]
    {
        println!("cargo:rerun-if-env-changed=WHISPER_METAL_EMBED_LIBRARY");
        // Embed compiled Metal shaders into the binary so no external
        // .metallib file is needed at runtime.
        unsafe { std::env::set_var("WHISPER_METAL_EMBED_LIBRARY", "1"); }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Foundation.framework does not exist on Windows or Linux.
        // Ensure Metal is fully disabled so cmake does not search for it.
        unsafe { std::env::remove_var("WHISPER_METAL_EMBED_LIBRARY"); }
        unsafe { std::env::set_var("WHISPER_NO_METAL", "1"); }
    }

    tauri_build::build()
}
