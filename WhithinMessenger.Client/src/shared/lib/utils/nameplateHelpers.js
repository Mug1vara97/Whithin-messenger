import { MEDIA_BASE_URL } from '../constants/apiEndpoints';

export const NAMEPLATE_UI_ENABLED = true;

/** Static nameplate images. Animation is allowed only via WebP. */
export const NAMEPLATE_STATIC_EXTENSIONS = ['.png', '.jpg', '.jpeg'];
export const NAMEPLATE_ANIMATED_EXTENSIONS = ['.webp'];
export const NAMEPLATE_ALLOWED_EXTENSIONS = [
  ...NAMEPLATE_STATIC_EXTENSIONS,
  ...NAMEPLATE_ANIMATED_EXTENSIONS,
];

export const NAMEPLATE_ACCEPT = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';

export const NAMEPLATE_SPEC_HINT =
  'Статичные: PNG или JPEG. Анимация — только WebP (448×84, до 3 МБ).';

export const TEST_NAMEPLATE_PATH = '/sakura.webp';
export const DODO_NAMEPLATE_PATH = '/test.webp';

const GENERIC_MIME_TYPES = new Set(['', 'application/octet-stream']);

const EXTENSION_MIME_TYPES = {
  '.png': new Set(['image/png']),
  '.jpg': new Set(['image/jpeg', 'image/jpg', 'image/pjpeg']),
  '.jpeg': new Set(['image/jpeg', 'image/jpg', 'image/pjpeg']),
  '.webp': new Set(['image/webp']),
};

function resolveNameplateExtension(fileName) {
  const lower = String(fileName || '').toLowerCase();

  if (lower.endsWith('.jpeg')) return '.jpeg';
  if (lower.endsWith('.jpg')) return '.jpg';
  if (lower.endsWith('.webp')) return '.webp';
  if (lower.endsWith('.png')) return '.png';

  return null;
}

function isAllowedMimeForExtension(extension, mimeType) {
  if (GENERIC_MIME_TYPES.has(mimeType)) {
    return true;
  }

  return EXTENSION_MIME_TYPES[extension]?.has(mimeType) ?? false;
}

export function isNameplateFile(file) {
  if (!file) return false;

  const extension = resolveNameplateExtension(file.name);
  if (!extension) return false;

  const mimeType = String(file.type || '').toLowerCase();
  return isAllowedMimeForExtension(extension, mimeType);
}

export function validateNameplateFile(file) {
  if (!file) {
    throw new Error('Файл не выбран');
  }

  if (!isNameplateFile(file)) {
    throw new Error('Допустимы PNG, JPEG или WebP. Анимация — только WebP.');
  }
}

export function isAllowedNameplatePath(nameplate) {
  if (!nameplate) return true;

  const path = String(nameplate).split('?')[0].toLowerCase();
  return NAMEPLATE_ALLOWED_EXTENSIONS.some((ext) => path.endsWith(ext));
}

export function validateNameplatePath(nameplate) {
  if (!nameplate) return;

  if (!isAllowedNameplatePath(nameplate)) {
    throw new Error('Табличка: статичные PNG/JPEG или анимированный WebP.');
  }
}

export function resolveNameplateUrl(nameplate) {
  if (!nameplate) return null;
  if (nameplate.startsWith('http://') || nameplate.startsWith('https://')) {
    return nameplate;
  }
  if (nameplate.startsWith('/uploads')) {
    return `${MEDIA_BASE_URL}${nameplate}`;
  }
  return nameplate;
}

/** @deprecated Legacy WebM nameplates — no longer accepted for upload. */
export function isNameplateVideo(nameplate) {
  if (!nameplate) return false;
  return /\.webm($|\?)/i.test(nameplate);
}

export function isNameplateImage(nameplate) {
  if (!nameplate) return false;
  return /\.(png|jpe?g|webp)($|\?)/i.test(nameplate);
}

export function resolveMemberNameplate(member) {
  return member?.nameplate ?? member?.Nameplate ?? null;
}
