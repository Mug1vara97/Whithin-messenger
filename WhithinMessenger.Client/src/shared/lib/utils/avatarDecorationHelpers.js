import { MEDIA_BASE_URL } from '../constants/apiEndpoints';

export const AVATAR_DECORATION_UI_ENABLED = true;

/** Рекомендуемый размер (как у Discord Avatar Decoration). */
export const AVATAR_DECORATION_RECOMMENDED_SIZE = 256;
export const AVATAR_DECORATION_RECOMMENDED_INNER_HOLE = 160;

export const AVATAR_DECORATION_ALLOWED_EXTENSIONS = [
  '.png', '.apng', '.gif', '.webp', '.webm', '.mp4', '.mov',
];

export const AVATAR_DECORATION_FORMATS_ERROR =
  'Допустимы MP4, WebM, PNG/APNG, GIF или WebP (.mp4, .webm, .png, .apng, .gif, .webp)';

export const AVATAR_DECORATION_ACCEPT =
  'video/mp4,video/webm,image/png,image/gif,image/webp,.mp4,.mov,.webm,.png,.apng,.gif,.webp';

export const AVATAR_DECORATION_SPEC_HINT =
  `WebM (VP9 с альфой) — лучший вариант для анимации в Chrome/Electron. Также PNG/APNG, GIF или WebP. ` +
  `~${AVATAR_DECORATION_RECOMMENDED_SIZE}×${AVATAR_DECORATION_RECOMMENDED_SIZE} px, прозрачный центр ~${AVATAR_DECORATION_RECOMMENDED_INNER_HOLE}×${AVATAR_DECORATION_RECOMMENDED_INNER_HOLE} px.`;

export const TEST_AVATAR_DECORATION_PATH = '/avatar-decoration-test.webp';

const GENERIC_MIME_TYPES = new Set(['', 'application/octet-stream']);

const EXTENSION_MIME_TYPES = {
  '.png': new Set(['image/png']),
  '.apng': new Set(['image/png', 'image/apng']),
  '.gif': new Set(['image/gif']),
  '.webp': new Set(['image/webp']),
  '.webm': new Set(['video/webm', 'video/x-matroska']),
  '.mp4': new Set(['video/mp4']),
  '.mov': new Set(['video/quicktime', 'video/mp4']),
};

function resolveAvatarDecorationExtension(fileName) {
  const lower = String(fileName || '').toLowerCase();

  if (lower.endsWith('.apng')) return '.apng';
  if (lower.endsWith('.webm')) return '.webm';
  if (lower.endsWith('.mp4')) return '.mp4';
  if (lower.endsWith('.mov')) return '.mov';
  if (lower.endsWith('.webp')) return '.webp';
  if (lower.endsWith('.png')) return '.png';
  if (lower.endsWith('.gif')) return '.gif';

  return null;
}

function isAllowedMimeForExtension(extension, mimeType) {
  if (GENERIC_MIME_TYPES.has(mimeType)) {
    return true;
  }

  return EXTENSION_MIME_TYPES[extension]?.has(mimeType) ?? false;
}

export function isAvatarDecorationVideoUrl(url) {
  return /\.(webm|mp4|mov)(?:[?#]|$)/i.test(String(url || ''));
}

export function isAvatarDecorationFile(file) {
  if (!file) return false;

  const extension = resolveAvatarDecorationExtension(file.name);
  if (!extension) return false;

  const mimeType = String(file.type || '').toLowerCase();
  return isAllowedMimeForExtension(extension, mimeType);
}

/** @deprecated use isAvatarDecorationFile */
export function isAvatarDecorationWebpFile(file) {
  return isAvatarDecorationFile(file);
}

export function validateAvatarDecorationFile(file) {
  if (!file) {
    throw new Error('Файл не выбран');
  }

  if (!isAvatarDecorationFile(file)) {
    throw new Error(AVATAR_DECORATION_FORMATS_ERROR);
  }
}

export function resolveAvatarDecorationUrl(avatarDecoration) {
  if (!avatarDecoration) return null;
  if (avatarDecoration.startsWith('http://') || avatarDecoration.startsWith('https://')) {
    return avatarDecoration;
  }
  if (avatarDecoration.startsWith('/')) {
    return `${MEDIA_BASE_URL}${avatarDecoration}`;
  }
  return avatarDecoration;
}

export function getMemberAvatarDecoration(member) {
  return member?.avatarDecoration ?? member?.AvatarDecoration ?? null;
}
