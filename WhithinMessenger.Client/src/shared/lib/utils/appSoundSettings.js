const STORAGE_KEY = 'appCustomSounds';
const MAX_CUSTOM_SOUND_BYTES = 2 * 1024 * 1024;

export const APP_SOUND_DEFINITIONS = [
  {
    id: 'messageNotification',
    label: 'Новое сообщение',
    description: 'Звук при входящем уведомлении о сообщении.',
    defaultUrl: '/notification-sound.mp3',
  },
  {
    id: 'incomingCall',
    label: 'Входящий звонок',
    description: 'Мелодия при входящем звонке.',
    defaultUrl: '/den-den-mushi.mp3',
  },
  {
    id: 'userJoined',
    label: 'Участник подключился',
    description: 'Кто-то зашёл в голосовой канал.',
    defaultUrl: '/patriot.mp3',
  },
  {
    id: 'userLeft',
    label: 'Участник вышел',
    description: 'Кто-то покинул голосовой канал.',
    defaultUrl: '/user-left.mp3',
  },
  {
    id: 'micMuted',
    label: 'Микрофон выключен',
    description: 'Локальное переключение микрофона.',
    defaultUrl: '/mic-muted.mp3',
  },
  {
    id: 'micUnmuted',
    label: 'Микрофон включён',
    description: 'Локальное включение микрофона.',
    defaultUrl: '/mic-unmuted.mp3',
  },
  {
    id: 'globalMuted',
    label: 'Наушники выключены',
    description: 'Локальное отключение звука.',
    defaultUrl: '/global-muted.mp3',
  },
  {
    id: 'globalUnmuted',
    label: 'Наушники включены',
    description: 'Локальное включение звука.',
    defaultUrl: '/global-unmuted.mp3',
  },
];

const DEFAULT_URLS = Object.fromEntries(
  APP_SOUND_DEFINITIONS.map((item) => [item.id, item.defaultUrl]),
);

function readCustomSounds() {
  if (typeof window === 'undefined') return {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeCustomSounds(map) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent('appSoundSettingsChanged'));
}

export function getAppSoundUrl(soundId) {
  const custom = readCustomSounds()[soundId];
  if (typeof custom === 'string' && custom.trim()) {
    return custom.trim();
  }
  return DEFAULT_URLS[soundId] || null;
}

export function getAppCustomSound(soundId) {
  const custom = readCustomSounds()[soundId];
  return typeof custom === 'string' && custom.trim() ? custom.trim() : null;
}

export function setAppCustomSound(soundId, dataUrl) {
  if (!DEFAULT_URLS[soundId]) return;

  const next = { ...readCustomSounds() };
  if (!dataUrl) {
    delete next[soundId];
  } else {
    next[soundId] = dataUrl;
  }
  writeCustomSounds(next);
}

export function resetAppCustomSound(soundId) {
  setAppCustomSound(soundId, null);
}

export function resetAllAppCustomSounds() {
  writeCustomSounds({});
}

export function hasCustomAppSound(soundId) {
  return Boolean(getAppCustomSound(soundId));
}

export async function readCustomSoundFile(file) {
  if (!file) {
    throw new Error('Файл не выбран');
  }
  if (!file.type.startsWith('audio/')) {
    throw new Error('Нужен аудиофайл (MP3, WAV, OGG и т.д.)');
  }
  if (file.size > MAX_CUSTOM_SOUND_BYTES) {
    throw new Error('Файл слишком большой (максимум 2 МБ)');
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });

  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    throw new Error('Неподдерживаемый формат аудио');
  }

  return dataUrl;
}

export function playAppSoundPreview(soundId, volume = 0.6) {
  const url = getAppSoundUrl(soundId);
  if (!url || typeof window === 'undefined') return;

  const audio = new Audio(url);
  audio.volume = Math.min(1, Math.max(0, volume));
  audio.play().catch(() => {});
}
