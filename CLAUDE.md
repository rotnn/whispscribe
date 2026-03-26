# WhispScribe — project briefing for Claude Code

## what this app is

WhispScribe is a free, open source, cross-platform desktop app that wraps OpenAI's Whisper model for local, offline audio/video transcription. No cloud, no API key, no sending data anywhere. User drops a file, picks a model, hits transcribe, gets a transcript exported in their chosen format.

Think of it as a clean, native-feeling desktop app that makes Whisper accessible to non-technical users. Built by a solo developer, published on GitHub as a free alternative to paid apps like MacWhisper.

---

## app name

- **Display name**: WhispScribe
- **Bundle ID**: com.whispscribe.app
- **GitHub repo name**: whispscribe
- **Folder name**: whisper-drop (current local folder, rename when publishing to GitHub)

---

## stack

- **Framework**: Tauri 2.0 (NOT Electron — smaller bundle, faster, Rust backend)
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Rust (via Tauri commands)
- **Transcription engine**: whisper.cpp (called from Rust backend)
- **Target platforms**: macOS (.app) + Windows (.exe) from one codebase
- **Build/deploy**: GitHub Actions for cross-platform builds

---

## core features

### 1. drag and drop file input
- Accepts: mp4, mov, mp3, wav, m4a, webm
- Shows file name and size after drop
- Click to browse as fallback

### 2. model download on first launch (Option B)
- App does NOT bundle model files — too large
- On first launch, detect RAM and recommend a model
- Show a clean download screen: "Downloading large-v3 (3GB)..."
- Save models to: ~/Library/Application Support/whispscribe/models/
- Cache models locally — never download twice
- User can download additional models from settings

### 3. model selector
- Options: tiny (75mb), small (465mb), medium (1.5gb), large-v3 (3gb)
- Hardware auto-detection — reads system RAM and recommends best model:
  - 8gb ram → small
  - 16gb ram → large-v3
  - 24gb+ ram → large-v3
- User can override the recommendation manually
- Show model size and speed descriptor under each option

### 3. settings panel
- Language: auto detect (default), english, spanish, french, japanese, + others
- Timestamps: per sentence, per word, none
- Translate to english: on/off toggle

### 4. export format selector
- Formats: .txt, .srt, .vtt, .json, .csv, .md
- Multiple formats can be selected simultaneously
- Custom save location picker (defaults to ~/Desktop/transcripts/)

### 5. transcript output panel
- Progress bar with status labels (loading model, processing audio, transcribing segment x/y, finalizing)
- Transcript renders in a monospace text box as it completes
- Copy to clipboard button
- Export button triggers save to chosen formats/location

---

## project structure

```
whisper-drop/                         ← local folder (rename to whispscribe for GitHub)
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── DropZone.tsx
│   │   ├── ModelSelector.tsx
│   │   ├── Settings.tsx
│   │   ├── ExportOptions.tsx
│   │   └── TranscriptOutput.tsx
│   └── utils/
│       └── detectModel.ts        ← hardware detection + model recommendation
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── whisper.rs            ← calls whisper.cpp, handles transcription
│   │   └── hardware.rs           ← reads system RAM, returns model recommendation
│   └── tauri.conf.json
├── CLAUDE.md                     ← this file
└── package.json
```

---

## hardware detection logic (detectModel.ts)

```ts
// reads RAM from Tauri backend and returns recommended model
export function recommendModel(ramGb: number): string {
  if (ramGb >= 24) return 'large-v3';
  if (ramGb >= 16) return 'large-v3';
  if (ramGb >= 8)  return 'small';
  return 'tiny';
}
```

---

## developer context

- App display name: WhispScribe
- Primary dev and test machine is Apple Silicon Mac
- App should run and feel native on macOS first, Windows second
- Cross-platform build via GitHub Actions (dev builds .app locally, CI produces .exe)
- whisper.cpp should be bundled as a binary inside the app — users should not need to install anything
- Target audience: non-technical users who want local transcription without terminal
- This is a free, open source project published on GitHub as whispscribe

---

## design direction

- Clean, minimal, dark/light mode compatible
- Native macOS window controls only — no fake traffic light dots inside the app
- No gradients, no heavy shadows — flat and native-feeling
- SF Pro font stack: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif
- Frosted glass background with backdrop-filter blur
- Smooth 200ms transitions on all interactive elements
- Monospace font for transcript output
- Progress bar is 4px height, subtle
- Model cards use a selected state with info-color border
- Everything fits in one screen — no scrolling, compact macOS utility app feel

---

## whisper.cpp integration notes

- Use whisper.cpp C bindings called from Rust via FFI or subprocess
- Bundle whisper.cpp as a static binary inside the Tauri app resources
- Model files (.bin) downloaded on first run per model size, cached locally at:
  ~/Library/Application Support/whispscribe/models/
- Models are never re-downloaded if already cached
- Progress updates streamed back to frontend via Tauri events (not blocking)

---

## commands to know

```bash
# dev server
npm run tauri dev

# build for macOS
npm run tauri build

# build for specific target
cargo tauri build --target aarch64-apple-darwin   # mac
cargo tauri build --target x86_64-pc-windows-gnu  # windows
```

---

## current status

Project scaffold is created and running. All React components are built:
- DropZone.tsx ✓
- ModelSelector.tsx ✓
- Settings.tsx ✓
- ExportOptions.tsx ✓
- TranscriptOutput.tsx ✓
- detectModel.ts ✓
- App.tsx wired up ✓
- App.css with macOS design system ✓

Next steps in order:
1. Rename app display name to WhispScribe in tauri.conf.json
2. Build Rust hardware.rs — read system RAM, expose as Tauri command
3. Build Rust whisper.rs — model download on first launch + transcription
4. Wire frontend to Rust commands via invoke()
5. Test full transcription flow end to end
6. Set up GitHub repo named whispscribe
7. Set up GitHub Actions for Windows .exe build
8. Write README.md for GitHub
