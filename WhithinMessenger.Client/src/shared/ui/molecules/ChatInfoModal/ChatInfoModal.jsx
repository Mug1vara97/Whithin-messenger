import React, { useState } from 'react';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import { buildMediaUrl, openExternalUrl } from '../../../lib/utils/urlHelpers';
import ImagePreview from '../ImagePreview/ImagePreview';
import AddUserModal from '../AddUserModal/AddUserModal';
import ChatAvatarUpload from '../ChatAvatarUpload/ChatAvatarUpload';
import { 
  GroupAdd, 
  Image, 
  VideoFile, 
  AudioFile, 
  AttachFile, 
  Settings, 
  Close,
  PhotoLibrary,
  VideoLibrary,
  MusicNote,
  Description,
  Delete
} from '@mui/icons-material';
import './ChatInfoModal.css';

const ChatInfoModal = ({ open, onClose, chatInfo, mediaFiles = [], participants = [], onParticipantsUpdated, connection }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [chatAvatar, setChatAvatar] = useState(chatInfo?.chatAvatar);
  const [chatAvatarColor, setChatAvatarColor] = useState(chatInfo?.chatAvatarColor);

  // Обновляем локальное состояние при изменении chatInfo
  React.useEffect(() => {
    setChatAvatar(chatInfo?.chatAvatar);
    setChatAvatarColor(chatInfo?.chatAvatarColor);
  }, [chatInfo?.chatAvatar, chatInfo?.chatAvatarColor]);

  // Обработчик удаления чата
  React.useEffect(() => {
    if (connection) {
      const handleChatDeleted = (data) => {
        // Если удален текущий чат, закрываем модальное окно
        if (typeof data === 'object' && data.chatId === chatInfo?.chatId) {
          onClose();
        } else if (typeof data === 'string' && data === chatInfo?.chatId) {
          onClose();
        }
      };

      connection.on('chatdeleted', handleChatDeleted);

      return () => {
        connection.off('chatdeleted', handleChatDeleted);
      };
    }
  }, [connection, chatInfo?.chatId, onClose]);
  
  // Отладочная информация
  const [showAddUserModal, setShowAddUserModal] = useState(false);


  const handleTabChange = (tabIndex) => {
    setActiveTab(tabIndex);
  };

  const handleMediaClick = (media) => {
    setSelectedMedia(media);
  };

  const handleAddParticipant = () => {
    console.log('🔍 ChatInfoModal - Add participant clicked');
    setShowAddUserModal(true);
  };

  const handleUserAdded = (userId) => {
    console.log('🔍 ChatInfoModal - User added:', userId);
    // Закрываем модальное окно добавления
    setShowAddUserModal(false);
    
    // Уведомляем родительский компонент об обновлении участников
    if (onParticipantsUpdated) {
      onParticipantsUpdated();
    }
  };

  const handleAvatarUpdated = (newAvatarUrl) => {
    console.log('🔍 ChatInfoModal - Avatar updated:', newAvatarUrl);
    setChatAvatar(newAvatarUrl);
    // Можно также уведомить родительский компонент об обновлении
  };

  const handleDeleteChat = async () => {
    if (!chatInfo?.chatId || !connection) {
      console.error('ChatInfoModal: Missing chatId or connection for delete');
      return;
    }

    if (window.confirm('Вы уверены, что хотите удалить этот чат? Это действие нельзя отменить.')) {
      try {
        // Проверяем состояние соединения перед вызовом
        if (connection.state !== 'Connected') {
          console.warn('ChatInfoModal: Connection not ready, waiting...');
          // Ждем немного и пробуем снова
          setTimeout(async () => {
            try {
              await connection.invoke('DeleteChat', chatInfo.chatId);
              onClose();
            } catch (retryError) {
              console.error('ChatInfoModal: Error on retry:', retryError);
              alert('Ошибка при удалении чата. Попробуйте еще раз.');
            }
          }, 1000);
          return;
        }

        await connection.invoke('DeleteChat', chatInfo.chatId);
        onClose(); // Закрываем модальное окно после удаления
      } catch (error) {
        console.error('ChatInfoModal: Error deleting chat:', error);
        // Не показываем alert для ошибок соединения, так как это может быть нормально
        if (!error.message.includes('connection being closed') && !error.message.includes('Invocation canceled')) {
          alert('Ошибка при удалении чата: ' + error.message);
        }
      }
    }
  };

  const getMediaIcon = (contentType) => {
    if (contentType.startsWith('image/')) return <Image />;
    if (contentType.startsWith('video/')) return <VideoFile />;
    if (contentType.startsWith('audio/')) return <AudioFile />;
    return <AttachFile />;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };


  // Группируем медиафайлы по типу
  const images = mediaFiles.filter(file => file.contentType.startsWith('image/'));
  const videos = mediaFiles.filter(file => file.contentType.startsWith('video/'));
  const audios = mediaFiles.filter(file => file.contentType.startsWith('audio/'));
  const documents = mediaFiles.filter(file => 
    !file.contentType.startsWith('image/') && 
    !file.contentType.startsWith('video/') && 
    !file.contentType.startsWith('audio/')
  );

  const renderMediaGrid = (files, type) => (
    <div className="chat-info-media-grid">
      {files.map((file) => (
        <div key={file.id} className="chat-info-media-item">
          <div 
            className="chat-info-media-card" 
            onClick={() => handleMediaClick(file)}
          >
            {type === 'image' ? (
              <img
                src={buildMediaUrl(file.filePath)}
                alt={file.originalFileName}
                className="chat-info-media-image"
              />
            ) : (
              <div className="chat-info-media-icon-container">
                <span className="chat-info-media-icon">{getMediaIcon(file.contentType)}</span>
              </div>
            )}
            <div className="chat-info-media-content">
              <div className="chat-info-media-filename" title={file.originalFileName}>
                {file.originalFileName}
              </div>
              <div className="chat-info-media-size">
                {formatFileSize(file.fileSize)}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  if (!open) return null;

  return (
    <>
      <div className="chat-info-modal-overlay" onClick={onClose}>
        <div className="chat-info-modal-container" onClick={(e) => e.stopPropagation()}>
          <div className="chat-info-modal-header">
            <div className="chat-info-modal-header-content">
              <h2 className="chat-info-modal-title">
                Информация о {chatInfo?.type === 'private' ? 'приватном чате' : 'групповом чате'}
              </h2>
              <button className="chat-info-close-button" onClick={onClose}>
                <Close />
              </button>
            </div>
          </div>

          <div className="chat-info-modal-content">
          {/* Единый layout для всех типов чатов: слева информация о чате, справа табы */}
          <div className="chat-info-private-layout">
            {/* Левая панель с информацией о чате */}
            <div className="chat-info-user-panel">
              <div className="chat-info-user-content">
                {/* Аватар с красивой рамкой */}
                <div className="chat-info-avatar-container">
                  <div 
                    className="chat-info-user-avatar"
                    style={{
                      backgroundColor: chatInfo?.type === 'group' 
                        ? (chatAvatar ? 'transparent' : (chatAvatarColor || '#5865F2'))
                        : (chatInfo?.avatarColor || '#5865F2'),
                      backgroundImage: chatInfo?.type === 'group'
                        ? (chatAvatar?.startsWith('/uploads/') 
                            ? `url(${BASE_URL}${chatAvatar})` 
                            : (chatAvatar?.startsWith('http') ? `url(${chatAvatar})` : 'none'))
                        : (chatInfo?.avatar?.startsWith('/uploads/') 
                            ? `url(${BASE_URL}${chatInfo.avatar})` 
                            : (chatInfo?.avatar?.startsWith('http') ? `url(${chatInfo.avatar})` : 'none')),
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  >
                    {((chatInfo?.type === 'group' && !chatAvatar) || 
                      (chatInfo?.type === 'private' && !chatInfo?.avatar)) && (
                      chatInfo?.name?.charAt(0) || (chatInfo?.type === 'private' ? 'U' : 'G')
                    )}
                  </div>
                </div>
                
                <div className="chat-info-user-details">
                  <h4 className="chat-info-user-name">
                    {chatInfo?.name || (chatInfo?.type === 'private' ? 'Пользователь' : 'Групповой чат')}
                  </h4>
                  
                  {/* Кнопка удаления чата для приватных чатов */}
                  {chatInfo?.type === 'private' && (
                    <button 
                      className="chat-info-delete-button"
                      onClick={handleDeleteChat}
                      title="Удалить чат"
                    >
                      Удалить чат
                    </button>
                  )}
                </div>

                {/* Панель участников для групповых чатов */}
                {chatInfo?.type === 'group' && (
                  <div className="chat-info-participants-panel">
                    <div className="chat-info-participants-header">
                      <h5 className="chat-info-participants-title">Участники</h5>
                      <button 
                        className="chat-info-add-participant-btn"
                        title="Добавить участника"
                        onClick={handleAddParticipant}
                      >
                        <GroupAdd />
                      </button>
                    </div>
                    <div className="chat-info-participants-list">
                      {participants && participants.length > 0 ? (
                        participants.map((participant) => {
                          console.log('ChatInfoModal - Rendering participant:', participant);
                          console.log('ChatInfoModal - Avatar URL:', participant.avatarUrl);
                          console.log('ChatInfoModal - Avatar Color:', participant.avatarColor);
                          console.log('ChatInfoModal - Full avatar URL:', participant.avatarUrl ? `${BASE_URL}${participant.avatarUrl}` : 'No avatar');
                          return (
                          <div key={participant.userId} className="chat-info-participant-item">
                            <div 
                              className="chat-info-participant-avatar"
                              style={{
                                backgroundColor: participant.avatarUrl ? 'transparent' : (participant.avatarColor || '#5865F2'),
                                backgroundImage: participant.avatarUrl?.startsWith('/uploads/') 
                                  ? `url(${BASE_URL}${participant.avatarUrl})` 
                                  : (participant.avatarUrl?.startsWith('http') ? `url(${participant.avatarUrl})` : 'none'),
                                backgroundSize: 'cover',
                                backgroundPosition: 'center'
                              }}
                            >
                              {!participant.avatarUrl && (
                                <span style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>
                                  {participant.username?.charAt(0) || 'U'}
                                </span>
                              )}
                            </div>
                          <div className="chat-info-participant-info">
                            <span className="chat-info-participant-name">{participant.username || 'Пользователь'}</span>
                            <span className="chat-info-participant-status">
                              {participant.userStatus === 'online' ? 'В сети' : 
                               participant.userStatus === 'away' ? 'Отошел' : 'Не в сети'}
                            </span>
                          </div>
                        </div>
                        );
                        })
                      ) : (
                        <div className="chat-info-no-participants">
                          <p>Участники не загружены</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Правая панель с табами и галереей */}
            <div className="chat-info-media-panel">
              <div className="chat-info-media-tabs">
                <div className="chat-info-tabs-container">
                  <button 
                    className={`chat-info-tab-button ${activeTab === 0 ? 'active' : ''}`}
                    onClick={() => handleTabChange(0)}
                  >
                    <span className="chat-info-tab-icon"><PhotoLibrary /></span>
                    <span className="chat-info-tab-label">Фото</span>
                  </button>
                  <button 
                    className={`chat-info-tab-button ${activeTab === 1 ? 'active' : ''}`}
                    onClick={() => handleTabChange(1)}
                  >
                    <span className="chat-info-tab-icon"><VideoLibrary /></span>
                    <span className="chat-info-tab-label">Видео</span>
                  </button>
                  <button 
                    className={`chat-info-tab-button ${activeTab === 2 ? 'active' : ''}`}
                    onClick={() => handleTabChange(2)}
                  >
                    <span className="chat-info-tab-icon"><MusicNote /></span>
                    <span className="chat-info-tab-label">Аудио</span>
                  </button>
                  <button 
                    className={`chat-info-tab-button ${activeTab === 3 ? 'active' : ''}`}
                    onClick={() => handleTabChange(3)}
                  >
                    <span className="chat-info-tab-icon"><AttachFile /></span>
                    <span className="chat-info-tab-label">Файлы</span>
                  </button>
                  {chatInfo?.type === 'group' && (
                    <button 
                      className={`chat-info-tab-button ${activeTab === 4 ? 'active' : ''}`}
                      onClick={() => handleTabChange(4)}
                    >
                      <span className="chat-info-tab-icon"><Settings /></span>
                      <span className="chat-info-tab-label">Настройки</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="chat-info-media-content">
                {/* Таб фотографий */}
                {activeTab === 0 && (
                  <div className="chat-info-media-section">
                    {images.length > 0 ? (
                      renderMediaGrid(images, 'image')
                    ) : (
                      <div className="chat-info-empty-state">
                        <div className="chat-info-empty-icon"><PhotoLibrary /></div>
                        <h4 className="chat-info-empty-title">Нет фотографий</h4>
                        <p className="chat-info-empty-description">
                          Фотографии, отправленные в этом чате, появятся здесь
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Таб видео */}
                {activeTab === 1 && (
                  <div className="chat-info-media-section">
                    {videos.length > 0 ? (
                      renderMediaGrid(videos, 'video')
                    ) : (
                      <div className="chat-info-empty-state">
                        <div className="chat-info-empty-icon"><VideoLibrary /></div>
                        <h4 className="chat-info-empty-title">Нет видео</h4>
                        <p className="chat-info-empty-description">
                          Видео, отправленные в этом чате, появятся здесь
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Таб аудио */}
                {activeTab === 2 && (
                  <div className="chat-info-media-section">
                    {audios.length > 0 ? (
                      renderMediaGrid(audios, 'audio')
                    ) : (
                      <div className="chat-info-empty-state">
                        <div className="chat-info-empty-icon"><MusicNote /></div>
                        <h4 className="chat-info-empty-title">Нет аудио</h4>
                        <p className="chat-info-empty-description">
                          Аудиофайлы, отправленные в этом чате, появятся здесь
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Таб файлов */}
                {activeTab === 3 && (
                  <div className="chat-info-media-section">
                    {documents.length > 0 ? (
                      renderMediaGrid(documents, 'document')
                    ) : (
                      <div className="chat-info-empty-state">
                        <div className="chat-info-empty-icon"><AttachFile /></div>
                        <h4 className="chat-info-empty-title">Нет файлов</h4>
                        <p className="chat-info-empty-description">
                          Файлы, отправленные в этом чате, появятся здесь
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Таб настроек (только для групповых чатов) */}
                {activeTab === 4 && chatInfo?.type === 'group' && (
                  <div className="chat-info-media-section">
                    <ChatAvatarUpload
                      chatId={chatInfo.chatId}
                      currentAvatar={chatAvatar}
                      currentAvatarColor={chatAvatarColor}
                      onAvatarUpdated={handleAvatarUpdated}
                      connection={connection}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Просмотр медиафайлов - вынесен из модального окна */}
      {selectedMedia && selectedMedia.contentType.startsWith('image/') && (
        <ImagePreview 
          mediaFile={selectedMedia}
          isOpen={!!selectedMedia}
          onClose={() => setSelectedMedia(null)}
        />
      )}
      
      {/* Простое модальное окно для видео, аудио и файлов */}
      {selectedMedia && !selectedMedia.contentType.startsWith('image/') && (
        <div className="chat-info-media-modal-overlay" onClick={() => setSelectedMedia(null)}>
          <div className="chat-info-media-modal" onClick={(e) => e.stopPropagation()}>
            <div className="chat-info-media-modal-header">
              <h3 className="chat-info-media-modal-title">{selectedMedia.originalFileName}</h3>
              <button className="chat-info-close-button" onClick={() => setSelectedMedia(null)}>
                <Close />
              </button>
            </div>
            <div className="chat-info-media-modal-content">
              {selectedMedia.contentType.startsWith('video/') ? (
                <video 
                  src={buildMediaUrl(selectedMedia.filePath)}
                  controls 
                  className="chat-info-media-preview-video"
                />
              ) : selectedMedia.contentType.startsWith('audio/') ? (
                <audio 
                  src={buildMediaUrl(selectedMedia.filePath)}
                  controls 
                  className="chat-info-media-preview-audio"
                />
              ) : (
                <div className="chat-info-media-preview-file">
                  <div className="chat-info-file-icon">{getMediaIcon(selectedMedia.contentType)}</div>
                  <h4 className="chat-info-file-name">{selectedMedia.originalFileName}</h4>
                  <p className="chat-info-file-size">{formatFileSize(selectedMedia.fileSize)}</p>
                  <a 
                    href={buildMediaUrl(selectedMedia.filePath)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="chat-info-download-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      openExternalUrl(buildMediaUrl(selectedMedia.filePath));
                    }}
                  >
                    Скачать файл
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно добавления пользователей */}
      <AddUserModal
        open={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        chatId={chatInfo?.chatId}
        onUserAdded={handleUserAdded}
        connection={connection}
      />
    </>
  );
};

export default ChatInfoModal;
