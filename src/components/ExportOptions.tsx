import { open } from '@tauri-apps/plugin-dialog';

const FORMATS = ['.txt', '.srt', '.vtt', '.json', '.csv', '.md'];

interface Props {
  selectedFormats: string[];
  onFormatsChange: (formats: string[]) => void;
  savePath: string;
  onSavePathChange: (path: string) => void;
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.714rem',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--color-secondary)',
  display: 'block',
};

export default function ExportOptions({ selectedFormats, onFormatsChange, savePath, onSavePathChange }: Props) {
  function toggleFormat(fmt: string) {
    if (selectedFormats.includes(fmt)) {
      onFormatsChange(selectedFormats.filter((f) => f !== fmt));
    } else {
      onFormatsChange([...selectedFormats, fmt]);
    }
  }

  async function chooseSavePath() {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === 'string') onSavePathChange(selected);
    } catch {
      // dialog plugin not yet available in dev mode — no-op
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <span style={labelStyle}>Export</span>

      {/* Format chips — wrap naturally at any width */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
        {FORMATS.map((fmt) => {
          const active = selectedFormats.includes(fmt);
          return (
            <button
              key={fmt}
              onClick={() => toggleFormat(fmt)}
              style={{
                padding: '0.2rem 0.65rem',
                borderRadius: 20,
                fontSize: '0.857rem',
                fontWeight: 500,
                cursor: 'pointer',
                border: `1.5px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: active ? 'var(--color-accent-subtle)' : 'var(--color-surface)',
                color: active ? 'var(--color-accent)' : 'var(--color-secondary)',
                transition: 'border-color 200ms ease, background 200ms ease, color 200ms ease',
                outline: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {fmt}
            </button>
          );
        })}
      </div>

      {/* Save location */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        background: 'var(--color-surface)',
        border: '1.5px solid var(--color-border)',
        borderRadius: 8,
        padding: '0.4rem 0.65rem',
        minWidth: 0,
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="var(--color-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span style={{
          fontSize: '0.786rem',
          color: 'var(--color-secondary)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}>
          {savePath}
        </span>
        <button
          onClick={chooseSavePath}
          style={{
            background: 'none',
            border: '1.5px solid var(--color-border)',
            borderRadius: 6,
            padding: '0.15rem 0.5rem',
            fontSize: '0.786rem',
            color: 'var(--color-primary)',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'border-color 200ms ease',
            outline: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Change
        </button>
      </div>
    </div>
  );
}
