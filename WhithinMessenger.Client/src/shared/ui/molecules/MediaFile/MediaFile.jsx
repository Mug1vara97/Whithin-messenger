import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { buildMediaUrl, downloadMediaFile } from '../../../lib/utils/urlHelpers';
import {
  readMediaFileDuration,
  readCachedAudioDuration,
} from '../../../lib/utils/probeAudioDuration';
import ImagePreview from '../ImagePreview/ImagePreview';
import AudioMessage from '../AudioMessage/AudioMessage';
import VideoPlayer from './VideoPlayer';
import ImageIcon from '@mui/icons-material/Image';
import VideocamIcon from '@mui/icons-material/Videocam';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DownloadIcon from '@mui/icons-material/Download';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import './MediaFile.css';

/** Радиус кольца в viewBox 0..100 (видео ~176px в оболочке 200px → r≈44; обод снаружи — r≈47). */
const VIDEO_NOTE_RING_R = 47;
const VIDEO_NOTE_RING_LEN = 2 * Math.PI * VIDEO_NOTE_RING_R;

/** Видеокружок: один проход без зацикливания, клик — play/pause, кольцо прогресса, после конца — снова play с начала. */
function VideoNoteCircle({ src, onPlaybackFailed }) {
  const videoRef = useRef(null);
  const ringProgressRef = useRef(null);
  const playingRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [ended, setEnded] = useState(false);
  const [playing, setPlaying] = useState(false);

  const syncRingDash = useCallback((p) => {
    const el = ringProgressRef.current;
    if (el) {
      el.style.strokeDashoffset = String(VIDEO_NOTE_RING_LEN * (1 - Math.min(1, Math.max(0, p))));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setProgress(0);
    setEnded(false);
    setPlaying(false);
    playingRef.current = false;
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
        v.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  }, [src]);

  useLayoutEffect(() => {
    if (playing) return;
    syncRingDash(progress);
  }, [progress, playing, syncRingDash]);

  useEffect(() => {
    if (!loading) return undefined;
    const t = window.setTimeout(() => setLoading(false), 12000);
    return () => window.clearTimeout(t);
  }, [loading, src]);

  const markReady = useCallback(() => {
    setLoading(false);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v?.duration || !Number.isFinite(v.duration) || v.duration <= 0) return;
    const p = Math.min(1, v.currentTime / v.duration);
    if (!playingRef.current) {
      setProgress(p);
      syncRingDash(p);
    }
  }, [syncRingDash]);

  /** Плавное кольцо: во время воспроизведения dashoffset только через rAF (не timeupdate). */
  useEffect(() => {
    if (!playing) return undefined;
    let frameId = 0;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const v = videoRef.current;
      if (v?.duration && Number.isFinite(v.duration) && v.duration > 0) {
        const p = Math.min(1, v.currentTime / v.duration);
        syncRingDash(p);
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(frameId);
    };
  }, [playing, syncRingDash]);

  const handleClick = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const v = videoRef.current;
      if (!v) return;
      if (ended) {
        v.currentTime = 0;
        setEnded(false);
        setProgress(0);
        v.muted = false;
        v.play().catch(() => {});
        return;
      }
      if (v.paused) {
        v.muted = false;
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    },
    [ended]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick(e);
      }
    },
    [handleClick]
  );

  return (
    <div
      className="media-video-note-shell"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      title={
        ended
          ? 'Нажмите — посмотреть снова'
          : playing
            ? 'Нажмите — пауза'
            : 'Нажмите — воспроизвести со звуком'
      }
    >
      <svg
        className="media-video-note__ring"
        viewBox="0 0 100 100"
        aria-hidden
      >
        <circle
          className="media-video-note__ring-track"
          cx="50"
          cy="50"
          r={VIDEO_NOTE_RING_R}
          fill="none"
        />
        <circle
          ref={ringProgressRef}
          className="media-video-note__ring-progress"
          cx="50"
          cy="50"
          r={VIDEO_NOTE_RING_R}
          fill="none"
          strokeDasharray={VIDEO_NOTE_RING_LEN}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="media-video-note">
        <video
          ref={videoRef}
          className="media-video-note__video"
          src={src}
          playsInline
          preload="metadata"
          onLoadedMetadata={markReady}
          onLoadedData={markReady}
          onCanPlay={markReady}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => {
            playingRef.current = true;
            setPlaying(true);
            setEnded(false);
          }}
          onPause={() => {
            playingRef.current = false;
            setPlaying(false);
            const v = videoRef.current;
            if (v?.duration && Number.isFinite(v.duration) && v.duration > 0) {
              setProgress(Math.min(1, v.currentTime / v.duration));
            }
          }}
          onEnded={() => {
            const v = videoRef.current;
            if (v) {
              try {
                v.pause();
              } catch {
                /* ignore */
              }
            }
            playingRef.current = false;
            setEnded(true);
            setPlaying(false);
            setProgress(1);
          }}
          onError={() => {
            setLoading(false);
            onPlaybackFailed?.();
          }}
        />
        {loading && (
          <div className="media-skeleton media-skeleton-video media-video-note__skeleton">
            <div className="skeleton-shimmer" />
            <div className="skeleton-icon"><VideocamIcon sx={{ fontSize: 40 }} /></div>
          </div>
        )}
        {!loading && !playing && (
          <div className="media-video-note__badge" aria-hidden>
            <PlayArrowIcon sx={{ fontSize: 44, color: '#fff' }} />
          </div>
        )}
      </div>
    </div>
  );
}

