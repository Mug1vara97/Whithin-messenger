import { AVATAR_FRAME_NAMES } from './avatarFrameNames';

const DEFAULT_EXTENSION = 'png';

export function getAvatarFrameExtension(frameId) {
  const id = String(frameId ?? '').trim();
  if (!id) return DEFAULT_EXTENSION;
  return AVATAR_FRAME_NAMES[id]?.extension ?? DEFAULT_EXTENSION;
}

export function getLocalAvatarFramePath(frameId) {
  const id = String(frameId ?? '').trim();
  if (!id) return '';
  const extension = getAvatarFrameExtension(id);
  return `/avatar-frames/${id}.${extension}`;
}

/** Извлекает id рамки из локального пути или из сохранённого внешнего URL. */
export function extractAvatarFrameId(path) {
  if (!path) return null;
  const value = String(path);

  const localMatch = value.match(/\/avatar-frames\/([^/?#]+)\.[a-z0-9]+/i);
  if (localMatch?.[1] && AVATAR_FRAME_NAMES[localMatch[1]]) {
    return localMatch[1];
  }

  const segments = value.match(/\d{17,}/g);
  if (!segments) return null;

  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const id = segments[i];
    if (AVATAR_FRAME_NAMES[id]) return id;
  }

  return null;
}
