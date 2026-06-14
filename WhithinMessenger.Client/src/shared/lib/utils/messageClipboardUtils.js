import { categorizeMessageMedia } from './messageMediaHelpers';
import { fetchMediaBlob, downloadMediaFile } from './urlHelpers';

export function getEffectiveMessageMediaFiles(message) {
  if (!message) return [];
  if (message.forwardedMessage?.mediaFiles?.length) {
    return message.forwardedMessage.mediaFiles;
  }
  return message.mediaFiles || [];
}

export function getCopyableMessageText(message) {
  if (!message) return '';

  if (message.contentType === 'sticker' || message.contentType === 'poll') {
    return '';
  }

  if (message.forwardedMessage?.content?.trim()) {
    const parts = [message.forwardedMessage.content.trim()];
    if (message.content?.trim()) {
      parts.push(message.content.trim());
    }
    return parts.join('\n\n');
  }

  return message.content?.trim() || '';
}

export function getMessageContextMenuActions(message) {
  const mediaFiles = getEffectiveMessageMediaFiles(message);
  const { visualMedia, voiceMedia, fileMedia } = categorizeMessageMedia(mediaFiles);
  const images = visualMedia.filter((media) => (media.contentType || '').startsWith('image/'));
  const videos = visualMedia.filter((media) => (media.contentType || '').startsWith('video/'));
  const savableMedia = [...visualMedia, ...voiceMedia, ...fileMedia];

  return {
    canCopyText: Boolean(getCopyableMessageText(message)),
    canCopyImage: images.length > 0,
    canCopyVideo: videos.length > 0,
    canSaveAs: savableMedia.length > 0,
    images,
    videos,
    savableMedia,
  };
}

export async function copyMessageText(message) {
  const text = getCopyableMessageText(message);
  if (!text) return false;

  await navigator.clipboard.writeText(text);
  return true;
}

export async function copyMediaFileToClipboard(mediaFile) {
  if (!mediaFile?.filePath) {
    throw new Error('Missing media file path');
  }

  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('Clipboard API is not available');
  }

  const blob = await fetchMediaBlob(mediaFile.filePath);
  const type = blob.type || mediaFile.contentType || 'application/octet-stream';

  await navigator.clipboard.write([
    new ClipboardItem({
      [type]: blob,
    }),
  ]);

  return true;
}

export async function saveMessageMediaFiles(mediaFiles = []) {
  for (const mediaFile of mediaFiles) {
    if (!mediaFile?.filePath) continue;

    const fileName = mediaFile.originalFileName || mediaFile.fileName || 'download';
    await downloadMediaFile(mediaFile.filePath, fileName);
  }
}
