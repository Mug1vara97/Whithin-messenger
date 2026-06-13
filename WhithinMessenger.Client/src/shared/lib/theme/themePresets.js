export const THEME_PRESET_STORAGE_KEY = 'whithin-app-theme-preset';

export const THEME_PRESET_IDS = {
  DEFAULT: 'default',
  WHITHIN: 'whithin',
  TWILIGHT: 'twilight',
  AMETHYST: 'amethyst',
  EMBER: 'ember',
  FOREST: 'forest',
  COAL: 'coal',
  MIDNIGHT: 'midnight',
  LIGHT: 'light',
  LIGHT_CREAM: 'light-cream',
  SAKURA: 'sakura',
  OCEAN: 'ocean',
  SUNSET: 'sunset',
  SLATE: 'slate',
  NEON: 'neon',
  WINE: 'wine',
  MINT_DAY: 'mint-day',
  SKY_DAY: 'sky-day',
  COPPER: 'copper',
  BUBBLEGUM: 'bubblegum',
  PAPER: 'paper',
  CYBERPUNK: 'cyberpunk',
  ACID: 'acid',
  NIGHT_CITY: 'night-city',
};

/** @type {Record<string, { id: string, name: string, description?: string, colors: Record<string, string> | null }>} */
export const THEME_PRESETS = {
  [THEME_PRESET_IDS.DEFAULT]: {
    id: THEME_PRESET_IDS.DEFAULT,
    name: 'По умолчанию',
    description: 'Классическая тёмная тема в духе Discord',
    colors: null,
  },
  [THEME_PRESET_IDS.WHITHIN]: {
    id: THEME_PRESET_IDS.WHITHIN,
    name: 'Whithin',
    description: 'Фирменная тёмная палитра Whithin с красным акцентом',
    colors: {
      '--background': '#141010',
      '--background-primary': '#080606',
      '--background-secondary': '#1a1212',
      '--surface': '#221616',
      '--surface-hover': '#2e1a1a',
      '--text': '#ffffff',
      '--text-muted': '#9a8585',
      '--text-secondary': '#c9b5b5',
      '--primary': '#e60012',
      '--primary-hover': '#b8000e',
      '--border': '#4a2020',
      '--server-list-background': '#000000',
    },
  },
  [THEME_PRESET_IDS.TWILIGHT]: {
    id: THEME_PRESET_IDS.TWILIGHT,
    name: 'Сумерки',
    description: 'Холодные синие оттенки и бирюзовый акцент — мягче для глаз ночью',
    colors: {
      '--background': '#1a1f2e',
      '--background-primary': '#151925',
      '--background-secondary': '#212738',
      '--surface': '#252b3a',
      '--surface-hover': '#2f3647',
      '--text': '#e8ecf4',
      '--text-muted': '#8b93a7',
      '--text-secondary': '#aab2c4',
      '--primary': '#38bdf8',
      '--primary-hover': '#0ea5e9',
      '--border': '#343b4f',
      '--server-list-background': '#111520',
    },
  },
  [THEME_PRESET_IDS.AMETHYST]: {
    id: THEME_PRESET_IDS.AMETHYST,
    name: 'Аметист',
    description: 'Тёплые фиолетовые тона и лавандовый акцент — уютная атмосфера',
    colors: {
      '--background': '#1f1a24',
      '--background-primary': '#18141f',
      '--background-secondary': '#262030',
      '--surface': '#2d2736',
      '--surface-hover': '#3a3344',
      '--text': '#f3eef8',
      '--text-muted': '#9d93ad',
      '--text-secondary': '#b8afc4',
      '--primary': '#a78bfa',
      '--primary-hover': '#8b5cf6',
      '--border': '#423a4f',
      '--server-list-background': '#141019',
    },
  },
  [THEME_PRESET_IDS.EMBER]: {
    id: THEME_PRESET_IDS.EMBER,
    name: 'Янтарь',
    description: 'Тёплые коричневые оттенки и янтарный акцент — как вечерний свет',
    colors: {
      '--background': '#221e1a',
      '--background-primary': '#1a1714',
      '--background-secondary': '#2a2520',
      '--surface': '#322c26',
      '--surface-hover': '#3d3630',
      '--text': '#f5f0ea',
      '--text-muted': '#a89a8c',
      '--text-secondary': '#c4b8aa',
      '--primary': '#f59e0b',
      '--primary-hover': '#d97706',
      '--border': '#4a4239',
      '--server-list-background': '#141210',
    },
  },
  [THEME_PRESET_IDS.FOREST]: {
    id: THEME_PRESET_IDS.FOREST,
    name: 'Лес',
    description: 'Глубокие зелёные тона и изумрудный акцент — спокойная природная палитра',
    colors: {
      '--background': '#1a211c',
      '--background-primary': '#141a16',
      '--background-secondary': '#212a23',
      '--surface': '#28332b',
      '--surface-hover': '#323f35',
      '--text': '#ecf3ee',
      '--text-muted': '#8a9a8f',
      '--text-secondary': '#a8b8ad',
      '--primary': '#34d399',
      '--primary-hover': '#10b981',
      '--border': '#36443a',
      '--server-list-background': '#101512',
    },
  },
  [THEME_PRESET_IDS.COAL]: {
    id: THEME_PRESET_IDS.COAL,
    name: 'Уголь',
    description: 'Почти чёрная OLED-палитра — максимальный контраст и минимум отвлекающих оттенков',
    colors: {
      '--background': '#0a0a0a',
      '--background-primary': '#050505',
      '--background-secondary': '#111111',
      '--surface': '#171717',
      '--surface-hover': '#212121',
      '--text': '#f5f5f5',
      '--text-muted': '#737373',
      '--text-secondary': '#a3a3a3',
      '--primary': '#a1a1aa',
      '--primary-hover': '#d4d4d4',
      '--border': '#2a2a2a',
      '--server-list-background': '#000000',
    },
  },
  [THEME_PRESET_IDS.MIDNIGHT]: {
    id: THEME_PRESET_IDS.MIDNIGHT,
    name: 'Полночь',
    description: 'Глубокий индиго и мягкий перiwinkle-акцент — спокойная ночная палитра',
    colors: {
      '--background': '#16162a',
      '--background-primary': '#0f0f1a',
      '--background-secondary': '#1c1c32',
      '--surface': '#222240',
      '--surface-hover': '#2c2c50',
      '--text': '#ececf4',
      '--text-muted': '#8b8ba8',
      '--text-secondary': '#b0b0cc',
      '--primary': '#7c89ff',
      '--primary-hover': '#6370e8',
      '--border': '#34345a',
      '--server-list-background': '#0a0a14',
    },
  },
  [THEME_PRESET_IDS.LIGHT]: {
    id: THEME_PRESET_IDS.LIGHT,
    name: 'Светлая',
    description: 'Светлые поверхности и тёмный текст — удобно днём и при ярком освещении',
    colors: {
      '--background': '#ffffff',
      '--background-primary': '#f2f3f5',
      '--background-secondary': '#ebedef',
      '--surface': '#f2f3f5',
      '--surface-hover': '#e3e5e8',
      '--text': '#060607',
      '--text-muted': '#5e626a',
      '--text-secondary': '#46484d',
      '--primary': '#5865f2',
      '--primary-hover': '#4752c4',
      '--border': '#dce0e6',
      '--server-list-background': '#e3e5e8',
      '--icon': '#5e626a',
      '--icon-hover': '#060607',
    },
  },
  [THEME_PRESET_IDS.LIGHT_CREAM]: {
    id: THEME_PRESET_IDS.LIGHT_CREAM,
    name: 'Молочная',
    description: 'Тёплые кремовые тона и мягкий карамельный акцент — уютно и спокойно днём',
    colors: {
      '--background': '#faf8f5',
      '--background-primary': '#f3f0eb',
      '--background-secondary': '#ebe6df',
      '--surface': '#f3f0eb',
      '--surface-hover': '#e8e3db',
      '--text': '#1a1816',
      '--text-muted': '#6b6560',
      '--text-secondary': '#4a4541',
      '--primary': '#9a8268',
      '--primary-hover': '#807055',
      '--border': '#ddd6cc',
      '--server-list-background': '#ebe6df',
      '--icon': '#6b6560',
      '--icon-hover': '#1a1816',
    },
  },
  [THEME_PRESET_IDS.SAKURA]: {
    id: THEME_PRESET_IDS.SAKURA,
    name: 'Сакура',
    description: 'Тёмно-розовые тона и нежный акцент — спокойная весенняя палитра',
    colors: {
      '--background': '#1f181b',
      '--background-primary': '#181216',
      '--background-secondary': '#271e23',
      '--surface': '#2d2329',
      '--surface-hover': '#3a2e36',
      '--text': '#fce7f3',
      '--text-muted': '#a78b9a',
      '--text-secondary': '#d4aeb8',
      '--primary': '#f472b6',
      '--primary-hover': '#ec4899',
      '--border': '#4a3540',
      '--server-list-background': '#141018',
    },
  },
  [THEME_PRESET_IDS.OCEAN]: {
    id: THEME_PRESET_IDS.OCEAN,
    name: 'Океан',
    description: 'Глубокие сине-зелёные оттенки и бирюзовый акцент — как глубина моря',
    colors: {
      '--background': '#0f1a22',
      '--background-primary': '#0a1419',
      '--background-secondary': '#152530',
      '--surface': '#1a2e3a',
      '--surface-hover': '#243a48',
      '--text': '#e0f2fe',
      '--text-muted': '#7da3b8',
      '--text-secondary': '#a8c5d4',
      '--primary': '#22d3ee',
      '--primary-hover': '#06b6d4',
      '--border': '#2a4554',
      '--server-list-background': '#060e12',
    },
  },
  [THEME_PRESET_IDS.SUNSET]: {
    id: THEME_PRESET_IDS.SUNSET,
    name: 'Закат',
    description: 'Тёплые терракотовые тона и оранжевый акцент — мягкий вечерний свет',
    colors: {
      '--background': '#221a18',
      '--background-primary': '#1a1412',
      '--background-secondary': '#2a211e',
      '--surface': '#322825',
      '--surface-hover': '#3f332f',
      '--text': '#fef3e8',
      '--text-muted': '#b09a8c',
      '--text-secondary': '#d4c0b0',
      '--primary': '#fb923c',
      '--primary-hover': '#f97316',
      '--border': '#4a3d36',
      '--server-list-background': '#141010',
    },
  },
  [THEME_PRESET_IDS.SLATE]: {
    id: THEME_PRESET_IDS.SLATE,
    name: 'Графит',
    description: 'Нейтральные серо-синие тона — сдержанная профессиональная палитра',
    colors: {
      '--background': '#1c1f26',
      '--background-primary': '#15171c',
      '--background-secondary': '#252830',
      '--surface': '#2c303a',
      '--surface-hover': '#363b48',
      '--text': '#e8eaed',
      '--text-muted': '#8b919d',
      '--text-secondary': '#aeb4bf',
      '--primary': '#94a3b8',
      '--primary-hover': '#64748b',
      '--border': '#3d4450',
      '--server-list-background': '#121418',
    },
  },
  [THEME_PRESET_IDS.NEON]: {
    id: THEME_PRESET_IDS.NEON,
    name: 'Неон',
    description: 'Чёрный OLED-фон и кислотно-зелёный акцент — контраст в стиле терминала',
    colors: {
      '--background': '#050805',
      '--background-primary': '#020402',
      '--background-secondary': '#0a120a',
      '--surface': '#0f180f',
      '--surface-hover': '#162216',
      '--text': '#eaffea',
      '--text-muted': '#6b8f6b',
      '--text-secondary': '#9fcf9f',
      '--primary': '#39ff14',
      '--primary-hover': '#22c55e',
      '--border': '#1a3a1a',
      '--server-list-background': '#000000',
    },
  },
  [THEME_PRESET_IDS.WINE]: {
    id: THEME_PRESET_IDS.WINE,
    name: 'Вино',
    description: 'Глубокий бордовый фон и золотой акцент — тёплая «камерная» атмосфера',
    colors: {
      '--background': '#1a0b10',
      '--background-primary': '#12070b',
      '--background-secondary': '#241018',
      '--surface': '#2d141c',
      '--surface-hover': '#3a1a25',
      '--text': '#f8ece8',
      '--text-muted': '#a67a82',
      '--text-secondary': '#c9a0a8',
      '--primary': '#d4af37',
      '--primary-hover': '#b8922e',
      '--border': '#4a2430',
      '--server-list-background': '#0d0508',
    },
  },
  [THEME_PRESET_IDS.COPPER]: {
    id: THEME_PRESET_IDS.COPPER,
    name: 'Медь',
    description: 'Тёмный сине-зелёный фон и медно-оранжевый акцент — индustrial-палитра',
    colors: {
      '--background': '#101816',
      '--background-primary': '#0a100e',
      '--background-secondary': '#162220',
      '--surface': '#1c2b28',
      '--surface-hover': '#243632',
      '--text': '#e8f0ed',
      '--text-muted': '#7a948c',
      '--text-secondary': '#a3bdb4',
      '--primary': '#e09540',
      '--primary-hover': '#c47a2a',
      '--border': '#2d4540',
      '--server-list-background': '#060b0a',
    },
  },
  [THEME_PRESET_IDS.BUBBLEGUM]: {
    id: THEME_PRESET_IDS.BUBBLEGUM,
    name: 'Жвачка',
    description: 'Тёмная фуксия и ярко-розовый акцент — смелая pop-палитра, не похожая на «Сакуру»',
    colors: {
      '--background': '#180818',
      '--background-primary': '#100410',
      '--background-secondary': '#240c24',
      '--surface': '#2d1030',
      '--surface-hover': '#3a1540',
      '--text': '#ffe8fb',
      '--text-muted': '#c77ab8',
      '--text-secondary': '#e8a8dc',
      '--primary': '#ff2d95',
      '--primary-hover': '#e6007a',
      '--border': '#4a2050',
      '--server-list-background': '#0c040c',
    },
  },
  [THEME_PRESET_IDS.MINT_DAY]: {
    id: THEME_PRESET_IDS.MINT_DAY,
    name: 'Мята',
    description: 'Светлая мятная палитра с изумрудным акцентом — свежо и спокойно днём',
    colors: {
      '--background': '#f0fdf7',
      '--background-primary': '#e6faf1',
      '--background-secondary': '#dcf5ea',
      '--surface': '#e6faf1',
      '--surface-hover': '#d4f0e3',
      '--text': '#0f2e24',
      '--text-muted': '#4d7366',
      '--text-secondary': '#2f5548',
      '--primary': '#059669',
      '--primary-hover': '#047857',
      '--border': '#b8e6d0',
      '--server-list-background': '#dcf5ea',
      '--icon': '#4d7366',
      '--icon-hover': '#0f2e24',
    },
  },
  [THEME_PRESET_IDS.SKY_DAY]: {
    id: THEME_PRESET_IDS.SKY_DAY,
    name: 'Небо',
    description: 'Светло-голубая палитра с насыщенным синим акцентом — ясный дневной интерфейс',
    colors: {
      '--background': '#f0f7ff',
      '--background-primary': '#e3effc',
      '--background-secondary': '#d6e8fa',
      '--surface': '#e3effc',
      '--surface-hover': '#cfe0f5',
      '--text': '#0c1a33',
      '--text-muted': '#4a6280',
      '--text-secondary': '#2f4563',
      '--primary': '#2563eb',
      '--primary-hover': '#1d4ed8',
      '--border': '#c5d9f2',
      '--server-list-background': '#d6e8fa',
      '--icon': '#4a6280',
      '--icon-hover': '#0c1a33',
    },
  },
  [THEME_PRESET_IDS.PAPER]: {
    id: THEME_PRESET_IDS.PAPER,
    name: 'Бумага',
    description: 'Тёплый светлый фон с терракотовым акцентом — как блокнот, не похож на «Молочную»',
    colors: {
      '--background': '#faf6f0',
      '--background-primary': '#f3ede4',
      '--background-secondary': '#ebe3d6',
      '--surface': '#f3ede4',
      '--surface-hover': '#e6ddd0',
      '--text': '#2a2218',
      '--text-muted': '#7a6e5e',
      '--text-secondary': '#544a3c',
      '--primary': '#c45c26',
      '--primary-hover': '#a34a1c',
      '--border': '#d9cfc0',
      '--server-list-background': '#ebe3d6',
      '--icon': '#7a6e5e',
      '--icon-hover': '#2a2218',
    },
  },
  [THEME_PRESET_IDS.CYBERPUNK]: {
    id: THEME_PRESET_IDS.CYBERPUNK,
    name: 'Киберпанк',
    description: 'Стиль Cyberpunk 2077: красный интерфейс, cyan — входящие, жёлтый — исходящие',
    colors: {
      '--background': '#0c0808',
      '--background-primary': '#080606',
      '--background-secondary': '#120c0c',
      '--surface': '#161010',
      '--surface-hover': '#201818',
      '--text': '#fcee09',
      '--text-muted': '#c9ba00',
      '--text-secondary': '#e8d908',
      '--primary': '#00f0f0',
      '--primary-hover': '#00c4d4',
      '--border': '#5c1820',
      '--server-list-background': '#060404',
      '--icon': '#fcee09',
      '--icon-hover': '#fff176',
      '--text-on-primary': '#0a0a0a',
    },
  },
  [THEME_PRESET_IDS.ACID]: {
    id: THEME_PRESET_IDS.ACID,
    name: 'Кислота',
    description: 'Кислотно-зелёный акцент на глубоком фиолетовом фоне — контраст комплементарных цветов',
    colors: {
      '--background': '#140a1c',
      '--background-primary': '#0c0612',
      '--background-secondary': '#1c1028',
      '--surface': '#241432',
      '--surface-hover': '#301a42',
      '--text': '#f0ffe8',
      '--text-muted': '#a890c0',
      '--text-secondary': '#c8b8e0',
      '--primary': '#ccff00',
      '--primary-hover': '#a8d900',
      '--border': '#5a2080',
      '--server-list-background': '#080410',
    },
  },
  [THEME_PRESET_IDS.NIGHT_CITY]: {
    id: THEME_PRESET_IDS.NIGHT_CITY,
    name: 'Night City',
    description: 'Неоновый cyan и жёлтые акценты на глубоком чёрном — атмосфера ночного мегаполиса',
    colors: {
      '--background': '#101010',
      '--background-primary': '#0a0a0a',
      '--background-secondary': '#161616',
      '--surface': '#1a1a1a',
      '--surface-hover': '#242424',
      '--text': '#4ee2c0',
      '--text-muted': '#4ee2c0',
      '--text-secondary': '#4ee2c0',
      '--primary': '#fcee09',
      '--primary-hover': '#d4c908',
      '--border': '#3a3820',
      '--server-list-background': '#060606',
      '--text-on-primary': '#0a0a0a',
    },
  },
};

