import React, { useMemo, useState } from 'react';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import { buildMediaUrl, openExternalUrl } from '../../../lib/utils/urlHelpers';
import { getUserStatusLabel, normalizeUserStatus, PRESENCE_STATUS } from '../../../lib/utils/userStatus';
import { mapChatParticipantToListItem } from '../../../lib/utils/memberListUtils';
import { usePresence, useResolvedPresence } from '../../../lib/contexts/PresenceContext';
import UserAvatar from '../../atoms/UserAvatar/UserAvatar';
import { UserAvatarPresenceDot } from '../../atoms/UserAvatar';
import UserNameplate from '../../atoms/UserNameplate/UserNameplate';
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

const isBannerImage = (banner) => {
  if (!banner || typeof banner !== 'string') return false;
  if (banner.startsWith('#')) return false;

  const lowerBanner = banner.toLowerCase();
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
  if (imageExtensions.some((ext) => lowerBanner.includes(ext))) return true;

  return (
    banner.startsWith('http://') ||
    banner.startsWith('https://') ||
    banner.startsWith('/uploads/') ||
    banner.startsWith('uploads/') ||
    banner.startsWith('/api/') ||
    banner.startsWith('api/')
  );
};

const resolveBannerImageUrl = (banner) => {
  if (!isBannerImage(banner)) return null;
  if (banner.startsWith('http://') || banner.startsWith('https://')) return banner;
  if (banner.startsWith('/uploads/')) return `${BASE_URL}${banner}`;
  return buildMediaUrl(banner);
};

const getBannerStyle = (banner, fallbackColor = '#5865F2') => {
  if (!banner) {
    return {
      backgroundColor: fallbackColor,
      backgroundImage: 'none',
    };
  }

  const imageUrl = resolveBannerImageUrl(banner);
  if (imageUrl) {
    return {
      backgroundColor: 'transparent',
      backgroundImage: `url(${imageUrl})`,
    };
  }

  if (banner.startsWith('#')) {
    return {
      backgroundColor: banner,
      backgroundImage: 'none',
    };
  }

  return {
    backgroundColor: banner,
    backgroundImage: 'none',
  };
};

const isParticipantOnline = (participant, resolvePresence) => {
  const userId = participant?.userId ?? participant?.UserId ?? null;
  const rawStatus = participant?.userStatus ?? participant?.UserStatus ?? null;
  const status = resolvePresence
    ? resolvePresence(userId, rawStatus)?.normalized
    : normalizeUserStatus(rawStatus);

  return status !== PRESENCE_STATUS.OFFLINE;
};

const ChatInfoParticipantItem = ({ participant, resolvePresence }) => {
  const member = mapChatParticipantToListItem(participant, { resolveStatus: resolvePresence });
  const presence = useResolvedPresence(member.userId, member.status);
  const avatarUrl = member.avatar ? buildMediaUrl(member.avatar) : null;

  return (
    <div
      className="chat-info-participant-item"
      title={`${member.username || 'Пользователь'} — ${getUserStatusLabel(presence.normalized)}`}
    >
      <div className="chat-info-participant-item__layout">
        <div className="user-avatar-slot chat-info-participant-avatar-wrap">
          <UserAvatar
            displayName={member.displayName}
            login={member.login}
            username={member.login}
            avatarUrl={avatarUrl}
            avatarColor={member.avatarColor}
            avatarDecoration={null}
            size={40}
            statusIndicator={<UserAvatarPresenceDot status={presence.normalized} />}
          />
        </div>
        <UserNameplate nameplate={member.nameplate} className="chat-info-participant-nameplate">
          <div className="chat-info-participant-nameplate__body">
            <span className="chat-info-participant-name">
              {member.username || 'Пользователь'}
            </span>
          </div>
        </UserNameplate>
      </div>
    </div>
  );
};

