import React, { useState, useEffect, useRef, useCallback } from 'react';
import { buildMediaUrl, downloadMediaFile } from '../../../lib/utils/urlHelpers';
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

const VIDEO_NOTE_RING_R = 45;
const VIDEO_NOTE_RING_LEN = 2 * Math.PI * VIDEO_NOTE_RING_R;

/** Видеокружок: один проход без зацикливания, клик — play/pause, кольцо прогресса, после конца — снова play с начала. */
function VideoNoteCircle({ src, onPlaybackFailed }) {
  const videoRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [ended, setEnded] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setLoading(true);
    setProgress(0);
    setEnded(false);
    setPlaying(false);
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
    setProgress(Math.min(1, v.currentTime / v.duration));
  }, []);

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

  const dashOffset = VIDEO_NOTE_RING_LEN * (1 - progress);

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
          className="media-video-note__ring-progress"
          cx="50"
          cy="50"
          r={VIDEO_NOTE_RING_R}
          fill="none"
          strokeDasharray={VIDEO_NOTE_RING_LEN}
          strokeDashoffset={dashOffset}
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
            setPlaying(true);
            setEnded(false);
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            const v = videoRef.current;
            if (v) {
              try {
                v.pause();
              } catch {
                /* ignore */
              }
            }
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

  useEffect(() => {
    if (mediaFile?.contentType?.startsWith('video/')) {
      setVideoError(false);
      setVideoLoading(true);
    }
  }, [mediaFile?.filePath, mediaFile?.isVideoNote]);

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
            <div className="media-video-error" style={{
              padding: '20px',
              textAlign: 'center',
              backgroundColor: '#2f3136',
              borderRadius: '8px',
              border: '1px solid #40444b'
            }}>
              <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'center' }}>
                <VideocamIcon sx={{ fontSize: 48, color: '#72767d' }} />
              </div>
              <p style={{ color: '#dcddde', marginBottom: '8px', fontSize: '14px' }}>
                Видео не может быть воспроизведено в браузере
              </p>
              <p style={{ color: '#72767d', marginBottom: '16px', fontSize: '12px' }}>
                Возможно, используется неподдерживаемый формат (HEVC/H.265)
              </p>
              <a
                href={videoUrl}
                download={mediaFile.originalFileName || 'video.mp4'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 20px',
                  backgroundColor: '#5865f2',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#4752c4'; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#5865f2'; }}
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
            onLoad={() => setVideoLoading(false)}
            onError={() => {
              setVideoLoading(false);
              setVideoError(true);
            }}
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
