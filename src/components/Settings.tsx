const LANGUAGES = [
  { value: 'auto',        label: 'Auto detect' },
  { value: 'afrikaans',   label: 'Afrikaans' },
  { value: 'albanian',    label: 'Albanian' },
  { value: 'amharic',     label: 'Amharic' },
  { value: 'arabic',      label: 'Arabic' },
  { value: 'armenian',    label: 'Armenian' },
  { value: 'assamese',    label: 'Assamese' },
  { value: 'azerbaijani', label: 'Azerbaijani' },
  { value: 'bashkir',     label: 'Bashkir' },
  { value: 'basque',      label: 'Basque' },
  { value: 'belarusian',  label: 'Belarusian' },
  { value: 'bengali',     label: 'Bengali' },
  { value: 'bosnian',     label: 'Bosnian' },
  { value: 'breton',      label: 'Breton' },
  { value: 'bulgarian',   label: 'Bulgarian' },
  { value: 'burmese',     label: 'Burmese' },
  { value: 'castilian',   label: 'Castilian' },
  { value: 'catalan',     label: 'Catalan' },
  { value: 'chinese',     label: 'Chinese' },
  { value: 'croatian',    label: 'Croatian' },
  { value: 'czech',       label: 'Czech' },
  { value: 'danish',      label: 'Danish' },
  { value: 'dutch',       label: 'Dutch' },
  { value: 'english',     label: 'English' },
  { value: 'estonian',    label: 'Estonian' },
  { value: 'faroese',     label: 'Faroese' },
  { value: 'finnish',     label: 'Finnish' },
  { value: 'flemish',     label: 'Flemish' },
  { value: 'french',      label: 'French' },
  { value: 'galician',    label: 'Galician' },
  { value: 'georgian',    label: 'Georgian' },
  { value: 'german',      label: 'German' },
  { value: 'greek',       label: 'Greek' },
  { value: 'gujarati',    label: 'Gujarati' },
  { value: 'haitian creole', label: 'Haitian Creole' },
  { value: 'hausa',       label: 'Hausa' },
  { value: 'hawaiian',    label: 'Hawaiian' },
  { value: 'hebrew',      label: 'Hebrew' },
  { value: 'hindi',       label: 'Hindi' },
  { value: 'hungarian',   label: 'Hungarian' },
  { value: 'icelandic',   label: 'Icelandic' },
  { value: 'indonesian',  label: 'Indonesian' },
  { value: 'italian',     label: 'Italian' },
  { value: 'japanese',    label: 'Japanese' },
  { value: 'javanese',    label: 'Javanese' },
  { value: 'kannada',     label: 'Kannada' },
  { value: 'kazakh',      label: 'Kazakh' },
  { value: 'khmer',       label: 'Khmer' },
  { value: 'korean',      label: 'Korean' },
  { value: 'lao',         label: 'Lao' },
  { value: 'latin',       label: 'Latin' },
  { value: 'latvian',     label: 'Latvian' },
  { value: 'letzeburgesch', label: 'Letzeburgesch' },
  { value: 'lingala',     label: 'Lingala' },
  { value: 'lithuanian',  label: 'Lithuanian' },
  { value: 'luxembourgish', label: 'Luxembourgish' },
  { value: 'macedonian',  label: 'Macedonian' },
  { value: 'malagasy',    label: 'Malagasy' },
  { value: 'malay',       label: 'Malay' },
  { value: 'malayalam',   label: 'Malayalam' },
  { value: 'maltese',     label: 'Maltese' },
  { value: 'maori',       label: 'Maori' },
  { value: 'marathi',     label: 'Marathi' },
  { value: 'moldavian',   label: 'Moldavian' },
  { value: 'moldovan',    label: 'Moldovan' },
  { value: 'mongolian',   label: 'Mongolian' },
  { value: 'myanmar',     label: 'Myanmar' },
  { value: 'nepali',      label: 'Nepali' },
  { value: 'norwegian',   label: 'Norwegian' },
  { value: 'nynorsk',     label: 'Nynorsk' },
  { value: 'occitan',     label: 'Occitan' },
  { value: 'panjabi',     label: 'Panjabi' },
  { value: 'persian',     label: 'Persian' },
  { value: 'polish',      label: 'Polish' },
  { value: 'portuguese',  label: 'Portuguese' },
  { value: 'punjabi',     label: 'Punjabi' },
  { value: 'pushto',      label: 'Pushto' },
  { value: 'pashto',      label: 'Pashto' },
  { value: 'romanian',    label: 'Romanian' },
  { value: 'russian',     label: 'Russian' },
  { value: 'sanskrit',    label: 'Sanskrit' },
  { value: 'serbian',     label: 'Serbian' },
  { value: 'shona',       label: 'Shona' },
  { value: 'sindhi',      label: 'Sindhi' },
  { value: 'sinhala',     label: 'Sinhala' },
  { value: 'slovak',      label: 'Slovak' },
  { value: 'slovenian',   label: 'Slovenian' },
  { value: 'somali',      label: 'Somali' },
  { value: 'spanish',     label: 'Spanish' },
  { value: 'sundanese',   label: 'Sundanese' },
  { value: 'swahili',     label: 'Swahili' },
  { value: 'swedish',     label: 'Swedish' },
  { value: 'tagalog',     label: 'Tagalog' },
  { value: 'tajik',       label: 'Tajik' },
  { value: 'tamil',       label: 'Tamil' },
  { value: 'tatar',       label: 'Tatar' },
  { value: 'telugu',      label: 'Telugu' },
  { value: 'thai',        label: 'Thai' },
  { value: 'tibetan',     label: 'Tibetan' },
  { value: 'turkish',     label: 'Turkish' },
  { value: 'turkmen',     label: 'Turkmen' },
  { value: 'ukrainian',   label: 'Ukrainian' },
  { value: 'urdu',        label: 'Urdu' },
  { value: 'uzbek',       label: 'Uzbek' },
  { value: 'valencian',   label: 'Valencian' },
  { value: 'vietnamese',  label: 'Vietnamese' },
  { value: 'welsh',       label: 'Welsh' },
  { value: 'wolof',       label: 'Wolof' },
  { value: 'yiddish',     label: 'Yiddish' },
  { value: 'yoruba',      label: 'Yoruba' },
];

