import React, { useEffect, useMemo, useState } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import './MediaSendOverlay.css';

const MAX_BATCH_MEDIA_COUNT = 10;

const pluralFilesLabel = (count) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} файл`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} файла`;
  return `${count} файлов`;
};

const MediaSendOverlay = ({
  files = [],
  chatTitle = '',
  isUploading = false,
  uploadProgress = 0,
  onCancel,
  onSend,
}) => {
  const [caption, setCaption] = useState('');

  const previewItems = useMemo(
    () =>
      files.slice(0, MAX_BATCH_MEDIA_COUNT).map((file) => ({
        file,
        url: URL.createObjectURL(file),
        isImage: file.type.startsWith('image/'),
        isVideo: file.type.startsWith('video/'),
      })),
    [files]
  );

  useEffect(
    () => () => {
      previewItems.forEach((item) => URL.revokeObjectURL(item.url));
    },
    [previewItems]
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !isUploading) {
        onCancel?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isUploading, onCancel]);

  if (!files.length) return null;

  const single = previewItems.length === 1 ? previewItems[0] : null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isUploading) return;
    onSend?.(caption.trim());
  };

  return (
    <div className="media-send-overlay" role="dialog" aria-modal="true" aria-label="Отправка медиа">
      <div className="media-send-overlay__header">
        <button
          type="button"
          className="media-send-overlay__back"
          onClick={onCancel}
          disabled={isUploading}
          aria-label="Назад"
        >
          <ArrowBackIcon />
        </button>
        <div className="media-send-overlay__title-wrap">
          <div className="media-send-overlay__title">{chatTitle || 'Отправка'}</div>
          {previewItems.length > 1 && (
            <div className="media-send-overlay__subtitle">
              {pluralFilesLabel(previewItems.length)}
            </div>
          )}
        </div>
      </div>

      <div
        className={`media-send-overlay__preview ${
          previewItems.length > 1 ? 'media-send-overlay__preview--grid' : ''
        }`}
      >
        {single ? (
          single.isImage ? (
            <img
              src={single.url}
              alt={single.file.name}
              className="media-send-overlay__single-image"
            />
          ) : single.isVideo ? (
            <video
              src={single.url}
              className="media-send-overlay__single-video"
              controls
              playsInline
            />
          ) : (
            <div className="media-send-overlay__file-card">
              <div className="media-send-overlay__file-icon">
                <AttachFileIcon sx={{ fontSize: 36 }} />
              </div>
              <div className="media-send-overlay__file-name">{single.file.name}</div>
            </div>
          )
        ) : (
          <div className="media-send-overlay__grid">
            {previewItems.map((item) => (
              <div key={item.url} className="media-send-overlay__grid-item">
                {item.isImage ? (
                  <img src={item.url} alt={item.file.name} />
                ) : item.isVideo ? (
                  <>
                    <video src={item.url} muted playsInline />
                    <span className="media-send-overlay__grid-badge">Видео</span>
                  </>
                ) : (
                  <div className="media-send-overlay__file-card" style={{ padding: 12 }}>
                    <AttachFileIcon sx={{ fontSize: 28, color: '#5865f2' }} />
                    <div className="media-send-overlay__file-name" style={{ fontSize: 11 }}>
                      {item.file.name}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isUploading && (
        <div className="media-send-overlay__progress">
          Загрузка... {uploadProgress}%
          <div className="media-send-overlay__progress-bar">
            <div
              className="media-send-overlay__progress-fill"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      <form className="media-send-overlay__footer" onSubmit={handleSubmit}>
        <textarea
          className="media-send-overlay__caption"
          placeholder="Добавить подпись…"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          rows={1}
          disabled={isUploading}
        />
        <button
          type="submit"
          className="media-send-overlay__send"
          disabled={isUploading}
          aria-label="Отправить"
        >
          <SendIcon />
        </button>
      </form>
    </div>
  );
};

export default MediaSendOverlay;
