import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import {
  buildMediaPreviewItems,
  buildMediaSelectionTitle,
  revokeMediaPreviewItems,
} from '../../../lib/utils/mediaSendPreview';
import './MediaSendOverlay.css';

const MediaSendOverlay = ({
  files = [],
  onCancel,
  onSend,
}) => {
  const [caption, setCaption] = useState('');
  const [previewItems, setPreviewItems] = useState([]);
  const previewItemsRef = useRef([]);

  useLayoutEffect(() => {
    const nextItems = files.length ? buildMediaPreviewItems(files) : [];

    revokeMediaPreviewItems(previewItemsRef.current);
    previewItemsRef.current = nextItems;
    setPreviewItems(nextItems);
  }, [files]);

  useEffect(
    () => () => {
      revokeMediaPreviewItems(previewItemsRef.current);
      previewItemsRef.current = [];
    },
    [],
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCancel?.();
        return;
      }

      if (
        event.key === 'Enter'
        && !event.shiftKey
        && !event.nativeEvent.isComposing
        && event.target?.id !== 'media-send-caption'
      ) {
        event.preventDefault();
        onSend?.(caption.trim());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel, onSend, caption]);

  if (!files.length) return null;

  const single = previewItems.length === 1 ? previewItems[0] : null;
  const title = `Выбрано ${buildMediaSelectionTitle(previewItems)}`;

  const handleSubmit = (event) => {
    event.preventDefault();
    onSend?.(caption.trim());
  };

  const handleCaptionKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onSend?.(caption.trim());
  };

  const handleBackdropClick = (event) => {
    if (event.target !== event.currentTarget) return;
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
            onKeyDown={handleCaptionKeyDown}
            rows={2}
            autoFocus
          />

          <div className="media-send-modal__actions">
            <button
              type="button"
              className="media-send-modal__action media-send-modal__action--cancel"
              onClick={onCancel}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="media-send-modal__action media-send-modal__action--send"
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
