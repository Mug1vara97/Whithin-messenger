import { AVATAR_FRAME_NAMES } from './avatarFrameNames';

export function getLocalAvatarFramePath(frameId) {
  const id = String(frameId ?? '').trim();
  if (!id) return '';
  return `/avatar-frames/${id}.png`;
}

/** Извлекает id рамки из локального пути или из сохранённого внешнего URL. */
export function extractAvatarFrameId(path) {
  if (!path) return null;
  const value = String(path);

  const localMatch = value.match(/\/avatar-frames\/(\d+)\./i);
  if (localMatch?.[1]) return localMatch[1];

  const segments = value.match(/\d{17,}/g);
  if (!segments) return null;

  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const id = segments[i];
    if (AVATAR_FRAME_NAMES[id]) return id;
  }

  return null;
}
