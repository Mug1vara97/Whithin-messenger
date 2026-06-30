export const MAX_BATCH_MEDIA_COUNT = 10;

export const getMediaFilePreviewKey = (file) =>
  `${file.name}-${file.size}-${file.lastModified}-${file.type}`;

export const classifyMediaFile = (file) => {
  const isImage =
    (file.type || '').startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(file.name || '');
  const isVideo =
    (file.type || '').startsWith('video/') ||
    /\.(mp4|webm|mov|mkv|m4v)$/i.test(file.name || '');

  return { isImage, isVideo };
};

export const buildMediaPreviewItems = (files) =>
  files.slice(0, MAX_BATCH_MEDIA_COUNT).map((file) => {
    const { isImage, isVideo } = classifyMediaFile(file);

    return {
      key: getMediaFilePreviewKey(file),
      file,
      url: URL.createObjectURL(file),
      isImage,
      isVideo,
    };
  });

export const revokeMediaPreviewItems = (items = []) => {
  items.forEach((item) => {
    if (item?.url) {
      URL.revokeObjectURL(item.url);
    }
  });
};

const pluralize = (count, one, few, many) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

export const buildMediaSelectionTitle = (items) => {
  const count = items.length;
  const images = items.filter((item) => item.isImage).length;
  const videos = items.filter((item) => item.isVideo).length;

  if (count === 1) {
    if (images === 1) return '1 изображение';
    if (videos === 1) return '1 видео';
    return '1 файл';
  }

  if (images === count) {
    return `${count} ${pluralize(count, 'изображение', 'изображения', 'изображений')}`;
  }
  if (videos === count) {
    return `${count} ${pluralize(count, 'видео', 'видео', 'видео')}`;
  }

  return `${count} ${pluralize(count, 'файл', 'файла', 'файлов')}`;
};
