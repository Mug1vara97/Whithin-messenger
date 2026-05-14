const STORAGE_KEY = 'whithin-app-theme';

/** Базовая тема (совпадает с :root в index.css) */
export const DEFAULT_THEME = {
  '--background': '#36393f',
  '--background-primary': '#2f3136',
  '--background-secondary': '#36393f',
  '--surface': '#2f3136',
  '--surface-hover': '#40444b',
  '--text': '#dcddde',
  '--text-muted': '#8e9297',
  '--text-secondary': '#b9bbbe',
  '--primary': '#5865f2',
  '--primary-hover': '#4752c4',
  '--border': '#4f545c',
  '--server-list-background': '#1e1f22'
};

export const THEME_COLOR_FIELDS = [
  { key: '--background', label: 'Фон приложения' },
  { key: '--background-primary', label: 'Фон панелей' },
  { key: '--surface', label: 'Поверхности' },
  { key: '--surface-hover', label: 'Наведение на элементы' },
  { key: '--text', label: 'Текст' },
  { key: '--text-muted', label: 'Приглушённый текст' },
  { key: '--text-secondary', label: 'Вторичный текст' },
  { key: '--primary', label: 'Акцент (кнопки, ссылки)' },
  { key: '--primary-hover', label: 'Акцент при наведении' },
  { key: '--border', label: 'Границы' },
  { key: '--server-list-background', label: 'Полоса серверов' }
];

function hexToRgbTriplet(hex) {
  if (!hex || typeof hex !== 'string') return '88, 101, 242';
  let h = hex.trim().replace('#', '');
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  if (h.length !== 6) return '88, 101, 242';
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return '88, 101, 242';
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

export function getMergedTheme() {
  const base = { ...DEFAULT_THEME };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw);
    if (saved && typeof saved === 'object') {
      Object.keys(base).forEach((k) => {
        if (saved[k] != null && saved[k] !== '') base[k] = saved[k];
      });
    }
  } catch {
    /* ignore */
  }
  return base;
}

export function applyThemeToRoot(theme) {
  const root = document.documentElement;
  const merged = { ...DEFAULT_THEME, ...theme };
  Object.keys(DEFAULT_THEME).forEach((key) => {
    const value = merged[key];
    if (value) root.style.setProperty(key, value);
  });
  const primary = merged['--primary'];
  if (primary) {
    root.style.setProperty('--primary-rgb', hexToRgbTriplet(primary));
  }
}

export function applySavedTheme() {
  applyThemeToRoot(getMergedTheme());
}

export function persistTheme(partial) {
  const next = { ...getMergedTheme(), ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  applyThemeToRoot(next);
}

export function resetTheme() {
  localStorage.removeItem(STORAGE_KEY);
  applyThemeToRoot(DEFAULT_THEME);
}
