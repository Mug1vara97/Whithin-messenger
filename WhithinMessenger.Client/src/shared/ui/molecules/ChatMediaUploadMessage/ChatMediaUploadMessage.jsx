import React from 'react';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import './ChatMediaUploadMessage.css';

const ChatMediaUploadMessage = ({
  previewItems = [],
  caption = '',
  uploadProgress = 0,
  isUploadProcessing = false,
  fileName = '',
}) => {
  if (!previewItems.length) return null;

  const statusLabel = isUploadProcessing
    ? `Обработка на сервере… ${uploadProgress}%`
    : `Загрузка… ${uploadProgress}%`;

  const renderPreviewItem = (item, compact = false) => {
    if (item.isImage) {
      return (
        <img
          src={item.url}
          alt={item.file?.name || fileName}
          className={compact ? 'chat-media-upload-message__thumb-image' : 'chat-media-upload-message__media-image'}
        />
      );
    }

    if (item.isVideo) {
      return (
        <video
          src={item.url}
          className={compact ? 'chat-media-upload-message__thumb-video' : 'chat-media-upload-message__media-video'}
          playsInline
          muted
        />
      );
    }

    return (
      <div className="chat-media-upload-message__file-card">
        <AttachFileIcon sx={{ fontSize: compact ? 28 : 36 }} />
        <span>{item.file?.name || fileName}</span>
      </div>
    );
  };

  const single = previewItems.length === 1 ? previewItems[0] : null;

  return (
    <div className="chat-media-upload-message">
      <div
        className={`chat-media-upload-message__preview ${
          previewItems.length > 1 ? 'chat-media-upload-message__preview--album' : ''
        }`}
      >
        {single ? (
          <div className="chat-media-upload-message__media-wrap">
            {renderPreviewItem(single)}
            <div className="chat-media-upload-message__overlay" aria-hidden="true">
              <span className="chat-media-upload-message__status">{statusLabel}</span>
              <div className="chat-media-upload-message__progress-bar">
                <div
                  className="chat-media-upload-message__progress-fill"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="chat-media-upload-message__album">
            {previewItems.map((item) => (
              <div key={item.key} className="chat-media-upload-message__album-item">
                {renderPreviewItem(item, true)}
              </div>
            ))}
            <div className="chat-media-upload-message__album-status">
              <span>{statusLabel}</span>
              <div className="chat-media-upload-message__progress-bar">
                <div
                  className="chat-media-upload-message__progress-fill"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {caption ? (
        <div className="chat-media-upload-message__caption message-text">{caption}</div>
      ) : null}
    </div>
  );
};

export default ChatMediaUploadMessage;
