import React, { useState, useRef, useCallback } from 'react';
import { UserAvatar } from '../../atoms';
import MediaFile from '../MediaFile/MediaFile';
import RepliedMedia from '../RepliedMedia/RepliedMedia';
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
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }, []);

  const renderMessageContent = () => {
    console.log('🎨 MessageItem renderMessageContent - рендерим сообщение:', {
      messageId: message.messageId,
      content: message.content,
      senderUsername: message.senderUsername,
      mediaFilesCount: message.mediaFiles?.length || 0,
      mediaFiles: message.mediaFiles
    });
    
    if (message.mediaFiles && message.mediaFiles.length > 0) {
      console.log('🖼️ MessageItem - в сообщении есть медиафайлы для отображения:', message.mediaFiles);
      message.mediaFiles.forEach((mediaFile, index) => {
        console.log(`📎 MessageItem - медиафайл ${index + 1}:`, {
          id: mediaFile.id,
          fileName: mediaFile.fileName,
          originalFileName: mediaFile.originalFileName,
          filePath: mediaFile.filePath,
          contentType: mediaFile.contentType,
          fileSize: mediaFile.fileSize,
          thumbnailPath: mediaFile.thumbnailPath
        });
      });
    } else {
      console.log('❌ MessageItem - в сообщении нет медиафайлов для отображения');
    }
    
    return (
      <div className="message-content">
        {message.content && (
          <div className="message-text">
            {message.content}
          </div>
        )}
        {message.mediaFiles && message.mediaFiles.length > 0 && (
          <div className="message-media">
            {console.log('🎯 MessageItem - рендерим медиафайлы:', message.mediaFiles)}
            {message.mediaFiles.map((mediaFile) => (
              <MediaFile
                key={mediaFile.id}
                mediaFile={mediaFile}
                canDelete={false}
              />
            ))}
          </div>
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
    
    return (
      <div className="forwarded-message">
        <div className="forwarded-message-header">
          <span>↱ Переслано из {message.forwardedMessage.originalChatName}</span>
        </div>
        <div className="forwarded-message-content">
          <strong>{message.forwardedMessage.senderUsername}:</strong> {message.forwardedMessage.content}
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
            <span className="message-time">{formatTime(message.createdAt)}</span>
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
























