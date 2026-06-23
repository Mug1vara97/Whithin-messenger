const STORAGE_KEY = 'whithin-interface-design';
const CHANGE_EVENT = 'interfaceDesignChanged';

const LEGACY_ROUNDED_DESIGN_ID = 'midnight';

export const INTERFACE_DESIGN_IDS = {
  DEFAULT: 'default',
  ROUNDED: 'rounded',
  SYSTEM24: 'system24',
};

export const INTERFACE_DESIGNS = [
  {
    id: INTERFACE_DESIGN_IDS.DEFAULT,
    name: 'По умолчанию',
    description: 'Стандартный интерфейс Whithin в духе Discord.',
  },
  {
    id: INTERFACE_DESIGN_IDS.ROUNDED,
    name: 'Закруглённая',
    description: 'Отделённые панели со скруглёнными углами и зазорами между блоками.',
  },
  {
    id: INTERFACE_DESIGN_IDS.SYSTEM24,
    name: 'System24 (TUI)',
    description: 'Терминальный стиль: моноширинный шрифт, острые углы, рамки и подписи панелей.',
    suggestedThemeId: 'system24',
  },
];

export function getInterfaceDesignId() {
  if (typeof window === 'undefined') {
    return INTERFACE_DESIGN_IDS.DEFAULT;
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === LEGACY_ROUNDED_DESIGN_ID) {
      localStorage.setItem(STORAGE_KEY, INTERFACE_DESIGN_IDS.ROUNDED);
      return INTERFACE_DESIGN_IDS.ROUNDED;
    }
    if (saved && INTERFACE_DESIGNS.some((item) => item.id === saved)) {
      return saved;
    }
  } catch {
    /* ignore */
  }

  return INTERFACE_DESIGN_IDS.DEFAULT;
}

export function persistInterfaceDesign(designId) {
  const normalizedDesignId = designId === LEGACY_ROUNDED_DESIGN_ID
    ? INTERFACE_DESIGN_IDS.ROUNDED
    : designId;
  const nextId = INTERFACE_DESIGNS.some((item) => item.id === normalizedDesignId)
    ? normalizedDesignId
    : INTERFACE_DESIGN_IDS.DEFAULT;

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, nextId);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { designId: nextId } }));
  }

  applyInterfaceDesign(nextId);
  return nextId;
}

export function applyInterfaceDesign(designId = getInterfaceDesignId()) {
  if (typeof document === 'undefined') {
    return designId;
  }

  const normalizedDesignId = designId === LEGACY_ROUNDED_DESIGN_ID
    ? INTERFACE_DESIGN_IDS.ROUNDED
    : designId;
  const root = document.documentElement;
  if (!normalizedDesignId || normalizedDesignId === INTERFACE_DESIGN_IDS.DEFAULT) {
    root.removeAttribute('data-interface-design');
  } else {
    root.setAttribute('data-interface-design', normalizedDesignId);
  }

  return normalizedDesignId;
}

export function applySavedInterfaceDesign() {
  return applyInterfaceDesign(getInterfaceDesignId());
}

export function subscribeInterfaceDesign(callback) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = (event) => {
    callback(event.detail?.designId ?? getInterfaceDesignId());
  };

  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