const ChatInfoModal = ({
  open,
  onClose,
  chatInfo,
  mediaFiles = [],
  mediaFilesLoading = false,
  participants = [],
  participantsLoading = false,
  canAddParticipants = true,
  onParticipantsUpdated,
  connection,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const { resolvePresence } = usePresence();
  const sortedParticipants = useMemo(() => {
    if (!participants?.length) {
      return [];
    }

    return [...participants].sort((a, b) => {
      const onlineA = isParticipantOnline(a, resolvePresence);
      const onlineB = isParticipantOnline(b, resolvePresence);
      if (onlineA !== onlineB) {
        return onlineA ? -1 : 1;
      }

      const nameA = a.username ?? a.Username ?? '';
      const nameB = b.username ?? b.Username ?? '';
      return String(nameA).localeCompare(String(nameB), 'ru', { sensitivity: 'base' });
    });
  }, [participants, resolvePresence]);
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
  const images = mediaFiles.filter(file => file.contentType?.startsWith('image/'));
  const videos = mediaFiles.filter(file => file.contentType?.startsWith('video/'));
  const audios = mediaFiles.filter(file => file.contentType?.startsWith('audio/'));
  const documents = mediaFiles.filter(file => {
    const type = file.contentType || '';
    return !type.startsWith('image/') && !type.startsWith('video/') && !type.startsWith('audio/');
  });

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
            <div
              className={`chat-info-user-panel${
                chatInfo?.type === 'group' ? ' chat-info-user-panel--group' : ''
              }`}
            >
              <div
                className={`chat-info-user-content${
                  chatInfo?.type === 'group' ? ' chat-info-user-content--group' : ''
                }`}
              >
                <div className="chat-info-user-header">
                {chatInfo?.type === 'private' && (
                  <div
                    className="chat-info-user-banner"
                    style={getBannerStyle(chatInfo?.banner || chatInfo?.Banner, chatInfo?.avatarColor || '#5865F2')}
                  />
                )}
                {/* Аватар с красивой рамкой */}
                <div className={`chat-info-avatar-container${chatInfo?.type === 'private' ? ' with-banner' : ''}`}>
                  <div className="chat-info-avatar-wrap">
                    <UserAvatar
                      username={
                        chatInfo?.type === 'group' && !chatAvatar
                          ? 'G'
                          : chatInfo?.name
                      }
                      displayName={chatInfo?.type === 'group' ? null : chatInfo?.name}
                      login={chatInfo?.type === 'group' ? null : chatInfo?.name}
                      avatarUrl={
                        chatInfo?.type === 'group'
                          ? chatAvatar
                          : chatInfo?.avatar
                      }
                      avatarColor={
                        chatInfo?.type === 'group'
                          ? chatAvatarColor
                          : chatInfo?.avatarColor
                      }
                      avatarDecoration={
                        chatInfo?.type === 'group' ? null : chatInfo?.avatarDecoration
                      }
                      size={chatInfo?.type === 'group' ? 72 : 100}
                      statusIndicator={
                        chatInfo?.type === 'private' && chatInfo?.status ? (
                          <UserAvatarPresenceDot status={chatInfo.status} />
                        ) : null
                      }
                    />
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
                </div>

                {/* Панель участников для групповых чатов */}
                {chatInfo?.type === 'group' && (
                  <div className="chat-info-participants-panel">
                    <div className="chat-info-participants-header">
                      <h5 className="chat-info-participants-title">
                        Участники
                        {sortedParticipants.length > 0 ? ` · ${sortedParticipants.length}` : ''}
                      </h5>
                      {canAddParticipants && (
                        <button 
                          className="chat-info-add-participant-btn"
                          title="Добавить участника"
                          onClick={handleAddParticipant}
                        >
                          <GroupAdd />
                        </button>
                      )}
                    </div>
                    <div className="chat-info-participants-list">
                      {participantsLoading ? (
                        <div className="chat-info-no-participants">
                          <p>Загрузка участников…</p>
                        </div>
                      ) : sortedParticipants.length > 0 ? (
                        sortedParticipants.map((participant) => (
                          <ChatInfoParticipantItem
                            key={participant.userId ?? participant.UserId}
                            participant={participant}
                            resolvePresence={resolvePresence}
                          />
                        ))
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
                    {mediaFilesLoading ? (
                      <div className="chat-info-empty-state">
                        <p className="chat-info-empty-description">Загрузка медиа…</p>
                      </div>
                    ) : images.length > 0 ? (
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
                    {mediaFilesLoading ? (
                      <div className="chat-info-empty-state">
                        <p className="chat-info-empty-description">Загрузка медиа…</p>
                      </div>
                    ) : videos.length > 0 ? (
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
                    {mediaFilesLoading ? (
                      <div className="chat-info-empty-state">
                        <p className="chat-info-empty-description">Загрузка медиа…</p>
                      </div>
                    ) : audios.length > 0 ? (
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
                    {mediaFilesLoading ? (
                      <div className="chat-info-empty-state">
                        <p className="chat-info-empty-description">Загрузка медиа…</p>
                      </div>
                    ) : documents.length > 0 ? (
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
