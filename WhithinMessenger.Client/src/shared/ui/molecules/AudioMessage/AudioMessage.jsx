import React, { useRef, useEffect, useState, useCallback } from 'react';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import WaveSurfer from 'wavesurfer.js';
import { buildMediaUrl } from '../../../lib/utils/urlHelpers';
import {
  isValidAudioDuration,
  fetchAudioBlob,
  analyzeAudioBuffer,
  readMediaFileDuration,
  readCachedAudioDuration,
  cacheAudioDuration,
  probeDurationOnElement,
  resolveMediaContentType,
  resolveMediaFilePath,
} from '../../../lib/utils/probeAudioDuration';
import './AudioMessage.css';

const formatTime = (time) => {
  if (!Number.isFinite(time) || time < 0) return '0:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const AudioMessage = ({ mediaFile }) => {
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const audioRef = useRef(null);
  const blobUrlRef = useRef(null);
  const peaksRef = useRef([]);
  const loadIdRef = useRef(0);
  const durationRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(() => {
    const fromMeta = readMediaFileDuration(mediaFile);
    const fromPath = readCachedAudioDuration(resolveMediaFilePath(mediaFile));
    return fromMeta > 0 ? fromMeta : fromPath;
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState(null);
  const [isReady, setIsReady] = useState(false);

  const filePath = resolveMediaFilePath(mediaFile);
  const contentType = resolveMediaContentType(mediaFile);
  const audioUrl = buildMediaUrl(filePath);

  const applyDuration = useCallback(
    (value) => {
      if (!isValidAudioDuration(value)) return;
      durationRef.current = value;
      setDuration(value);
      cacheAudioDuration(filePath, value);
    },
    [filePath]
  );

  const syncWaveformDuration = useCallback((nextDuration) => {
    const wavesurfer = wavesurferRef.current;
    const peaks = peaksRef.current;
    if (!wavesurfer || !isValidAudioDuration(nextDuration) || !peaks.length) return;

    wavesurfer.load('', [peaks], nextDuration).catch((waveError) => {
      console.warn('AudioMessage: failed to refresh waveform duration', waveError);
    });
  }, []);

  const tryResolveDurationFromAudio = useCallback(
    async (audio, { probe = false } = {}) => {
      if (!audio || durationRef.current > 0) return durationRef.current;

      if (isValidAudioDuration(audio.duration)) {
        applyDuration(audio.duration);
        return audio.duration;
      }

      if (probe) {
        const probed = await probeDurationOnElement(audio, { resetPosition: true });
        if (probed > 0) {
          applyDuration(probed);
          syncWaveformDuration(probed);
          return probed;
        }
      }

      return 0;
    },
    [applyDuration, syncWaveformDuration]
  );

  useEffect(() => {
    const fromMeta = readMediaFileDuration(mediaFile);
    const fromCache = readCachedAudioDuration(filePath);
    const nextDuration = fromMeta > 0 ? fromMeta : fromCache;
    durationRef.current = nextDuration;
    setDuration(nextDuration);
    setCurrentTime(0);
    setIsPlaying(false);
    setError(null);
    setIsReady(false);
  }, [audioUrl, mediaFile, filePath]);

  useEffect(() => {
    if (!waveformRef.current || !audioUrl) return undefined;

    const loadId = ++loadIdRef.current;
    let disposed = false;
    let wavesurfer = null;
    let audio = null;

    const isStale = () => disposed || loadId !== loadIdRef.current;

    const init = async () => {
      try {
        const { blobUrl, arrayBuffer } = await fetchAudioBlob(
          audioUrl,
          contentType || 'audio/webm'
        );

        if (isStale()) {
          URL.revokeObjectURL(blobUrl);
          return;
        }

        blobUrlRef.current = blobUrl;

        if (!durationRef.current) {
          const fromMeta = readMediaFileDuration(mediaFile);
          const fromCache = readCachedAudioDuration(filePath);
          if (fromMeta > 0) applyDuration(fromMeta);
          else if (fromCache > 0) applyDuration(fromCache);
        }

        const { peaks, duration: decodedDuration } = await analyzeAudioBuffer(
          arrayBuffer,
          filePath || audioUrl
        );
        if (isStale()) return;

        peaksRef.current = peaks;
        if (!durationRef.current && decodedDuration > 0) {
          applyDuration(decodedDuration);
        }

        audio = new Audio();
        audio.preload = 'auto';
        audio.src = blobUrl;
        audioRef.current = audio;

        if (!durationRef.current) {
          await tryResolveDurationFromAudio(audio, { probe: true });
        }

        if (isStale()) return;

        const waveDuration = durationRef.current > 0 ? durationRef.current : 0;

        wavesurfer = WaveSurfer.create({
          container: waveformRef.current,
          waveColor: '#b9bbbe',
          progressColor: '#5865f2',
          cursorColor: '#ffffff',
          barWidth: 2,
          barHeight: 0.7,
          height: 40,
          cursorWidth: 0,
          minPxPerSec: 1,
          interact: true,
          dragToSeek: true,
        });
        wavesurferRef.current = wavesurfer;

        await wavesurfer.load('', [peaks], waveDuration > 0 ? waveDuration : undefined);

        if (isStale()) return;

        const onTimeUpdate = () => {
          if (isStale()) return;
          const time = audio.currentTime;
          setCurrentTime(time);

          if (!durationRef.current && isValidAudioDuration(audio.duration)) {
            applyDuration(audio.duration);
            syncWaveformDuration(audio.duration);
          }

          const total = durationRef.current;
          if (total > 0) {
            wavesurfer.seekTo(time / total);
          }
        };

        const onPlay = async () => {
          setIsPlaying(true);
          if (!durationRef.current) {
            await tryResolveDurationFromAudio(audio, { probe: true });
          }
        };

        const onPause = () => setIsPlaying(false);

        const onEnded = () => {
          setIsPlaying(false);
          if (!durationRef.current) {
            const finalDuration = isValidAudioDuration(audio.duration)
              ? audio.duration
              : audio.currentTime;
            if (finalDuration > 0) {
              applyDuration(finalDuration);
              syncWaveformDuration(finalDuration);
            }
          }
          setCurrentTime(0);
          wavesurfer.seekTo(0);
        };

        const onAudioMetadata = () => {
          void tryResolveDurationFromAudio(audio);
        };

        const onWaveInteraction = (newTime) => {
          if (!audio || !Number.isFinite(newTime)) return;
          audio.currentTime = newTime;
          setCurrentTime(newTime);
        };

        const onWaveClick = (relativeX) => {
          const total = durationRef.current;
          if (!audio || !isValidAudioDuration(total)) return;
          audio.currentTime = relativeX * total;
          setCurrentTime(audio.currentTime);
        };

        const onWaveError = (waveError) => {
          console.error('WaveSurfer error:', waveError);
          if (!isStale()) {
            setError('Ошибка при загрузке аудио');
          }
        };

        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('loadedmetadata', onAudioMetadata);
        audio.addEventListener('durationchange', onAudioMetadata);
        audio.addEventListener('error', () => {
          if (!isStale()) {
            setError('Ошибка при загрузке аудио');
          }
        });

        wavesurfer.on('interaction', onWaveInteraction);
        wavesurfer.on('click', onWaveClick);
        wavesurfer.on('error', onWaveError);

        if (!isStale()) {
          setIsReady(true);
        }
      } catch (loadError) {
        console.error('AudioMessage load failed:', loadError);
        if (!isStale()) {
          setError('Ошибка при загрузке аудио');
        }
      }
    };

    init();

    return () => {
      disposed = true;
      if (wavesurfer) {
        wavesurfer.destroy();
      }
      if (wavesurferRef.current === wavesurfer) {
        wavesurferRef.current = null;
      }
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      if (waveformRef.current) {
        waveformRef.current.replaceChildren();
      }
    };
  }, [
    audioUrl,
    contentType,
    filePath,
    mediaFile,
    applyDuration,
    tryResolveDurationFromAudio,
    syncWaveformDuration,
  ]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || error) return;

    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (playError) {
      console.warn('Ошибка при воспроизведении:', playError);
      setError('Ошибка при воспроизведении');
    }
  };

  const totalTimeLabel =
    duration > 0 ? formatTime(duration) : isPlaying ? '…' : '0:00';

  return (
    <div className={`audio-message ${isPlaying ? 'playing' : ''}`}>
      {error ? (
        <div className="error-message">{error}</div>
      ) : (
        <>
          <button
            onClick={togglePlay}
            className="play-pause-button"
            type="button"
            disabled={!isReady && duration <= 0}
            aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
          >
            {isPlaying ? (
              <PauseIcon sx={{ width: 24, height: 24, color: '#5865f2' }} />
            ) : (
              <PlayArrowIcon sx={{ width: 24, height: 24, color: '#5865f2' }} />
            )}
          </button>
          <div ref={waveformRef} className="waveform-container" />
          <span className="duration">
            {formatTime(currentTime)} / {totalTimeLabel}
          </span>
        </>
      )}
    </div>
  );
};

export default AudioMessage;
