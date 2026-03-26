# WhispScribe

A free, open source desktop app for local audio and video transcription. Powered by OpenAI Whisper. No cloud, no subscription, no data leaving your machine.

## Features

* Drag and drop audio and video files in mp4, mov, mp3, wav, m4a, and webm formats
* Local transcription with no data sent anywhere
* Automatic hardware detection that recommends the best Whisper model for your available RAM
* GPU accelerated on Apple Silicon via Metal
* Export to .txt, .srt, .vtt, .json, .csv, and .md
* 99 language support
* Works on macOS and Windows

## Download

Releases will be available on the [GitHub releases page](../../releases).

## Supported Models

| Model    | Size   | RAM Required | Speed        |
|----------|--------|--------------|--------------|
| Tiny     | 75 MB  | 1 GB         | Fastest      |
| Small    | 465 MB | 1.5 GB       | Fast         |
| Medium   | 1.5 GB | 2.5 GB       | Accurate     |
| Large v3 | 3 GB   | 5 GB         | Best quality |

Models are downloaded on first launch and cached locally. They are never bundled in the app itself.

## Building from Source

**Requirements:** Node.js 18+, Rust, Cargo

```bash
git clone https://github.com/yourusername/whispscribe
cd whispscribe
npm install
npm run tauri dev
```

> **Note:** ffmpeg binaries are not included in the repository due to their size. Download them separately before building and see [src-tauri/resources/README.md](src-tauri/resources/README.md) for instructions.

## License

MIT
