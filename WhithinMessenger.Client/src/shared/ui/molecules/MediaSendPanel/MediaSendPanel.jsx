import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import SendIcon from '../../../ui/atoms/SendIcon';
import {
  buildMediaPreviewItems,
  buildMediaSelectionTitle,
  revokeMediaPreviewItems,
} from '../../../lib/utils/mediaSendPreview';
import './MediaSendPanel.css';

const MediaSendPanel = ({
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

  if (!files.length) return null;

  const single = previewItems.length === 1 ? previewItems[0] : null;
  const title = buildMediaSelectionTitle(previewItems);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSend?.(caption.trim());
  };

  const handleCaptionKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onSend?.(caption.trim());
  };

  const renderPreviewItem = (item, compact = false) => {
    if (item.isImage) {
      return (
        <img
          src={item.url}
          alt={item.file.name}
          className={compact ? 'media-send-panel__thumb-image' : 'media-send-panel__single-image'}
        />
      );
    }

    if (item.isVideo) {
      return (
        <video
          src={item.url}
          className={compact ? 'media-send-panel__thumb-video' : 'media-send-panel__single-video'}
          controls={!compact}
          playsInline
          muted={compact}
        />
      );
    }

    return (
      <div className="media-send-panel__file-card">
        <div className="media-send-panel__file-icon">
          <AttachFileIcon sx={{ fontSize: compact ? 28 : 36 }} />
        </div>
        <div className="media-send-panel__file-name">{item.file.name}</div>
      </div>
    );
  };

  return (
    <div className="media-send-panel" aria-label="Отправка медиа">
      <div className="media-send-panel__header">
        <span className="media-send-panel__title">{title}</span>
        <button
          type="button"
          className="media-send-panel__close"
          onClick={onCancel}
          aria-label="Отменить отправку"
        >
          ×
        </button>
      </div>

      <div
        className={`media-send-panel__preview ${
          previewItems.length > 1 ? 'media-send-panel__preview--stack' : ''
        }`}
      >
        {single ? (
          renderPreviewItem(single)
        ) : previewItems.length > 1 ? (
          <div className="media-send-panel__stack">
            {previewItems.map((item) => (
              <div key={item.key} className="media-send-panel__stack-item">
                {renderPreviewItem(item, true)}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <form className="media-send-panel__footer" onSubmit={handleSubmit}>
        <textarea
          className="media-send-panel__caption"
          placeholder="Подпись"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          onKeyDown={handleCaptionKeyDown}
          rows={1}
        />
        <button
          type="submit"
          className="media-send-panel__send"
          title="Отправить"
          aria-label="Отправить"
        >
          <SendIcon className="media-send-panel__send-icon" />
        </button>
      </form>
    </div>
  );
};

export default MediaSendPanel;
