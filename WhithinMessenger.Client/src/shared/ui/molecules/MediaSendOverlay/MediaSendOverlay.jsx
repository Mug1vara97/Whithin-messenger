import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import './MediaSendOverlay.css';

const MAX_BATCH_MEDIA_COUNT = 10;

const getFilePreviewKey = (file) =>
  `${file.name}-${file.size}-${file.lastModified}-${file.type}`;

const buildPreviewItems = (files) =>
  files.slice(0, MAX_BATCH_MEDIA_COUNT).map((file) => {
    const isImage =
      (file.type || '').startsWith('image/') ||
      /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(file.name || '');
    const isVideo =
      (file.type || '').startsWith('video/') ||
      /\.(mp4|webm|mov|mkv|m4v)$/i.test(file.name || '');

    return {
      key: getFilePreviewKey(file),
      file,
      url: URL.createObjectURL(file),
      isImage,
      isVideo,
    };
  });

const revokePreviewItems = (items) => {
  items.forEach((item) => {
    if (item.url) {
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

const buildSelectionTitle = (items) => {
  const count = items.length;
  const images = items.filter((item) => item.isImage).length;
  const videos = items.filter((item) => item.isVideo).length;

  if (count === 1) {
    if (images === 1) return 'Выбрано 1 изображение';
    if (videos === 1) return 'Выбрано 1 видео';
    return 'Выбран 1 файл';
  }

  if (images === count) {
    return `Выбрано ${count} ${pluralize(count, 'изображение', 'изображения', 'изображений')}`;
  }
  if (videos === count) {
    return `Выбрано ${count} ${pluralize(count, 'видео', 'видео', 'видео')}`;
  }

  return `Выбрано ${count} ${pluralize(count, 'файл', 'файла', 'файлов')}`;
};

const MediaSendOverlay = ({
  files = [],
  isUploading = false,
  uploadProgress = 0,
  onCancel,
  onSend,
}) => {
  const [caption, setCaption] = useState('');
  const [previewItems, setPreviewItems] = useState([]);
  const previewItemsRef = useRef([]);

  useLayoutEffect(() => {
    const nextItems = files.length ? buildPreviewItems(files) : [];

    revokePreviewItems(previewItemsRef.current);
    previewItemsRef.current = nextItems;
    setPreviewItems(nextItems);
  }, [files]);

  useEffect(
    () => () => {
      revokePreviewItems(previewItemsRef.current);
      previewItemsRef.current = [];
    },
    []
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
  const title = buildSelectionTitle(previewItems);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isUploading) return;
    onSend?.(caption.trim());
  };

  const handleBackdropClick = (event) => {
    if (event.target !== event.currentTarget || isUploading) return;
    onCancel?.();
  };

  const renderPreviewItem = (item, compact = false) => {
    if (item.isImage) {
      return (
        <img
          src={item.url}
          alt={item.file.name}
          className={compact ? 'media-send-modal__thumb-image' : 'media-send-modal__single-image'}
        />
      );
    }

    if (item.isVideo) {
      return (
        <video
          src={item.url}
          className={compact ? 'media-send-modal__thumb-video' : 'media-send-modal__single-video'}
          controls={!compact}
          playsInline
          muted={compact}
        />
      );
    }

    return (
      <div className="media-send-modal__file-card">
        <div className="media-send-modal__file-icon">
          <AttachFileIcon sx={{ fontSize: compact ? 28 : 36 }} />
        </div>
        <div className="media-send-modal__file-name">{item.file.name}</div>
      </div>
    );
  };

  return (
    <div
      className="media-send-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Отправка медиа"
      onClick={handleBackdropClick}
    >
      <div className="media-send-modal" onClick={(event) => event.stopPropagation()}>
        <div className="media-send-modal__header">
          <h3 className="media-send-modal__title">{title}</h3>
        </div>

        <div
          className={`media-send-modal__preview ${
            previewItems.length > 1 ? 'media-send-modal__preview--stack' : ''
          }`}
        >
          {single ? (
            renderPreviewItem(single)
          ) : previewItems.length > 1 ? (
            <div className="media-send-modal__stack">
              {previewItems.map((item) => (
                <div key={item.key} className="media-send-modal__stack-item">
                  {renderPreviewItem(item, true)}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {isUploading && (
          <div className="media-send-modal__progress">
            Загрузка… {uploadProgress}%
            <div className="media-send-modal__progress-bar">
              <div
                className="media-send-modal__progress-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <form className="media-send-modal__body" onSubmit={handleSubmit}>
          <label className="media-send-modal__caption-label" htmlFor="media-send-caption">
            Подпись
          </label>
          <textarea
            id="media-send-caption"
            className="media-send-modal__caption"
            placeholder=""
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            rows={2}
            disabled={isUploading}
            autoFocus
          />

          <div className="media-send-modal__actions">
            <button
              type="button"
              className="media-send-modal__action media-send-modal__action--cancel"
              onClick={onCancel}
              disabled={isUploading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="media-send-modal__action media-send-modal__action--send"
              disabled={isUploading}
            >
              Отправить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MediaSendOverlay;