export const THEME_PRESET_LIST = Object.values(THEME_PRESETS);

const LIGHT_THEME_PRESET_IDS = new Set([
  THEME_PRESET_IDS.LIGHT,
  THEME_PRESET_IDS.LIGHT_CREAM,
  THEME_PRESET_IDS.MINT_DAY,
  THEME_PRESET_IDS.SKY_DAY,
  THEME_PRESET_IDS.PAPER,
]);

export function isLightThemePreset(presetId) {
  return LIGHT_THEME_PRESET_IDS.has(presetId);
}

export function getThemePresetId() {
  try {
    const saved = localStorage.getItem(THEME_PRESET_STORAGE_KEY);
    if (saved === 'persona5') {
      localStorage.setItem(THEME_PRESET_STORAGE_KEY, THEME_PRESET_IDS.MIDNIGHT);
      return THEME_PRESET_IDS.MIDNIGHT;
    }
    if (saved === 'whithin-scarlet') {
      localStorage.setItem(THEME_PRESET_STORAGE_KEY, THEME_PRESET_IDS.WHITHIN);
      return THEME_PRESET_IDS.WHITHIN;
    }
    if (saved === 'nord') {
      localStorage.setItem(THEME_PRESET_STORAGE_KEY, THEME_PRESET_IDS.SLATE);
      return THEME_PRESET_IDS.SLATE;
    }
    if (saved === 'whithin') {
      try {
        const themeRaw = localStorage.getItem('whithin-app-theme');
        const theme = themeRaw ? JSON.parse(themeRaw) : null;
        if (theme?.['--primary'] === '#5865f2' && theme?.['--background'] === '#1e1f22') {
          localStorage.setItem(THEME_PRESET_STORAGE_KEY, THEME_PRESET_IDS.DEFAULT);
          return THEME_PRESET_IDS.DEFAULT;
        }
      } catch {
        /* ignore */
      }
    }
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
  if (isLightThemePreset(presetId)) {
    root.setAttribute('data-theme-mode', 'light');
  } else {
    root.removeAttribute('data-theme-mode');
  }
}
