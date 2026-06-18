import { MEDIA_BASE_URL } from '../constants/apiEndpoints';

export const NAMEPLATE_UI_ENABLED = true;

/** Рекомендуемый размер ассета (как у Discord nameplate). */
export const NAMEPLATE_WIDTH = 448;
export const NAMEPLATE_HEIGHT = 84;
export const NAMEPLATE_MAX_FILE_BYTES = 3 * 1024 * 1024;

export const NAMEPLATE_ACCEPT = 'video/webm,image/png,image/webp';
export const NAMEPLATE_SPEC_HINT =
  `Рекомендуемое разрешение: ${NAMEPLATE_WIDTH}×${NAMEPLATE_HEIGHT} px (широкая полоса ~16:3). ` +
  'Форматы: WebM (VP9, без звука), PNG или WebP. До 3 МБ.';

export const TEST_NAMEPLATE_PATH = '/video.webm';
export const DODO_NAMEPLATE_PATH = '/Dodo.webm';

const DIMENSION_TOLERANCE = 16;

function isWithinRecommendedSize(width, height) {
  return (
    Math.abs(width - NAMEPLATE_WIDTH) <= DIMENSION_TOLERANCE &&
    Math.abs(height - NAMEPLATE_HEIGHT) <= DIMENSION_TOLERANCE
  );
}

function validateImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      if (!isWithinRecommendedSize(image.naturalWidth, image.naturalHeight)) {
        reject(
          new Error(
            `Изображение должно быть ${NAMEPLATE_WIDTH}×${NAMEPLATE_HEIGHT} px (±${DIMENSION_TOLERANCE}). ` +
              `Сейчас: ${image.naturalWidth}×${image.naturalHeight}.`,
          ),
        );
        return;
      }
      resolve();
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось прочитать изображение'));
    };
    image.src = url;
  });
}

function validateVideoDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!isWithinRecommendedSize(width, height)) {
        reject(
          new Error(
            `Видео должно быть ${NAMEPLATE_WIDTH}×${NAMEPLATE_HEIGHT} px (±${DIMENSION_TOLERANCE}). ` +
              `Сейчас: ${width}×${height}.`,
          ),
        );
        return;
      }
      resolve();
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось прочитать видео'));
    };
    video.src = url;
  });
}

export async function validateNameplateFile(file) {
  if (!file) {
    throw new Error('Файл не выбран');
  }

  if (file.size > NAMEPLATE_MAX_FILE_BYTES) {
    throw new Error('Файл слишком большой (максимум 3 МБ)');
  }

  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();

  if (type === 'video/webm' || name.endsWith('.webm')) {
    await validateVideoDimensions(file);
    return;
  }

  if (type === 'image/png' || type === 'image/webp' || name.endsWith('.png') || name.endsWith('.webp')) {
    await validateImageDimensions(file);
    return;
  }

  throw new Error('Допустимы WebM, PNG или WebP');
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

export function resolveMemberNameplate(member) {
  return member?.nameplate ?? member?.Nameplate ?? null;
}
