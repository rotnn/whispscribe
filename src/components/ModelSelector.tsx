import { modelNeedsMoreRam } from '../utils/detectModel';

interface ModelMeta {
  id: string;
  label: string;
  size: string;
  speed: string;
}

const MODELS: ModelMeta[] = [
  { id: 'tiny',     label: 'Tiny',     size: '75 MB',  speed: 'Fastest'      },
  { id: 'small',    label: 'Small',    size: '465 MB', speed: 'Balanced'     },
  { id: 'medium',   label: 'Medium',   size: '1.5 GB', speed: 'Accurate'     },
  { id: 'large-v3', label: 'Large v3', size: '3 GB',   speed: 'Best quality' },
];

interface Props {
  selectedModel: string;
  onModelChange: (model: string) => void;
  recommendedModel: string;
  availableRamGb?: number;
  cachedModels?: Record<string, boolean>;
}

export default function ModelSelector({ selectedModel, onModelChange, recommendedModel, availableRamGb, cachedModels }: Props) {
  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: '0.714rem',
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--color-secondary)',
        marginBottom: '0.4rem',
      }}>
        Model
      </label>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(8.5rem, 100%), 1fr))',
        gap: '0.4rem',
      }}>
        {MODELS.map((m) => {
          const isSelected = selectedModel === m.id;
          const insufficientRam = availableRamGb != null && modelNeedsMoreRam(m.id, availableRamGb);
          const isRecommended = recommendedModel === m.id && !insufficientRam;
          // undefined = cache check not yet complete; treat as unknown (no indicator)
          const isCached = cachedModels?.[m.id];

          return (
            <button
              key={m.id}
              onClick={() => !insufficientRam && onModelChange(m.id)}
              disabled={insufficientRam}
              style={{
                position: 'relative',
                textAlign: 'left',
                background: isSelected ? 'var(--color-accent-subtle)' : 'var(--color-surface)',
                border: `1.5px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                borderRadius: 9,
                padding: '0.5rem 0.7rem',
                cursor: insufficientRam ? 'default' : 'pointer',
                transition: 'border-color 200ms ease, background 200ms ease, opacity 200ms ease',
                outline: 'none',
                width: '100%',
                opacity: insufficientRam ? 0.4 : 1,
              }}
            >
              {/* Top-right badge: Insufficient RAM > recommended > nothing */}
              {insufficientRam ? (
                <span style={{
                  position: 'absolute',
                  top: '0.4rem',
                  right: '0.45rem',
                  fontSize: '0.571rem',
                  fontWeight: 600,
                  letterSpacing: '0.03em',
                  color: '#ef4444',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: 4,
                  padding: '0 0.35rem',
                  lineHeight: '1.6',
                }}>
                  Insufficient RAM
                </span>
              ) : isRecommended ? (
                <span style={{
                  position: 'absolute',
                  top: '0.4rem',
                  right: '0.45rem',
                  fontSize: '0.571rem',
                  fontWeight: 600,
                  letterSpacing: '0.03em',
                  color: 'var(--color-accent)',
                  background: 'var(--color-accent-subtle)',
                  border: '1px solid var(--color-accent)',
                  borderRadius: 4,
                  padding: '0 0.35rem',
                  lineHeight: '1.6',
                }}>
                  recommended
                </span>
              ) : null}

              <div style={{
                fontSize: '0.929rem',
                fontWeight: 600,
                color: isSelected ? 'var(--color-accent)' : 'var(--color-primary)',
                marginBottom: '0.15rem',
              }}>
                {m.label}
              </div>
              <div style={{ fontSize: '0.786rem', color: 'var(--color-secondary)' }}>
                {m.size} · {m.speed}
              </div>

              {/* Download status indicator */}
              {isCached === true && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  marginTop: '0.25rem',
                }}>
                  <span style={{
                    width: 6, height: 6,
                    borderRadius: '50%',
                    background: '#22c55e',
                    flexShrink: 0,
                    display: 'inline-block',
                  }} />
                  <span style={{ fontSize: '0.679rem', color: '#22c55e' }}>ready</span>
                </div>
              )}
              {isCached === false && (
                <div style={{ marginTop: '0.25rem' }}>
                  <span style={{ fontSize: '0.679rem', color: 'var(--color-tertiary)' }}>
                    not downloaded
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
