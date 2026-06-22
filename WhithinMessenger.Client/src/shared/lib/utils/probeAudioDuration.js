import tokenManager from '../services/tokenManager';

const PEAK_BAR_COUNT = 80;

export const isValidAudioDuration = (value) => {
  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0 && duration !== Infinity;
};

export const resolveMediaFilePath = (mediaFile) =>
  mediaFile?.filePath ?? mediaFile?.FilePath ?? '';

export const resolveMediaContentType = (mediaFile) =>
  mediaFile?.contentType ?? mediaFile?.ContentType ?? '';

export const inferMediaContentType = (filePath, responseContentType, fallback = 'audio/webm') => {
  const headerType = responseContentType?.split(';')[0]?.trim();
  if (headerType && headerType !== 'application/octet-stream') {
    return headerType;
  }

  const path = String(filePath || '').toLowerCase();
  if (path.endsWith('.webm')) return 'audio/webm';
  if (path.endsWith('.ogg')) return 'audio/ogg';
  if (path.endsWith('.mp3')) return 'audio/mpeg';
  if (path.endsWith('.mp4') || path.endsWith('.m4a')) return 'audio/mp4';
  if (path.endsWith('.wav')) return 'audio/wav';

  return fallback;
};

export const readMediaFileDuration = (mediaFile) => {
  const raw =
    mediaFile?.duration ??
    mediaFile?.Duration ??
    mediaFile?.durationSeconds ??
    mediaFile?.DurationSeconds ??
    mediaFile?.audioDuration ??
    mediaFile?.AudioDuration;
  const duration = Number(raw);
  return isValidAudioDuration(duration) ? duration : 0;
};

function hashString(value) {
  const str = String(value || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function extractPeaksFromAudioBuffer(audioBuffer, barCount = PEAK_BAR_COUNT) {
  const channel = audioBuffer.getChannelData(0);
  const segmentSize = Math.max(1, Math.floor(channel.length / barCount));
  const peaks = [];

  for (let i = 0; i < barCount; i += 1) {
    const start = i * segmentSize;
    const end = Math.min(start + segmentSize, channel.length);
    let max = 0;
    for (let j = start; j < end; j += 1) {
      max = Math.max(max, Math.abs(channel[j] || 0));
    }
    peaks.push(max);
  }

  const maxPeak = Math.max(...peaks, 0.01);
  return peaks.map((peak) => peak / maxPeak);
}

export function generatePlaceholderPeaks(seedSource, barCount = PEAK_BAR_COUNT) {
  const seed = hashString(seedSource);
  const peaks = [];

  for (let i = 0; i < barCount; i += 1) {
    const wave = Math.abs(Math.sin(i * 0.42 + seed * 0.01));
    const noise = ((i * 13 + seed) % 11) / 22;
    peaks.push(Math.min(1, 0.18 + wave * 0.45 + noise));
  }

  return peaks;
}

export async function analyzeAudioBuffer(arrayBuffer, seedSource, barCount = PEAK_BAR_COUNT) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass || !arrayBuffer?.byteLength) {
    return {
      peaks: generatePlaceholderPeaks(seedSource, barCount),
      duration: 0,
    };
  }

  const audioContext = new AudioContextClass();
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    return {
      peaks: extractPeaksFromAudioBuffer(audioBuffer, barCount),
      duration: isValidAudioDuration(audioBuffer.duration) ? audioBuffer.duration : 0,
    };
  } catch {
    return {
      peaks: generatePlaceholderPeaks(seedSource, barCount),
      duration: 0,
    };
  } finally {
    try {
      await audioContext.close();
    } catch {
      /* ignore */
    }
  }
}

export async function generateAudioPeaks(arrayBuffer, seedSource, barCount = PEAK_BAR_COUNT) {
  const { peaks } = await analyzeAudioBuffer(arrayBuffer, seedSource, barCount);
  return peaks;
}

const durationCacheKey = (filePath) => `whithin:audio-duration:${filePath}`;

export function readCachedAudioDuration(filePath) {
  if (!filePath) return 0;
  try {
    const raw = localStorage.getItem(durationCacheKey(filePath));
    const duration = Number(raw);
    return isValidAudioDuration(duration) ? duration : 0;
  } catch {
    return 0;
  }
}

export function cacheAudioDuration(filePath, duration) {
  if (!filePath || !isValidAudioDuration(duration)) return;
  try {
    localStorage.setItem(durationCacheKey(filePath), String(duration));
  } catch {
    /* ignore */
  }
}

