export const formatTime = (value) => {
  const total = Math.max(0, Math.floor(Number(value) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
};

export const formatTotal = (tracks) => {
  const minutes = Math.round(tracks.reduce((sum, t) => sum + (t.durationSeconds || 0), 0) / 60);
  if (minutes < 60) return `${minutes} мин`;
  return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
};

export const pluralTracks = (n) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} трек`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} трека`;
  return `${n} треков`;
};

const plural = (n, one, few, many) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

export const formatSubscribers = (n) => {
  if (!n) return null;
  const short = (value, unit) => `${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} ${unit}`;
  if (n >= 1e6) return `${short(n / 1e6, 'млн')} подписчиков`;
  if (n >= 1e3) return `${short(n / 1e3, 'тыс.')} подписчиков`;
  return `${n} ${plural(n, 'подписчик', 'подписчика', 'подписчиков')}`;
};

export const ALBUM_KIND = { album: 'Альбом', single: 'Сингл', ep: 'EP' };

export const describeError = (error) => {
  const text = String(error?.message || error || '');
  if (text.startsWith('unavailable:')) return 'Трек недоступен';
  if (text.startsWith('network:')) return 'Нет соединения с YouTube';
  if (text.startsWith('output:')) return 'Нет устройства вывода звука';
  return 'Не удалось загрузить';
};
