/**
 * Image Provider 선택 버튼 그룹.
 * value = 백엔드 enum (API payload에 그대로 전달). label = 표시용만 사용.
 * 선택값은 localStorage img_provider에 저장.
 */
const PROVIDERS = [
  { value: 'openai', label: 'OpenAI (DALL·E)' },
  { value: 'imagefx', label: 'ImageFX' },
  { value: 'whisk', label: '위스크' },
  { value: 'midjourney', label: '미드저니' },
  { value: 'imagen4', label: '이메젠4' },
  { value: 'nanobanana', label: '나노바나나' },
  { value: 'nanobanana_pro', label: '나노바나나 프로' },
];

const STORAGE_KEY = 'img_provider';
const DEFAULT_PROVIDER = 'openai';
const VALID_PROVIDER_VALUES = PROVIDERS.map(p => p.value);

/** API에 보낼 provider는 반드시 enum 값. 라벨/잘못된 값이면 value로 매핑 또는 openai. */
export function toNormalizedProvider(val) {
  if (!val || typeof val !== 'string') return DEFAULT_PROVIDER;
  const v = String(val).trim();
  if (VALID_PROVIDER_VALUES.includes(v)) return v;
  const byLabel = PROVIDERS.find(p => p.label === v);
  if (byLabel) return byLabel.value;
  return DEFAULT_PROVIDER;
}

export function getStoredProvider() {
  if (typeof window === 'undefined') return DEFAULT_PROVIDER;
  const stored = localStorage.getItem(STORAGE_KEY);
  const valid = PROVIDERS.some(p => p.value === stored);
  return valid ? stored : DEFAULT_PROVIDER;
}

export function setStoredProvider(provider) {
  if (typeof window !== 'undefined' && PROVIDERS.some(p => p.value === provider)) {
    localStorage.setItem(STORAGE_KEY, provider);
  }
}

export default function ProviderSelector({ selectedProvider, onSelect }) {
  return (
    <div className="provider-selector" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
      <span style={{ marginRight: '8px', fontWeight: 600 }}>Provider:</span>
      {PROVIDERS.map((p) => (
        <button
          key={p.value}
          type="button"
          className={`provider-btn ${selectedProvider === p.value ? 'selected' : ''}`}
          onClick={() => {
            onSelect(p.value);
            setStoredProvider(p.value);
          }}
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: selectedProvider === p.value ? '2px solid #6366f1' : '1px solid #ccc',
            background: selectedProvider === p.value ? '#eef2ff' : '#fff',
            cursor: 'pointer',
            fontWeight: selectedProvider === p.value ? 600 : 400,
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export { PROVIDERS, STORAGE_KEY, DEFAULT_PROVIDER, VALID_PROVIDER_VALUES, toNormalizedProvider };
