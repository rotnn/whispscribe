import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import './App.css';
import DropZone from './components/DropZone';
import ModelSelector from './components/ModelSelector';
import Settings from './components/Settings';
import ExportOptions from './components/ExportOptions';
import TranscriptOutput from './components/TranscriptOutput';
import Onboarding from './components/Onboarding';
import { recommendModel } from './utils/detectModel';

const ALL_MODELS = ['tiny', 'small', 'medium', 'large-v3'];

export default function App() {
  // Onboarding — show once, then store in localStorage
  const [showOnboarding, setShowOnboarding] = useState<boolean>(
    () => !localStorage.getItem('whispscribe_onboarded')
  );

  function handleOnboardingComplete(model: string) {
    setSelectedModel(model);
    setShowOnboarding(false);
    // Mark the just-downloaded model as cached immediately
    setCachedModels((prev) => ({ ...prev, [model]: true }));
  }

  // File
  const [filePath, setFilePath] = useState<string>('');

  // Model — seed from localStorage if the user has already onboarded
  const [ramGb, setRamGb] = useState<number | null>(null);
  const [availableRamGb, setAvailableRamGb] = useState<number | null>(null);
  const recommendedModel = recommendModel(ramGb ?? 8);
  const [selectedModel, setSelectedModel] = useState<string>(
    () => localStorage.getItem('whispscribe_default_model') ?? ''
  );

  // Which models are already downloaded — null means "still checking"
  const [cachedModels, setCachedModels] = useState<Record<string, boolean>>({});

  // Fetch RAM and check all model cache statuses on mount
  useEffect(() => {
    invoke<number>('get_ram_gb')
      .then((gb) => {
        setRamGb(gb);
        setSelectedModel((prev) => prev || recommendModel(gb));
      })
      .catch(() => {
        setRamGb(8);
        setSelectedModel((prev) => prev || recommendModel(8));
      });

    // Initial available RAM read
    invoke<number>('get_available_ram_gb')
      .then(setAvailableRamGb)
      .catch(() => setAvailableRamGb(null));

    // Poll every 10 s so model card badges stay current
    const ramInterval = setInterval(() => {
      invoke<number>('get_available_ram_gb')
        .then(setAvailableRamGb)
        .catch(() => {});
    }, 10_000);

    Promise.all(
      ALL_MODELS.map((id) =>
        invoke<boolean>('model_is_cached', { modelName: id })
          .then((cached) => [id, cached] as [string, boolean])
          .catch(() => [id, false] as [string, boolean])
      )
    ).then((results) => {
      const map: Record<string, boolean> = {};
      results.forEach(([id, cached]) => { map[id] = cached; });
      setCachedModels(map);
    });

    return () => clearInterval(ramInterval);
  }, []);

  // Settings
  const [language, setLanguage] = useState('auto');
  const [timestamps, setTimestamps] = useState('sentence');
  const [translateToEnglish, setTranslateToEnglish] = useState(false);

  // Export
  const [selectedFormats, setSelectedFormats] = useState(['.txt']);
  const [savePath, setSavePath] = useState('~/Desktop/transcripts/');

  // Transcript / progress
  const [transcript, setTranscript] = useState('');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Export result — set after auto-export or manual Export button
  type ExportResult = { paths: string[] } | { error: string };
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);

  function handleFileSelect(name: string, path: string) {
    void name;
    setFilePath(path);
    setTranscript('');
    setProgress(0);
    setStatus('');
    setExportResult(null);
  }

  async function handleExport(transcriptText: string) {
    if (!transcriptText) return;
    const fileName = filePath.split('/').pop() ?? filePath.split('\\').pop() ?? 'transcript';
    try {
      const paths = await invoke<string[]>('export_transcript', {
        transcript: transcriptText,
        formats: selectedFormats,
        savePath,
        fileName,
      });
      setExportResult({ paths });
    } catch (err) {
      setExportResult({ error: String(err) });
    }
  }

  async function handleTranscribe() {
    if (!filePath || isTranscribing || isDownloading) return;

    setTranscript('');
    setProgress(0);

    // ── Download phase (if model not cached) ─────────────────────────────────
    const isCached = cachedModels[selectedModel] ?? true; // optimistic if unknown
    if (!isCached) {
      setIsDownloading(true);
      setStatus('Starting download…');

      const unlisten = await listen<{ percent: number; downloaded_mb: number; total_mb: number }>(
        'download_progress',
        (event) => {
          const { percent, downloaded_mb, total_mb } = event.payload;
          setProgress(percent);
          const dlStr = total_mb > 0
            ? ` · ${downloaded_mb.toFixed(0)} / ${total_mb.toFixed(0)} MB`
            : '';
          setStatus(`Downloading model${dlStr}`);
        }
      );

      try {
        await invoke('download_model', { modelName: selectedModel });
        unlisten();
        setCachedModels((prev) => ({ ...prev, [selectedModel]: true }));
        setProgress(0);
        setStatus('Download complete — starting transcription…');
      } catch (err) {
        unlisten();
        setStatus(`Download failed: ${err}`);
        setProgress(0);
        setIsDownloading(false);
        return;
      }

      setIsDownloading(false);
    }

    // ── Transcription phase ───────────────────────────────────────────────────
    setIsTranscribing(true);
    setStatus('Starting…');

    const unlisten = await listen<{ percent: number; status: string }>(
      'transcribe_progress',
      (event) => {
        setProgress(event.payload.percent);
        setStatus(event.payload.status);
      }
    );

    try {
      const result = await invoke<string>('transcribe', {
        filePath,
        model: selectedModel,
        language,
        timestamps,
        translate: translateToEnglish,
      });
      setTranscript(result);
      setProgress(100);
      setStatus('Done');
      // Auto-export immediately after transcription
      await handleExport(result);
    } catch (err) {
      setStatus(`Error: ${err}`);
      setProgress(0);
    } finally {
      unlisten();
      setIsTranscribing(false);
    }
  }

  const isBusy = isDownloading || isTranscribing;
  const canTranscribe = !!filePath && !isBusy;
  const modelCached = cachedModels[selectedModel]; // undefined while loading
  const transcriptVisible = isBusy || !!transcript;

  const buttonLabel = isDownloading
    ? `Downloading… ${Math.round(progress)}%`
    : isTranscribing
    ? 'Transcribing…'
    : modelCached === false
    ? 'Download & Transcribe'
    : 'Transcribe';

  return (
    <>
    {showOnboarding && (
      <Onboarding onComplete={handleOnboardingComplete} />
    )}
    <div className="app-bg">
      <div className="app-content">

        <div className="content-top" style={{ flex: transcriptVisible ? '0 0 auto' : 1 }}>
          <div style={{ flex: transcriptVisible ? '0 0 auto' : 1, display: 'flex', flexDirection: 'column', minHeight: '4rem' }}>
            <DropZone onFileSelect={handleFileSelect} />
          </div>
          <div className="section-divider" />
          <ModelSelector
            selectedModel={selectedModel || recommendedModel}
            onModelChange={setSelectedModel}
            recommendedModel={recommendedModel}
            availableRamGb={availableRamGb ?? undefined}
            cachedModels={cachedModels}
          />
          <div className="section-divider" />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(16rem, 100%), 1fr))',
            gap: 'clamp(0.75rem, 2vw, 1.25rem)',
            alignItems: 'start',
          }}>
            <Settings
              language={language}
              onLanguageChange={setLanguage}
              timestamps={timestamps}
              onTimestampsChange={setTimestamps}
              translateToEnglish={translateToEnglish}
              onTranslateChange={setTranslateToEnglish}
            />
            <ExportOptions
              selectedFormats={selectedFormats}
              onFormatsChange={setSelectedFormats}
              savePath={savePath}
              onSavePathChange={setSavePath}
            />
          </div>
        </div>

        {transcriptVisible && (
          <div className="content-middle" style={{ flex: 1 }}>
            <div className="transcript-section">
              <div className="section-divider" />
              <TranscriptOutput
                transcript={transcript}
                progress={progress}
                status={status}
                isTranscribing={isBusy}
                exportResult={exportResult}
                onExport={() => handleExport(transcript)}
              />
            </div>
          </div>
        )}

        <div className="content-bottom">
          <button
            onClick={handleTranscribe}
            disabled={!canTranscribe}
            style={{
              width: '100%',
              padding: '0.7rem',
              borderRadius: 10,
              border: 'none',
              background: canTranscribe ? 'var(--color-accent)' : 'var(--color-border)',
              color: canTranscribe ? '#fff' : 'var(--color-tertiary)',
              fontSize: '1.071rem',
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: canTranscribe ? 'pointer' : 'not-allowed',
              transition: 'background 200ms ease, opacity 200ms ease',
              boxShadow: canTranscribe ? '0 2px 16px var(--color-accent-glow)' : 'none',
            }}
            onMouseEnter={(e) => { if (canTranscribe) e.currentTarget.style.opacity = '0.88'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            {buttonLabel}
          </button>
        </div>

      </div>
    </div>
    </>
  );
}