const MediaFile = ({ mediaFile }) => {
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);

  const handleVideoLoad = useCallback(() => {
    setVideoLoading(false);
  }, []);

  const handleVideoError = useCallback(() => {
    setVideoLoading(false);
    setVideoError(true);
  }, []);

  useEffect(() => {
    if (mediaFile?.contentType?.startsWith('video/')) {
      setVideoError(false);
      setVideoLoading(true);
    }
  }, [mediaFile?.filePath, mediaFile?.isVideoNote]);

  useEffect(() => {
    if (!mediaFile?.contentType?.startsWith('video/') || !videoLoading) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setVideoLoading(false);
    }, 8000);

    return () => window.clearTimeout(timeoutId);
  }, [mediaFile?.filePath, mediaFile?.contentType, videoLoading]);

  const handleDownload = async (e, url, fileName) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await downloadMediaFile(url, fileName);
    } catch (downloadError) {
      console.error('❌ MediaFile - ошибка скачивания файла:', downloadError);
      setError('Ошибка скачивания файла');
    }
  };

  const renderMediaContent = () => {
    const ct = mediaFile?.contentType || '';
    if (!ct) {
      return <div className="media-error">Неизвестный тип файла</div>;
    }
    if (ct.startsWith('image/')) {
      const imageUrl = buildMediaUrl(mediaFile.filePath);
      
      
      return (
        <div className="media-image-container">
          {imageLoading && (
            <div className="media-skeleton">
              <div className="skeleton-shimmer"></div>
              <div className="skeleton-icon"><ImageIcon sx={{ fontSize: 40 }} /></div>
            </div>
          )}
          <img
            src={imageUrl}
            alt={mediaFile.originalFileName}
            className={`media-image ${imageLoading ? 'media-loading' : ''}`}
            onClick={() => !imageLoading && setShowPreview(true)}
            onLoad={() => {
              console.log('✅ MediaFile - изображение загружено:', imageUrl);
              setImageLoading(false);
            }}
            onError={(e) => {
              console.error('❌ MediaFile - ошибка загрузки изображения:', imageUrl, e);
              setImageLoading(false);
              setError('Ошибка загрузки изображения');
            }}
            loading="lazy"
          />
        </div>
      );
    }

    if (ct.startsWith('video/')) {
      const videoUrl = buildMediaUrl(mediaFile.filePath);
      const isVideoNote = !!mediaFile.isVideoNote;

      if (isVideoNote && !videoError) {
        return (
          <VideoNoteCircle
            src={videoUrl}
            onPlaybackFailed={() => {
              setVideoLoading(false);
              setVideoError(true);
            }}
          />
        );
      }

      // Если ошибка воспроизведения — fallback с кнопкой скачивания
      if (videoError) {
        return (
          <div className="media-video-container">
            <div className="media-video-error">
              <div className="media-video-error__icon">
                <VideocamIcon sx={{ fontSize: 48 }} />
              </div>
              <p className="media-video-error__title">
                Видео не может быть воспроизведено в браузере
              </p>
              <p className="media-video-error__hint">
                Возможно, используется неподдерживаемый формат (HEVC/H.265)
              </p>
              <a
                href={videoUrl}
                download={mediaFile.originalFileName || 'video.mp4'}
                className="media-video-error__download"
                onClick={(e) => handleDownload(e, videoUrl, mediaFile.originalFileName || 'video.mp4')}
              >
                <DownloadIcon sx={{ fontSize: 18 }} />
                Скачать видео
              </a>
            </div>
          </div>
        );
      }

      return (
        <div className="media-video-container media-video-container--player">
          {videoLoading && (
            <div className="media-skeleton media-skeleton-video">
              <div className="skeleton-shimmer" />
              <div className="skeleton-icon"><VideocamIcon sx={{ fontSize: 40 }} /></div>
            </div>
          )}
          <VideoPlayer
            src={videoUrl}
            hlsSrc={
              mediaFile.streamingManifestPath
                ? buildMediaUrl(mediaFile.streamingManifestPath)
                : null
            }
            knownDuration={
              readMediaFileDuration(mediaFile) ||
              readCachedAudioDuration(mediaFile.filePath)
            }
            onLoad={handleVideoLoad}
            onError={handleVideoError}
            className={videoLoading ? 'media-loading' : ''}
          />
        </div>
      );
    }

    if (ct.startsWith('audio/')) {
      return <AudioMessage mediaFile={mediaFile} />;
    }

    // Для документов, архивов и других файлов — карточка-ссылка в стиле Discord
    const fileUrl = buildMediaUrl(mediaFile.filePath);
    const isArchive = /\.(zip|rar|7z|tar|gz)$/i.test(mediaFile.originalFileName || '');
    const FileIcon = isArchive ? FolderZipIcon : InsertDriveFileIcon;
    return (
      <a
        href={fileUrl}
        download={mediaFile.originalFileName || undefined}
        className="media-file-card"
        onClick={(e) => handleDownload(e, fileUrl, mediaFile.originalFileName || 'download')}
      >
        <div className="media-file-card__icon">
          <FileIcon sx={{ fontSize: 40 }} />
        </div>
        <div className="media-file-card__info">
          <span className="media-file-card__name">{mediaFile.originalFileName}</span>
          <span className="media-file-card__size">{formatFileSize(mediaFile.fileSize)}</span>
        </div>
      </a>
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <div className="media-file">
        {error && (
          <div className="media-error">
            {error}
          </div>
        )}
        
        <div className="media-content">
          {renderMediaContent()}
        </div>
      </div>
      
      {/* Компонент предварительного просмотра */}
      {(mediaFile?.contentType || '').startsWith('image/') && (
        <ImagePreview
          mediaFile={mediaFile}
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
};

export default MediaFile;
