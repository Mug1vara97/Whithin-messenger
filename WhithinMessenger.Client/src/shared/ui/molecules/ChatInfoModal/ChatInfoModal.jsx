import React, { useMemo, useState } from 'react';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import { buildMediaUrl, openExternalUrl } from '../../../lib/utils/urlHelpers';
import {
  getUserStatusColor,
  getUserStatusLabel,
  normalizeUserStatus,
  PRESENCE_STATUS,
} from '../../../lib/utils/userStatus';
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
  DeleteOutline,
  People,
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

const formatFileSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const getMediaIcon = (contentType) => {
  if (contentType?.startsWith('image/')) return <Image />;
  if (contentType?.startsWith('video/')) return <VideoFile />;
  if (contentType?.startsWith('audio/')) return <AudioFile />;
  return <AttachFile />;
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
            avatarDecoration={member.avatarDecoration}
            size={40}
            statusIndicator={<UserAvatarPresenceDot status={presence.normalized} />}
          />
        </div>
        <UserNameplate nameplate={member.nameplate} className="chat-info-participant-nameplate">
          <div className="chat-info-participant-nameplate__body">
            <div className="chat-info-participant-text">
              <span className="chat-info-participant-name">
                {member.username || 'Пользователь'}
              </span>
              <span className="chat-info-participant-status">
                {getUserStatusLabel(presence.normalized)}
              </span>
            </div>
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
  const isPrivate = chatInfo?.type === 'private';
  const isGroup = chatInfo?.type === 'group';

  const privatePresence = useResolvedPresence(
    isPrivate ? chatInfo?.userId : null,
    chatInfo?.status,
  );

  const sortedParticipants = useMemo(() => {
    if (!participants?.length) return [];

    return [...participants].sort((a, b) => {
      const onlineA = isParticipantOnline(a, resolvePresence);
      const onlineB = isParticipantOnline(b, resolvePresence);
      if (onlineA !== onlineB) return onlineA ? -1 : 1;

      const nameA = a.username ?? a.Username ?? '';
      const nameB = b.username ?? b.Username ?? '';
      return String(nameA).localeCompare(String(nameB), 'ru', { sensitivity: 'base' });
    });
  }, [participants, resolvePresence]);

  const [selectedMedia, setSelectedMedia] = useState(null);
  const [chatAvatar, setChatAvatar] = useState(chatInfo?.chatAvatar);
  const [chatAvatarColor, setChatAvatarColor] = useState(chatInfo?.chatAvatarColor);
  const [showAddUserModal, setShowAddUserModal] = useState(false);

  React.useEffect(() => {
    setChatAvatar(chatInfo?.chatAvatar);
    setChatAvatarColor(chatInfo?.chatAvatarColor);
  }, [chatInfo?.chatAvatar, chatInfo?.chatAvatarColor]);

  React.useEffect(() => {
    if (!connection) return undefined;

    const handleChatDeleted = (data) => {
      if (typeof data === 'object' && data.chatId === chatInfo?.chatId) {
        onClose();
      } else if (typeof data === 'string' && data === chatInfo?.chatId) {
        onClose();
      }
    };

    connection.on('chatdeleted', handleChatDeleted);
    return () => connection.off('chatdeleted', handleChatDeleted);
  }, [connection, chatInfo?.chatId, onClose]);

  const images = mediaFiles.filter((file) => file.contentType?.startsWith('image/'));
  const videos = mediaFiles.filter((file) => file.contentType?.startsWith('video/'));
  const audios = mediaFiles.filter((file) => file.contentType?.startsWith('audio/'));
  const documents = mediaFiles.filter((file) => {
    const type = file.contentType || '';
    return !type.startsWith('image/') && !type.startsWith('video/') && !type.startsWith('audio/');
  });

  const tabs = useMemo(() => {
    const items = [
      { id: 0, label: 'Фото', icon: <PhotoLibrary />, count: images.length },
      { id: 1, label: 'Видео', icon: <VideoLibrary />, count: videos.length },
      { id: 2, label: 'Аудио', icon: <MusicNote />, count: audios.length },
      { id: 3, label: 'Файлы', icon: <AttachFile />, count: documents.length },
    ];
    if (isGroup) {
      items.push({ id: 4, label: 'Настройки', icon: <Settings />, count: null });
    }
    return items;
  }, [images.length, videos.length, audios.length, documents.length, isGroup]);

  const totalMediaCount = images.length + videos.length + audios.length + documents.length;

  const handleDeleteChat = async () => {
    if (!chatInfo?.chatId || !connection) return;

    if (!window.confirm('Удалить этот чат? История сообщений будет скрыта.')) return;

    try {
      if (connection.state !== 'Connected') {
        setTimeout(async () => {
          try {
            await connection.invoke('DeleteChat', chatInfo.chatId);
            onClose();
          } catch {
            alert('Ошибка при удалении чата. Попробуйте ещё раз.');
          }
        }, 1000);
        return;
      }

      await connection.invoke('DeleteChat', chatInfo.chatId);
      onClose();
    } catch (error) {
      if (
        !error.message?.includes('connection being closed') &&
        !error.message?.includes('Invocation canceled')
      ) {
        alert(`Ошибка при удалении чата: ${error.message}`);
      }
    }
  };

  const renderPhotoGrid = () => (
    <div className="chat-info-photo-grid">
      {images.map((file) => (
        <button
          key={file.id}
          type="button"
          className="chat-info-photo-tile"
          onClick={() => setSelectedMedia(file)}
          title={file.originalFileName}
        >
          <img
            src={buildMediaUrl(file.filePath)}
            alt={file.originalFileName}
            className="chat-info-photo-tile__image"
            loading="lazy"
          />
        </button>
      ))}
    </div>
  );

  const renderFileList = (files) => (
    <div className="chat-info-file-list">
      {files.map((file) => (
        <button
          key={file.id}
          type="button"
          className="chat-info-file-row"
          onClick={() => setSelectedMedia(file)}
        >
          <span className="chat-info-file-row__icon">{getMediaIcon(file.contentType)}</span>
          <span className="chat-info-file-row__meta">
            <span className="chat-info-file-row__name" title={file.originalFileName}>
              {file.originalFileName}
            </span>
            <span className="chat-info-file-row__size">{formatFileSize(file.fileSize)}</span>
          </span>
        </button>
      ))}
    </div>
  );

  const renderEmptyState = (icon, title, description) => (
    <div className="chat-info-empty-state">
      <div className="chat-info-empty-state__icon">{icon}</div>
      <h4 className="chat-info-empty-state__title">{title}</h4>
      <p className="chat-info-empty-state__text">{description}</p>
    </div>
  );

  const renderTabPanel = () => {
    if (mediaFilesLoading && activeTab < 4) {
      return (
        <div className="chat-info-loading">
          <div className="chat-info-loading__spinner" />
          <p>Загрузка медиа…</p>
        </div>
      );
    }

    if (activeTab === 0) {
      return images.length > 0
        ? renderPhotoGrid()
        : renderEmptyState(
            <PhotoLibrary />,
            'Нет фотографий',
            'Изображения из этого чата появятся здесь',
          );
    }

    if (activeTab === 1) {
      return videos.length > 0
        ? renderFileList(videos)
        : renderEmptyState(
            <VideoLibrary />,
            'Нет видео',
            'Видео из этого чата появятся здесь',
          );
    }

    if (activeTab === 2) {
      return audios.length > 0
        ? renderFileList(audios)
        : renderEmptyState(
            <MusicNote />,
            'Нет аудио',
            'Аудиофайлы из этого чата появятся здесь',
          );
    }

    if (activeTab === 3) {
      return documents.length > 0
        ? renderFileList(documents)
        : renderEmptyState(
            <AttachFile />,
            'Нет файлов',
            'Документы из этого чата появятся здесь',
          );
    }

    if (activeTab === 4 && isGroup) {
      return (
        <div className="chat-info-settings-panel">
          <ChatAvatarUpload
            chatId={chatInfo.chatId}
            currentAvatar={chatAvatar}
            currentAvatarColor={chatAvatarColor}
            onAvatarUpdated={(url) => setChatAvatar(url)}
            connection={connection}
          />
        </div>
      );
    }

    return null;
  };

  const displayName =
    chatInfo?.name || (isPrivate ? 'Пользователь' : 'Групповой чат');

  const heroAccent = chatInfo?.avatarColor || chatAvatarColor || '#5865F2';
  const statusLabel = isPrivate
    ? getUserStatusLabel(privatePresence.normalized ?? chatInfo?.status)
    : null;
  const statusColor = isPrivate
    ? getUserStatusColor(privatePresence.normalized ?? chatInfo?.status)
    : null;

  if (!open) return null;

  return (
    <>
      <div className="chat-info-modal-overlay" onClick={onClose}>
        <div
          className="chat-info-modal-container"
          role="dialog"
          aria-label="Информация о чате"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="chat-info-modal-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <Close fontSize="small" />
          </button>

          <div className="chat-info-modal-body">
            <aside className="chat-info-sidebar">
              <div className="chat-info-hero">
                <div
                  className={`chat-info-hero__banner${isGroup ? ' chat-info-hero__banner--group' : ''}`}
                  style={
                    isPrivate
                      ? getBannerStyle(chatInfo?.banner || chatInfo?.Banner, heroAccent)
                      : {
                          background: `linear-gradient(135deg, ${heroAccent} 0%, color-mix(in srgb, ${heroAccent} 55%, #000) 100%)`,
                        }
                  }
                >
                  <div className="chat-info-hero__shade" />
                </div>

                <div className="chat-info-hero__identity">
                  <div
                    className={`chat-info-hero__avatar${isPrivate ? ' chat-info-hero__avatar--private' : ''}`}
                  >
                    <UserAvatar
                      username={isGroup && !chatAvatar ? 'G' : displayName}
                      displayName={isGroup ? null : displayName}
                      login={isGroup ? null : displayName}
                      avatarUrl={isGroup ? chatAvatar : chatInfo?.avatar}
                      avatarColor={isGroup ? chatAvatarColor : chatInfo?.avatarColor}
                      avatarDecoration={isGroup ? null : chatInfo?.avatarDecoration}
                      size={isGroup ? 72 : 88}
                      statusIndicator={
                        isPrivate && chatInfo?.status ? (
                          <UserAvatarPresenceDot
                            status={privatePresence.normalized ?? chatInfo.status}
                          />
                        ) : null
                      }
                    />
                  </div>

                  <h2 className="chat-info-hero__name">{displayName}</h2>

                  {isPrivate && statusLabel && (
                    <div className="chat-info-hero__status">
                      <span
                        className="chat-info-hero__status-dot"
                        style={{ backgroundColor: statusColor }}
                      />
                      <span>{statusLabel}</span>
                    </div>
                  )}

                  {isGroup && (
                    <p className="chat-info-hero__meta">
                      <People fontSize="inherit" />
                      {sortedParticipants.length > 0
                        ? `${sortedParticipants.length} участник${sortedParticipants.length === 1 ? '' : sortedParticipants.length < 5 ? 'а' : 'ов'}`
                        : 'Групповой чат'}
                    </p>
                  )}

                  {totalMediaCount > 0 && (
                    <div className="chat-info-hero__stats">
                      {images.length > 0 && (
                        <span className="chat-info-stat-chip">
                          <PhotoLibrary fontSize="inherit" />
                          {images.length}
                        </span>
                      )}
                      {videos.length > 0 && (
                        <span className="chat-info-stat-chip">
                          <VideoLibrary fontSize="inherit" />
                          {videos.length}
                        </span>
                      )}
                      {documents.length + audios.length > 0 && (
                        <span className="chat-info-stat-chip">
                          <AttachFile fontSize="inherit" />
                          {documents.length + audios.length}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {isPrivate && (
                <div className="chat-info-sidebar__danger">
                  <button
                    type="button"
                    className="chat-info-danger-btn"
                    onClick={handleDeleteChat}
                  >
                    <DeleteOutline fontSize="small" />
                    Удалить чат
                  </button>
                </div>
              )}

              {isGroup && (
                <div className="chat-info-participants-panel">
                  <div className="chat-info-participants-header">
                    <h3 className="chat-info-participants-title">
                      Участники
                      {sortedParticipants.length > 0 ? ` · ${sortedParticipants.length}` : ''}
                    </h3>
                    {canAddParticipants && (
                      <button
                        type="button"
                        className="chat-info-add-participant-btn"
                        title="Добавить участника"
                        onClick={() => setShowAddUserModal(true)}
                      >
                        <GroupAdd fontSize="small" />
                      </button>
                    )}
                  </div>
                  <div className="chat-info-participants-list">
                    {participantsLoading ? (
                      <div className="chat-info-no-participants">Загрузка участников…</div>
                    ) : sortedParticipants.length > 0 ? (
                      sortedParticipants.map((participant) => (
                        <ChatInfoParticipantItem
                          key={participant.userId ?? participant.UserId}
                          participant={participant}
                          resolvePresence={resolvePresence}
                        />
                      ))
                    ) : (
                      <div className="chat-info-no-participants">Участники не загружены</div>
                    )}
                  </div>
                </div>
              )}
            </aside>

            <main className="chat-info-main">
              <nav className="chat-info-tabs" aria-label="Медиа чата">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`chat-info-tab${activeTab === tab.id ? ' chat-info-tab--active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <span className="chat-info-tab__icon">{tab.icon}</span>
                    <span className="chat-info-tab__label">{tab.label}</span>
                    {tab.count != null && tab.count > 0 && (
                      <span className="chat-info-tab__count">{tab.count}</span>
                    )}
                  </button>
                ))}
              </nav>

              <div className="chat-info-main__content">{renderTabPanel()}</div>
            </main>
          </div>
        </div>
      </div>

      {selectedMedia && selectedMedia.contentType?.startsWith('image/') && (
        <ImagePreview
          mediaFile={selectedMedia}
          isOpen={!!selectedMedia}
          onClose={() => setSelectedMedia(null)}
        />
      )}

      {selectedMedia && !selectedMedia.contentType?.startsWith('image/') && (
        <div className="chat-info-media-modal-overlay" onClick={() => setSelectedMedia(null)}>
          <div className="chat-info-media-modal" onClick={(e) => e.stopPropagation()}>
            <div className="chat-info-media-modal-header">
              <h3 className="chat-info-media-modal-title">{selectedMedia.originalFileName}</h3>
              <button
                type="button"
                className="chat-info-modal-close"
                onClick={() => setSelectedMedia(null)}
              >
                <Close fontSize="small" />
              </button>
            </div>
            <div className="chat-info-media-modal-content">
              {selectedMedia.contentType?.startsWith('video/') ? (
                <video
                  src={buildMediaUrl(selectedMedia.filePath)}
                  controls
                  className="chat-info-media-preview-video"
                />
              ) : selectedMedia.contentType?.startsWith('audio/') ? (
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

      <AddUserModal
        open={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        chatId={chatInfo?.chatId}
        onUserAdded={() => {
          setShowAddUserModal(false);
          onParticipantsUpdated?.();
        }}
        connection={connection}
      />
    </>
  );
};

export default ChatInfoModal;