async function fetchAudioArrayBuffer(url) {
  const headers = {};
  const token = tokenManager.getToken();
  if (token && tokenManager.isTokenValid()) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers, credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: HTTP ${response.status}`);
  }

  return {
    arrayBuffer: await response.arrayBuffer(),
    contentType: response.headers.get('Content-Type'),
  };
}

export async function fetchAudioBlob(url, contentType = 'audio/webm') {
  const { arrayBuffer, contentType: responseContentType } = await fetchAudioArrayBuffer(url);
  const resolvedType = inferMediaContentType(
    url,
    responseContentType,
    contentType || resolveMediaContentType(null) || 'audio/webm'
  );

  const blob = new Blob([arrayBuffer], { type: resolvedType });
  const blobUrl = URL.createObjectURL(blob);

  return { blob, blobUrl, arrayBuffer, contentType: resolvedType };
}

async function decodeDurationFromBuffer(arrayBuffer) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass || !arrayBuffer?.byteLength) {
    return 0;
  }

  const audioContext = new AudioContextClass();
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    return isValidAudioDuration(audioBuffer.duration) ? audioBuffer.duration : 0;
  } catch {
    return 0;
  } finally {
    try {
      await audioContext.close();
    } catch {
      /* ignore */
    }
  }
}

export function probeVideoDurationFromBlobUrl(url) {
  const video = document.createElement('video');
  video.preload = 'auto';
  video.src = url;
  return probeDurationOnElement(video, { resetPosition: false }).finally(() => {
    video.pause();
    video.removeAttribute('src');
    video.load();
  });
}

export async function probeVideoDurationFromFile(file) {
  if (!file) return 0;
  const blobUrl = URL.createObjectURL(file);
  try {
    return await probeVideoDurationFromBlobUrl(blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export function probeAudioDurationFromBlobUrl(url) {
  const audio = document.createElement('audio');
  audio.preload = 'auto';
  audio.src = url;
  return probeDurationOnElement(audio, { resetPosition: false }).finally(() => {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  });
}

export function probeDurationOnElement(audio, { resetPosition = true } = {}) {
  return new Promise((resolve) => {
    if (!audio) {
      resolve(0);
      return;
    }

    if (isValidAudioDuration(audio.duration)) {
      resolve(audio.duration);
      return;
    }

    let settled = false;
    const initialTime = audio.currentTime || 0;

    const cleanup = () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('seeked', onSeeked);
      audio.removeEventListener('error', onError);
    };

    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (resetPosition) {
        try {
          audio.currentTime = initialTime;
        } catch {
          /* ignore */
        }
      }
      resolve(isValidAudioDuration(value) ? value : 0);
    };

    const tryRead = () => {
      if (isValidAudioDuration(audio.duration)) {
        finish(audio.duration);
        return true;
      }
      return false;
    };

    const onLoadedMetadata = () => {
      if (tryRead()) return;
      try {
        audio.currentTime = Number.MAX_SAFE_INTEGER;
      } catch {
        finish(0);
      }
    };

    const onDurationChange = () => {
      tryRead();
    };

    const onSeeked = () => {
      if (tryRead()) return;
      finish(audio.duration);
    };

    const onError = () => finish(0);

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('seeked', onSeeked);
    audio.addEventListener('error', onError);

    if (audio.readyState >= 1) {
      onLoadedMetadata();
    } else {
      audio.load();
    }

    window.setTimeout(() => finish(audio.duration), 8000);
  });
}

export async function resolveAudioDuration(mediaFile, arrayBuffer, blobUrl, filePath = '') {
  const fromMeta = readMediaFileDuration(mediaFile);
  if (fromMeta > 0) return fromMeta;

  const fromCache = readCachedAudioDuration(filePath);
  if (fromCache > 0) return fromCache;

  const { duration: fromAnalyze } = await analyzeAudioBuffer(arrayBuffer, filePath || blobUrl || '');
  if (fromAnalyze > 0) return fromAnalyze;

  if (blobUrl) {
    const fromElement = await probeAudioDurationFromBlobUrl(blobUrl);
    if (fromElement > 0) return fromElement;
  }

  return 0;
}

export async function probeAudioDuration(url, contentType = 'audio/webm') {
  if (!url) return 0;

  try {
    const { blobUrl, arrayBuffer } = await fetchAudioBlob(url, contentType);
    try {
      const decodedDuration = await decodeDurationFromBuffer(arrayBuffer);
      if (decodedDuration) return decodedDuration;
      return await probeAudioDurationFromBlobUrl(blobUrl);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  } catch (error) {
    console.warn('probeAudioDuration failed:', error);
    return 0;
  }
}

/** @deprecated используйте fetchAudioBlob + probeAudioDurationFromBlobUrl */
export async function loadAudioBlobWithDuration(url, contentType = 'audio/webm') {
  const { blob, blobUrl, arrayBuffer, contentType: resolvedType } = await fetchAudioBlob(url, contentType);

  let duration = await decodeDurationFromBuffer(arrayBuffer);
  if (!duration) {
    duration = await probeAudioDurationFromBlobUrl(blobUrl);
  }

  return { blob, blobUrl, duration, arrayBuffer, contentType: resolvedType };
}
