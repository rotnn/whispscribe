import { useState, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';

const ACCEPTED = ['mp4', 'mov', 'mp3', 'wav', 'm4a', 'webm'];

function isAccepted(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return ACCEPTED.includes(ext);
}

interface Props {
  onFileSelect: (name: string, path: string) => void;
}

export default function DropZone({ onFileSelect }: Props) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep a ref to onFileSelect so the Tauri event listeners (registered once)
  // always call the latest version without needing to re-register on every render.
  const callbackRef = useRef(onFileSelect);
  useEffect(() => { callbackRef.current = onFileSelect; });

  // Tauri 2 intercepts OS-level file drops before HTML drag events fire.
  // We must use the Tauri event API to receive dropped file paths.
  useEffect(() => {
    let unlistenDrop: (() => void) | null = null;
    let unlistenEnter: (() => void) | null = null;
    let unlistenLeave: (() => void) | null = null;

    listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
      setDragging(false);
      const path = event.payload.paths[0];
      if (!path) return;
      const name = path.split(/[/\\]/).pop() ?? path;
      if (!isAccepted(name)) {
        setError(`Unsupported format — accepted: ${ACCEPTED.join(', ')}`);
        return;
      }
      setError(null);
      setFileName(name);
      callbackRef.current(name, path);
    }).then((fn) => { unlistenDrop = fn; });

    listen('tauri://drag', () => setDragging(true))
      .then((fn) => { unlistenEnter = fn; });

    listen('tauri://drag-leave', () => setDragging(false))
      .then((fn) => { unlistenLeave = fn; });

    return () => {
      unlistenDrop?.();
      unlistenEnter?.();
      unlistenLeave?.();
    };
  }, []); // register once — callback stays fresh via callbackRef

  async function handleBrowse() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Audio / Video', extensions: ACCEPTED }],
      });
      if (!selected || typeof selected !== 'string') return;
      const name = selected.split(/[/\\]/).pop() ?? selected;
      if (!isAccepted(name)) {
        setError(`Unsupported format — accepted: ${ACCEPTED.join(', ')}`);
        return;
      }
      setError(null);
      setFileName(name);
      callbackRef.current(name, selected);
    } catch {
      // user cancelled the dialog — no-op
    }
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setFileName(null);
    setError(null);
    callbackRef.current('', '');
  }

  // HTML handlers kept only for visual drag-over feedback.
  // The actual drop is handled by the Tauri event listener above.
  function onDragOver(e: React.DragEvent) { e.preventDefault(); setDragging(true); }
  function onDragLeave(e: React.DragEvent) { e.preventDefault(); setDragging(false); }
  function onDrop(e: React.DragEvent) { e.preventDefault(); setDragging(false); }

  const borderColor = dragging ? 'var(--color-accent)' : 'var(--color-border)';
  const bgColor = dragging ? 'var(--color-accent-subtle)' : 'transparent';

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        border: `1.5px dashed ${borderColor}`,
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        background: bgColor,
        transition: 'border-color 0.15s, background 0.15s',
        userSelect: 'none',
        flex: 1,
        width: '100%',
        minHeight: '4rem',
        padding: '1.5rem 1rem',
        textAlign: 'center',
      }}
    >
      {fileName ? (
        /* ── File selected: compact centered row ── */
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', maxWidth: '100%' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <line x1="4"  y1="12" x2="4"  y2="12" />
            <line x1="8"  y1="8"  x2="8"  y2="16" />
            <line x1="12" y1="5"  x2="12" y2="19" />
            <line x1="16" y1="8"  x2="16" y2="16" />
            <line x1="20" y1="12" x2="20" y2="12" />
          </svg>
          <div style={{
            fontSize: '0.929rem', fontWeight: 500,
            color: 'var(--color-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            maxWidth: '22rem',
          }}>
            {fileName}
          </div>
          <button
            onClick={handleClear}
            aria-label="Remove file"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0.15rem 0.4rem', color: 'var(--color-secondary)',
              fontSize: '1.286rem', lineHeight: 1, flexShrink: 0,
            }}
          >×</button>
        </div>
      ) : (
        /* ── Empty: icon + text + formats + browse ── */
        <>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="var(--color-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9"  y1="15" x2="15" y2="15" />
          </svg>
          <div style={{ fontSize: '0.929rem', fontWeight: 500, color: 'var(--color-primary)' }}>
            Drop video or audio file
          </div>
          <div style={{ fontSize: '0.786rem', color: 'var(--color-secondary)' }}>
            {ACCEPTED.join(' · ')}
          </div>
          <button
            onClick={handleBrowse}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.857rem', color: 'var(--color-accent)',
              marginTop: '0.15rem', padding: 0, fontFamily: 'inherit',
            }}
          >
            Browse
          </button>
        </>
      )}

      {error && (
        <span role="alert" style={{ fontSize: '0.786rem', color: 'var(--color-error)' }}>
          {error}
        </span>
      )}
    </div>
  );
}
