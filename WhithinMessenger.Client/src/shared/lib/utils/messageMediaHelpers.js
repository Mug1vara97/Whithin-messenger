import { buildMediaUrl } from './urlHelpers';

export function categorizeMessageMedia(mediaFiles = []) {
  const visualMedia = [];
  const voiceMedia = [];
  const fileMedia = [];

  for (const media of mediaFiles) {
    const type = media?.contentType || '';
    if (type.startsWith('image/') || type.startsWith('video/')) {
      visualMedia.push(media);
    } else if (type.startsWith('audio/')) {
      voiceMedia.push(media);
    } else {
      fileMedia.push(media);
    }
  }

  return { visualMedia, voiceMedia, fileMedia };
}

export function buildMediaThumbnailUrl(mediaFile) {
  const path = mediaFile?.thumbnailPath || mediaFile?.filePath;
  return buildMediaUrl(path);
}
