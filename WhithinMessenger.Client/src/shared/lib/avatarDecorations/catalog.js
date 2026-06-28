import { AVATAR_FRAME_NAMES } from './avatarFrameNames';
import { extractAvatarFrameId, getLocalAvatarFramePath } from './avatarFramePaths';

const DEFAULT_DESCRIPTION = 'Новый вид для вашего аватара.';

const CATALOG_FRAME_IDS = Object.keys(AVATAR_FRAME_NAMES);

function buildCatalogEntry(frameId) {
  const meta = AVATAR_FRAME_NAMES[frameId];
  return {
    id: frameId,
    path: getLocalAvatarFramePath(frameId),
    name: meta.name,
    description: meta.description ?? DEFAULT_DESCRIPTION,
  };
}

/**
 * Каталог рамок аватара.
 * path — локальный файл /avatar-frames/{id}.png, сохраняется в профиле (AvatarDecoration).
 */
export const AVATAR_DECORATION_CATALOG = CATALOG_FRAME_IDS.map(buildCatalogEntry);

export { getLocalAvatarFramePath, extractAvatarFrameId };

export function normalizeAvatarDecorationPath(path) {
  if (!path) return '';
  const value = String(path).trim();

  const frameId = extractAvatarFrameId(value);
  if (frameId) {
    return getLocalAvatarFramePath(frameId).toLowerCase();
  }

  const lower = value.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    try {
      const url = new URL(lower);
      return url.href.toLowerCase();
    } catch {
      return lower;
    }
  }

  return lower.split('?')[0];
}

export function findCatalogDecorationByPath(path) {
  const normalized = normalizeAvatarDecorationPath(path);
  if (!normalized) return null;

  const frameId = extractAvatarFrameId(path);
  if (frameId) {
    return AVATAR_DECORATION_CATALOG.find((item) => item.id === frameId) ?? null;
  }

  return AVATAR_DECORATION_CATALOG.find(
    (item) => normalizeAvatarDecorationPath(item.path) === normalized,
  ) ?? null;
}

export function getAvatarDecorationPublicUrl(path) {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    const frameId = extractAvatarFrameId(path);
    if (frameId) {
      return getLocalAvatarFramePath(frameId);
    }
    return path;
  }
  return path.startsWith('/') ? path : `/${path}`;
}
