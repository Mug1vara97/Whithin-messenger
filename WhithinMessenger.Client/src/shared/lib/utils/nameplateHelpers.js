import { MEDIA_BASE_URL } from '../constants/apiEndpoints';

export const NAMEPLATE_UI_ENABLED = true;

export const NAMEPLATE_ALLOWED_EXTENSIONS = ['.webm', '.png', '.webp'];

export const NAMEPLATE_ACCEPT = 'video/webm,image/png,image/webp,.webm,.png,.webp';

export const NAMEPLATE_SPEC_HINT =
  'Форматы: WebP (анимация с прозрачностью), WebM (VP9, без звука) или PNG.';

export const TEST_NAMEPLATE_PATH = '/video.webm';
export const DODO_NAMEPLATE_PATH = '/Dodo.webm';

const GENERIC_MIME_TYPES = new Set(['', 'application/octet-stream']);

const EXTENSION_MIME_TYPES = {
  '.webm': new Set(['video/webm', 'video/x-matroska']),
  '.png': new Set(['image/png']),
  '.webp': new Set(['image/webp']),
};

function resolveNameplateExtension(fileName) {
  const lower = String(fileName || '').toLowerCase();

  if (lower.endsWith('.webm')) return '.webm';
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
    throw new Error('Допустимы WebM, PNG или WebP');
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

export function isNameplateVideo(nameplate) {
  if (!nameplate) return false;
  return /\.webm($|\?)/i.test(nameplate);
}

export function isNameplateImage(nameplate) {
  if (!nameplate) return false;
  return /\.(png|webp)($|\?)/i.test(nameplate);
}

export function resolveMemberNameplate(member) {
  return member?.nameplate ?? member?.Nameplate ?? null;
}
