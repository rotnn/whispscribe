import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { recommendModel, recommendModelByAvailableRam, modelNeedsMoreRam } from '../utils/detectModel';

// ── Model registry ────────────────────────────────────────────────────────────

interface ModelMeta {
  id: string;
  label: string;
  size: string;
  speed: string;
  desc: string;
}

const MODELS: ModelMeta[] = [
  { id: 'tiny',     label: 'Tiny',     size: '75 MB',  speed: 'Fastest',      desc: 'Quick transcriptions, lower accuracy'     },
  { id: 'small',    label: 'Small',    size: '465 MB', speed: 'Balanced',     desc: 'Great for most use cases'                 },
  { id: 'medium',   label: 'Medium',   size: '1.5 GB', speed: 'Accurate',     desc: 'High accuracy for important recordings'   },
  { id: 'large-v3', label: 'Large v3', size: '3 GB',   speed: 'Best quality', desc: 'Best quality, ideal for 16GB+ RAM'        },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMb(mb: number): string {
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface DownloadPayload {
  percent: number;
  downloaded_mb: number;
  total_mb: number;
}

type Phase = 'detecting' | 'select' | 'downloading';

interface Props {
  onComplete: (selectedModel: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Onboarding({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('detecting');
  const [ramGb, setRamGb] = useState<number | null>(null);
  const [availableRamGb, setAvailableRamGb] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [dlPercent, setDlPercent] = useState(0);
  const [dlMb, setDlMb] = useState(0);
  const [totalMb, setTotalMb] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fading, setFading] = useState(false);

  // Detect RAM, then show model selection.
  // Available RAM drives the recommendation; total RAM is shown in the note only.
  useEffect(() => {
    invoke<number>('get_available_ram_gb')
      .then((gb) => {
        setAvailableRamGb(gb);
        setSelectedModel(recommendModelByAvailableRam(gb));
      })
      .catch(() => setAvailableRamGb(null));

    invoke<number>('get_ram_gb')
      .then((gb) => {
        setRamGb(gb);
        // Only fall back to total-RAM recommendation if available-RAM call failed
        setSelectedModel((prev) => prev || recommendModel(gb));
        setPhase('select');
      })
      .catch(() => {
        setRamGb(null);
        setSelectedModel((prev) => prev || 'small');
        setPhase('select');
      });
  }, []);

  const recommendedModel = availableRamGb != null
    ? recommendModelByAvailableRam(availableRamGb)
    : recommendModel(ramGb ?? 8);
  const selectedMeta = MODELS.find((m) => m.id === selectedModel) ?? MODELS[1];

  async function handleDownload() {
    setPhase('downloading');
    setDlPercent(0);
    setDlMb(0);
    setTotalMb(0);
    setError(null);

    const unlisten = await listen<DownloadPayload>('download_progress', (event) => {
      setDlPercent(event.payload.percent);
      setDlMb(event.payload.downloaded_mb);
      setTotalMb(event.payload.total_mb);
    });

    try {
      await invoke('download_model', { modelName: selectedModel });
      unlisten();

      // Pause at 100% so the bar visibly completes before fading
      setDlPercent(100);
      await new Promise((r) => setTimeout(r, 700));

      localStorage.setItem('whispscribe_onboarded', 'true');
      localStorage.setItem('whispscribe_default_model', selectedModel);

      setFading(true);
      await new Promise((r) => setTimeout(r, 450));
      onComplete(selectedModel);
    } catch (err) {
      unlisten();
      setError(String(err));
      setPhase('select');
    }
  }

  // ── Download status label ──────────────────────────────────────────────────

  const dlStatusLabel = (() => {
    if (dlPercent >= 100) return `${selectedMeta.label} downloaded — launching…`;
    if (totalMb > 0) {
      return `Downloading ${selectedMeta.label} · ${fmtMb(dlMb)} / ${fmtMb(totalMb)}`;
    }
    return `Preparing ${selectedMeta.label}…`;
  })();

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(1.5rem, 4vw, 3rem)',
        background: `
          radial-gradient(ellipse 55% 40% at 15% 0%,   rgba(59, 130, 246, 0.09) 0%, transparent 70%),
          radial-gradient(ellipse 35% 30% at 88% 100%,  rgba(99, 102, 241, 0.07) 0%, transparent 70%),
          #0d0d0f
        `,
        opacity: fading ? 0 : 1,
        transition: 'opacity 450ms ease',
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 540,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'clamp(1.25rem, 3vh, 2rem)',
        }}
      >
        {/* ── Logo ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
              <line x1="3"  y1="13" x2="3"  y2="13" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="7"  y1="8"  x2="7"  y2="18" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="11" y1="5"  x2="11" y2="21" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="15" y1="8"  x2="15" y2="18" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="19" y1="10" x2="19" y2="16" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="23" y1="13" x2="23" y2="13" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{
            fontSize: '1.071rem', fontWeight: 700,
            color: 'var(--color-primary)', letterSpacing: '-0.01em',
          }}>
            WhispScribe
          </span>
        </div>

        {/* ── Heading ── */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: 'clamp(1.286rem, 3vw, 1.714rem)',
            fontWeight: 700,
            color: 'var(--color-primary)',
            letterSpacing: '-0.02em',
            marginBottom: '0.4rem',
          }}>
            Welcome to WhispScribe
          </h1>
          <p style={{ fontSize: '0.929rem', color: 'var(--color-secondary)', lineHeight: 1.55 }}>
            {phase === 'detecting'
              ? 'Detecting your hardware…'
              : 'Let\'s get you set up. Choose your transcription model.'}
          </p>
        </div>

        {/* ── Model cards (hidden while detecting) ── */}
        {phase !== 'detecting' && (
          <>
            <div style={{
              width: '100%',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '0.5rem',
            }}>
              {MODELS.map((m) => {
                const isSelected = selectedModel === m.id;
                const locked = phase === 'downloading';
                const insufficientRam = availableRamGb != null && modelNeedsMoreRam(m.id, availableRamGb);
                // Only badge as recommended if the card is actually usable
                const isRecommended = recommendedModel === m.id && !insufficientRam;
                const isDisabled = locked || insufficientRam;

                // Exactly one badge or a fixed-height spacer — never two badges
                const badge = insufficientRam ? (
                  <span style={{
                    display: 'block',
                    fontSize: '0.5rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: '#ef4444',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: 3,
                    padding: '0.05rem 0.3rem',
                    lineHeight: 1.7,
                    marginBottom: '0.3rem',
                    width: 'fit-content',
                  }}>
                    Insufficient RAM
                  </span>
                ) : isRecommended ? (
                  <span style={{
                    display: 'block',
                    fontSize: '0.5rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: 'var(--color-accent)',
                    background: 'var(--color-accent-subtle)',
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    borderRadius: 3,
                    padding: '0.05rem 0.3rem',
                    lineHeight: 1.7,
                    marginBottom: '0.3rem',
                    width: 'fit-content',
                  }}>
                    recommended
                  </span>
                ) : (
                  <div style={{ height: '1rem', marginBottom: '0.3rem' }} />
                );

                return (
                  <button
                    key={m.id}
                    onClick={() => !isDisabled && setSelectedModel(m.id)}
                    disabled={isDisabled}
                    style={{
                      position: 'relative',
                      textAlign: 'left',
                      background: isSelected ? 'var(--color-accent-subtle)' : 'var(--color-surface)',
                      border: `1.5px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      borderRadius: 10,
                      padding: '10px 12px',
                      cursor: isDisabled ? 'default' : 'pointer',
                      transition: 'border-color 200ms ease, background 200ms ease, opacity 200ms ease',
                      outline: 'none',
                      width: '100%',
                      opacity: isDisabled ? 0.4 : 1,
                      alignSelf: 'stretch',
                    }}
                  >
                    {badge}
                    <div style={{
                      fontSize: '0.857rem',
                      fontWeight: 600,
                      color: isSelected ? 'var(--color-accent)' : 'var(--color-primary)',
                      marginBottom: '0.15rem',
                    }}>
                      {m.label}
                    </div>
                    <div style={{
                      fontSize: '0.714rem',
                      color: 'var(--color-secondary)',
                      marginBottom: '0.25rem',
                    }}>
                      {m.size} · {m.speed}
                    </div>
                    <div style={{ fontSize: '0.679rem', color: 'var(--color-tertiary)', lineHeight: 1.4 }}>
                      {m.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── RAM note ── */}
            <p style={{
              fontSize: '0.75rem',
              color: 'var(--color-tertiary)',
              textAlign: 'center',
              marginTop: '-0.5rem',
            }}>
              {availableRamGb !== null
                ? `Based on your available RAM (${availableRamGb} GB free) — you can change this later in the app`
                : 'You can change the model later in the app'}
            </p>
          </>
        )}

        {/* ── CTA or progress ── */}
        <div style={{ width: '100%' }}>

          {phase === 'select' && (
            <>
              {error && (
                <p style={{
                  fontSize: '0.786rem',
                  color: 'var(--color-error)',
                  textAlign: 'center',
                  marginBottom: '0.65rem',
                }}>
                  {error}
                </p>
              )}
              <button
                onClick={handleDownload}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--color-accent)',
                  color: '#fff',
                  fontSize: '1rem',
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  boxShadow: '0 2px 20px var(--color-accent-glow)',
                  transition: 'opacity 200ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Download {selectedMeta.label} & Get Started
              </button>
            </>
          )}

          {phase === 'downloading' && (
            <div style={{ width: '100%' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: '0.4rem',
              }}>
                <span style={{ fontSize: '0.786rem', color: 'var(--color-secondary)' }}>
                  {dlStatusLabel}
                </span>
                <span style={{
                  fontSize: '0.786rem',
                  color: 'var(--color-secondary)',
                  fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0,
                  marginLeft: '0.75rem',
                }}>
                  {Math.round(dlPercent)}%
                </span>
              </div>
              <div style={{
                height: 4,
                borderRadius: 2,
                background: 'var(--color-border)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${dlPercent}%`,
                  borderRadius: 2,
                  background: 'var(--color-accent)',
                  boxShadow: dlPercent > 5 ? '0 0 10px var(--color-accent-glow)' : 'none',
                  transition: 'width 350ms ease',
                }} />
              </div>
            </div>
          )}

          {phase === 'detecting' && (
            <div style={{
              height: 4, borderRadius: 2, background: 'var(--color-border)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: '35%',
                borderRadius: 2,
                background: 'var(--color-border)',
                opacity: 0.5,
              }} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
