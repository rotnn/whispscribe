# src-tauri/resources

This directory holds platform-specific ffmpeg static binaries that are bundled
inside the WhispScribe app so users never need to install ffmpeg themselves.

The binaries are excluded from git (via `.gitignore`) because of their size.
**Every developer must download them locally before building.**

## Required files

| File | Platform | Size |
|------|----------|------|
| `ffmpeg-macos-aarch64` | macOS Apple Silicon | ~77 MB |
| `ffmpeg-windows-x86_64.exe` | Windows x64 | ~193 MB |

## Download commands

### macOS Apple Silicon binary
```bash
curl -L "https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip" -o /tmp/ffmpeg-mac.zip
unzip -p /tmp/ffmpeg-mac.zip ffmpeg > src-tauri/resources/ffmpeg-macos-aarch64
chmod +x src-tauri/resources/ffmpeg-macos-aarch64
```

### Windows x64 binary
```bash
curl -L "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip" \
  -o /tmp/ffmpeg-win.zip
unzip -p /tmp/ffmpeg-win.zip "ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe" \
  > src-tauri/resources/ffmpeg-windows-x86_64.exe
```

## How it works

`whisper.rs` calls `get_bundled_ffmpeg_path()` before transcribing. It looks for
the binary in Tauri's `resource_dir()`, which resolves to:

- **dev** (`tauri dev`): `src-tauri/` (Tauri copies resources here automatically)
- **production**: inside the app bundle's `Contents/Resources/` (macOS) or next
  to the `.exe` (Windows)

If the bundled binary isn't found it falls back to any system `ffmpeg` on PATH,
then to Homebrew install locations. The fallback is primarily useful during
development on Linux or Intel Macs.
