import { useState } from 'react';

type ExportResult = { paths: string[] } | { error: string };

interface Props {
  transcript: string;
  progress: number;      // 0–100
  status: string;
  isTranscribing: boolean;
  exportResult?: ExportResult | null;
  onExport?: () => void;
}

export default function TranscriptOutput({
  transcript, progress, status, isTranscribing, exportResult, onExport,
}: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!transcript) return;
    await navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const showProgress = isTranscribing || (progress > 0 && progress < 100);

  // Derive a short, human-friendly save-location string from the first path
  const saveLocation = (() => {
    if (!exportResult || !('paths' in exportResult) || exportResult.paths.length === 0) return null;
    const first = exportResult.paths[0];
    const lastSlash = Math.max(first.lastIndexOf('/'), first.lastIndexOf('\\'));
    const dir = lastSlash > 0 ? first.slice(0, lastSlash) : first;
    // Replace home dir prefix with ~
    const home = window.__TAURI_INTERNALS__
      ? undefined // will use raw path on Tauri — tilde substitution happens in Rust
      : undefined;
    void home;
    return dir;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minHeight: 0 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <label style={{
          fontSize: '0.714rem',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--color-secondary)',
        }}>
          Transcript
        </label>
        {transcript && (
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              onClick={handleCopy}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                background: 'none',
                border: '1.5px solid var(--color-border)',
                borderRadius: 7, padding: '0.2rem 0.7rem',
                fontSize: '0.786rem',
                color: copied ? 'var(--color-success)' : 'var(--color-primary)',
                cursor: 'pointer',
                transition: 'color 200ms ease, border-color 200ms ease',
                outline: 'none',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {copied
                  ? <polyline points="20 6 9 17 4 12" />
                  : <><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>
                }
              </svg>
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={onExport}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                background: 'var(--color-accent)', border: 'none',
                borderRadius: 7, padding: '0.2rem 0.7rem',
                fontSize: '0.786rem', fontWeight: 600, color: '#fff',
                cursor: 'pointer', transition: 'opacity 200ms ease', outline: 'none',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export
            </button>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {showProgress && (
        <div style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.786rem', color: 'var(--color-secondary)' }}>{status}</span>
            <span style={{ fontSize: '0.786rem', color: 'var(--color-secondary)', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(progress)}%
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progress}%`, borderRadius: 2,
              background: 'var(--color-accent)', transition: 'width 300ms ease',
            }} />
          </div>
        </div>
      )}

      {/* Export result banner */}
      {exportResult && !showProgress && (
        <div style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.35rem 0.7rem',
          borderRadius: 7,
          fontSize: '0.786rem',
          ...('paths' in exportResult
            ? {
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                color: '#22c55e',
              }
            : {
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
              }),
        }}>
          {'paths' in exportResult ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Saved to {saveLocation}
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Export failed: {exportResult.error}
            </>
          )}
        </div>
      )}

      {/* Transcript textarea */}
      <textarea
        readOnly
        value={transcript}
        placeholder={isTranscribing ? 'Transcribing…' : 'Transcript will appear here'}
        style={{
          flex: 1,
          minHeight: '5rem',
          fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", Menlo, monospace',
          fontSize: '0.857rem',
          lineHeight: 1.6,
          color: transcript ? 'var(--color-primary)' : 'var(--color-tertiary)',
          background: 'var(--color-surface)',
          border: '1.5px solid var(--color-border)',
          borderRadius: 9,
          padding: '0.65rem 0.85rem',
          resize: 'none',
          width: '100%',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />
    </div>
  );
}
