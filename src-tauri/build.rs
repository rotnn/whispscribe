fn main() {
    // On macOS, tell whisper-rs-sys to embed the Metal library into the binary.
    // This is belt-and-suspenders alongside the [env] entry in .cargo/config.toml;
    // both are needed because cargo's env injection order can vary.
    #[cfg(target_os = "macos")]
    {
        println!("cargo:rerun-if-env-changed=WHISPER_METAL_EMBED_LIBRARY");
        // Set for any sub-invocations that run within this build process
        unsafe { std::env::set_var("WHISPER_METAL_EMBED_LIBRARY", "1"); }
    }

    tauri_build::build()
}