const TIMESTAMP_OPTIONS = [
  { value: 'sentence', label: 'Per sentence' },
  { value: 'word',     label: 'Per word' },
  { value: 'none',     label: 'None' },
];

interface Props {
  language: string;
  onLanguageChange: (v: string) => void;
  timestamps: string;
  onTimestampsChange: (v: string) => void;
  translateToEnglish: boolean;
  onTranslateChange: (v: boolean) => void;
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--color-surface)',
  border: '1.5px solid var(--color-border)',
  borderRadius: 8,
  padding: '0.4rem 1.8rem 0.4rem 0.6rem',
  fontSize: '0.857rem',
  color: 'var(--color-primary)',
  cursor: 'pointer',
  outline: 'none',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%238e8e93' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.5rem center',
  transition: 'border-color 200ms ease',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.714rem',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--color-secondary)',
  marginBottom: '0.25rem',
  display: 'block',
};

export default function Settings({
  language, onLanguageChange,
  timestamps, onTimestampsChange,
  translateToEnglish, onTranslateChange,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <span style={{ ...labelStyle, marginBottom: 0 }}>Settings</span>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div>
          <span style={labelStyle}>Language</span>
          <select value={language} onChange={(e) => onLanguageChange(e.target.value)} style={selectStyle}>
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>
        <div>
          <span style={labelStyle}>Timestamps</span>
          <select value={timestamps} onChange={(e) => onTimestampsChange(e.target.value)} style={selectStyle}>
            {TIMESTAMP_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Translate toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--color-surface)',
        border: '1.5px solid var(--color-border)',
        borderRadius: 8,
        padding: '0.45rem 0.65rem',
      }}>
        <span style={{ fontSize: '0.857rem', fontWeight: 500, color: 'var(--color-primary)' }}>
          Translate to English
        </span>
        <button
          role="switch"
          aria-checked={translateToEnglish}
          onClick={() => onTranslateChange(!translateToEnglish)}
          style={{
            width: 36, height: 22, borderRadius: 11, border: 'none',
            background: translateToEnglish ? 'var(--color-accent)' : 'var(--color-border)',
            cursor: 'pointer', position: 'relative', flexShrink: 0,
            transition: 'background 200ms ease', outline: 'none', padding: 0,
          }}
        >
          <span style={{
            position: 'absolute', top: 3,
            left: translateToEnglish ? 17 : 3,
            width: 16, height: 16, borderRadius: '50%',
            background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            transition: 'left 200ms ease',
          }} />
        </button>
      </div>
    </div>
  );
}
