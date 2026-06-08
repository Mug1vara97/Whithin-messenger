import React, { useState, useRef, useCallback } from 'react';
import { UserAvatar, MessageStatusIndicator } from '../../atoms';
import { MessageStatus } from '../../../../entities/message/model/types';
import MessageMediaContent from '../MessageMediaContent/MessageMediaContent';
import MessageMediaAlbum from '../MessageMediaAlbum/MessageMediaAlbum';
import MediaFile from '../MediaFile/MediaFile';
import { categorizeMessageMedia } from '../../../lib/utils/messageMediaHelpers';
import RepliedMedia from '../RepliedMedia/RepliedMedia';
import StickerMessage from '../StickerMessage/StickerMessage';
import { buildMediaUrl, openExternalUrl, splitTextWithLinks } from '../../../lib/utils/urlHelpers';
import { formatDiscordMessageTimestamp, formatShortMessageTime } from '../../../lib/utils/messageTime';
import './MessageItem.css';

const MessageItem = ({ 
  message, 
  isOwn = false, 
  showAvatar = true,
  onReply,
  onEdit,
  onDelete,
  onForward,
  onContextMenu
}) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const messageRef = useRef(null);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    if (onContextMenu) {
      const rect = messageRef.current.getBoundingClientRect();
      setContextMenuPosition({
        x: e.clientX,
        y: e.clientY
      });
      setShowContextMenu(true);
      onContextMenu(message, e);
    }
  }, [message, onContextMenu]);

  const handleReply = useCallback(() => {
    if (onReply) {
      onReply(message);
    }
    setShowContextMenu(false);
  }, [message, onReply]);

  const handleEdit = useCallback(() => {
    if (onEdit) {
      onEdit(message);
    }
    setShowContextMenu(false);
  }, [message, onEdit]);

  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete(message);
    }
    setShowContextMenu(false);
  }, [message, onDelete]);

  const handleForward = useCallback(() => {
    if (onForward) {
      onForward(message);
    }
    setShowContextMenu(false);
  }, [message, onForward]);

  const formatTime = useCallback((dateString) => {
    return formatDiscordMessageTimestamp(dateString);
  }, []);

  const renderMessageContent = () => {
    const messageParts = splitTextWithLinks(message.content);
    const hasTextContent = Boolean(message.content?.trim());
    const renderCaption = () => (
      <div className="message-text">
        {messageParts.length > 0 ? (
          messageParts.map((part, index) => {
            if (part.type === 'link') {
              return (
                <a
                  key={`${message.messageId}-link-${index}`}
                  href={part.href}
                  className="message-link"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openExternalUrl(part.href);
                  }}
                >
                  {part.value}
                </a>
              );
            }

            return (
              <React.Fragment key={`${message.messageId}-text-${index}`}>
                {part.value}
              </React.Fragment>
            );
          })
        ) : (
          message.content
        )}
      </div>
    );

    return (
      <div className="message-content">
        {!message.forwardedMessage && message.mediaFiles?.length > 0 ? (
          <MessageMediaContent
            mediaFiles={message.mediaFiles}
            timestamp={formatShortMessageTime(message.createdAt)}
            onVideoClick={(url) => window.open(url, '_blank', 'noopener,noreferrer')}
            renderCaption={hasTextContent ? renderCaption : null}
          />
        ) : (
          hasTextContent && renderCaption()
        )}
      </div>
    );
  };

  const renderRepliedMessage = () => {
    if (!message.repliedMessage) return null;
    
    console.log('🎵 MessageItem - repliedMessage:', message.repliedMessage);
    
    return (
      <div className="replied-message">
        <div className="replied-message-header">
          <strong>{message.repliedMessage.senderUsername}</strong>
          <span>{formatTime(message.repliedMessage.createdAt)}</span>
        </div>
        <div className="replied-message-content">
          <RepliedMedia 
            content={message.repliedMessage.content} 
            mediaFiles={message.repliedMessage.mediaFiles || []} 
          />
        </div>
      </div>
    );
  };

  const renderForwardedMessage = () => {
    if (!message.forwardedMessage) return null;

    const forwarded = message.forwardedMessage;
    const isForwardedSticker = forwarded.contentType === 'sticker' && forwarded.sticker;

    return (
      <div className="forwarded-message">
        <div className="forwarded-message-header">
          <span>↱ Переслано от {forwarded.senderUsername} из {forwarded.originalChatName}</span>
        </div>
        <div className="forwarded-message-content">
          {isForwardedSticker ? (
            <div className="forwarded-message-media">
              <StickerMessage sticker={forwarded.sticker} />
            </div>
          ) : (
            <>
              {forwarded.content && (
                <div className="forwarded-message-text">
                  <RepliedMedia content={forwarded.content} mediaFiles={[]} />
                </div>
              )}
              {forwarded.mediaFiles?.length > 0 && (() => {
                const { visualMedia, voiceMedia, fileMedia } = categorizeMessageMedia(forwarded.mediaFiles);
                return (
                  <>
                    {visualMedia.length >= 2 ? (
                      <div className="forwarded-message-media">
                        <MessageMediaAlbum
                          mediaFiles={visualMedia}
                          showTimeBadge={false}
                          onVideoClick={(url) => window.open(url, '_blank', 'noopener,noreferrer')}
                        />
                      </div>
                    ) : (
                      visualMedia.length > 0 && (
                        <div className="forwarded-message-media">
                          {visualMedia.map((mediaFile) => (
                            <img
                              key={mediaFile.id}
                              src={buildMediaUrl(mediaFile.filePath)}
                              alt={mediaFile.originalFileName || mediaFile.fileName || 'Image'}
                              className="forwarded-message-image"
                            />
                          ))}
                        </div>
                      )
                    )}
                    {[...voiceMedia, ...fileMedia].map((mediaFile) => (
                      <div key={mediaFile.id} className="forwarded-message-media">
                        <MediaFile mediaFile={mediaFile} canDelete={false} />
                      </div>
                    ))}
                  </>
                );
              })()}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div 
      ref={messageRef}
      className={`message-item ${isOwn ? 'own' : ''} ${showAvatar ? 'with-avatar' : ''}`}
      onContextMenu={handleContextMenu}
    >
      {showAvatar && (
        <div className="message-avatar">
          <UserAvatar 
            username={message.senderUsername}
            avatarUrl={message.avatarUrl}
            avatarColor={message.avatarColor}
            size="small"
          />
        </div>
      )}
      
      <div className="message-content">
        {showAvatar && (
          <div className="message-header">
            <span className="message-username">{message.senderUsername}</span>
            {formatTime(message.createdAt) && (
              <span className="message-time">{formatTime(message.createdAt)}</span>
            )}
            {message.isEdited && (
              <span className="message-edited">ред.</span>
            )}
            {isOwn && (
              <MessageStatusIndicator
                status={message.status || MessageStatus.SENT}
                onLightBubble
              />
            )}
          </div>
        )}
        
        <div className="message-body">
          {renderRepliedMessage()}
          {renderForwardedMessage()}
          {renderMessageContent()}
        </div>
      </div>
      
      {showContextMenu && (
        <div 
          className="context-menu"
          style={{
            position: 'fixed',
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
            zIndex: 1000
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="context-menu-item" onClick={handleReply}>
            Ответить
          </button>
          {isOwn && (
            <button className="context-menu-item" onClick={handleEdit}>
              Редактировать
            </button>
          )}
          <button className="context-menu-item" onClick={handleForward}>
            Переслать
          </button>
          {isOwn && (
            <button className="context-menu-item danger" onClick={handleDelete}>
              Удалить
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageItem;
























