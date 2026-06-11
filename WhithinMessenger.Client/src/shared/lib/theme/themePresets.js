export const THEME_PRESET_STORAGE_KEY = 'whithin-app-theme-preset';

export const THEME_PRESET_IDS = {
  DEFAULT: 'default',
};

/** @type {Record<string, { id: string, name: string, description?: string, colors: Record<string, string> | null }>} */
export const THEME_PRESETS = {
  [THEME_PRESET_IDS.DEFAULT]: {
    id: THEME_PRESET_IDS.DEFAULT,
    name: 'По умолчанию',
    description: 'Стандартная тёмная тема Whithin',
    colors: null,
  },
};

export const THEME_PRESET_LIST = Object.values(THEME_PRESETS);

export function getThemePresetId() {
  try {
    const saved = localStorage.getItem(THEME_PRESET_STORAGE_KEY);
    if (saved && THEME_PRESETS[saved]) return saved;
  } catch {
    /* ignore */
  }
  return THEME_PRESET_IDS.DEFAULT;
}

export function getBaseThemeForPreset(presetId, defaultTheme) {
  const preset = THEME_PRESETS[presetId] || THEME_PRESETS[THEME_PRESET_IDS.DEFAULT];
  if (!preset.colors) return { ...defaultTheme };
  return { ...defaultTheme, ...preset.colors };
}

export function applyThemePresetAttribute(presetId = getThemePresetId()) {
  const root = document.documentElement;
  if (presetId && presetId !== THEME_PRESET_IDS.DEFAULT) {
    root.setAttribute('data-theme-preset', presetId);
  } else {
    root.removeAttribute('data-theme-preset');
  }
}
