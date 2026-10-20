import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import AddIcon from '@mui/icons-material/Add';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { userApi } from '../../../../entities/user/api';
import { feedApi, formatFeedTime } from '../../../../entities/feed';
import { MEDIA_BASE_URL } from '../../../lib/constants/apiEndpoints';
import { useAuthContext } from '../../../lib/contexts/AuthContext';
import { PROFILE_UPDATED_EVENT } from '../../../lib/contexts/ProfileModalContext';
import { normalizeUserStatus } from '../../../lib/utils/userStatus';
import { mergeProfileState, normalizeProfilePayload } from '../../../lib/utils/profilePatchHelpers';
import { resolveUserDisplayName, resolveAvatarInitial } from '../../../lib/utils/userDisplayNameHelpers';
import UserNameplate from '../../atoms/UserNameplate';
import { resolveAvatarDecorationUrl } from '../../../lib/utils/avatarDecorationHelpers';
import AvatarDecorationMedia from '../../atoms/UserAvatar/AvatarDecorationMedia';
import ImagePreview from '../../molecules/ImagePreview/ImagePreview';
import { buildMediaUrl, downloadMediaFile } from '../../../lib/utils/urlHelpers';
import CreateFeedPostModal from '../../../../widgets/feed-panel/ui/CreateFeedPostModal';
import './ProfileModal.css';

const MAX_BIO_LENGTH = 190;

const resolveMediaUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${MEDIA_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

const isBannerImage = (banner) =>
  banner && (banner.startsWith('/uploads/') || banner.startsWith('http'));

const formatFileSize = (bytes) => {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
};

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return formatFeedTime(timestamp);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин. назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} дн. назад`;
  return formatFeedTime(timestamp);
};

const ProfileModal = ({
  isOpen,
  onClose,
  userId,
  username,
  isOwnProfile = true,
  initialStatus = null,
  onOpenSettings,
  onProfileUpdated,
}) => {
  const [profile, setProfile] = useState(null);
  const [bioDraft, setBioDraft] = useState('');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [isSavingBio, setIsSavingBio] = useState(false);
  const [bioError, setBioError] = useState('');
  const [copyHint, setCopyHint] = useState('');
  const [profilePosts, setProfilePosts] = useState([]);
  const [postsError, setPostsError] = useState('');
  const [postsLoading, setPostsLoading] = useState(false);
  const [previewMedia, setPreviewMedia] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const { user } = useAuthContext();

  const profileUserId = profile?.userId ?? profile?.UserId;
  const profileMatchesUser =
    profileUserId != null && userId != null && String(profileUserId) === String(userId);
  const activeProfile = profileMatchesUser ? profile : null;

  const login = activeProfile?.username?.trim() || '';
  const profileDisplayName = activeProfile?.displayName ?? activeProfile?.DisplayName ?? null;
  const openerVisibleName = (username || '').trim();
  const visibleName = (() => {
    if (isOwnProfile) {
      if (activeProfile) {
        return resolveUserDisplayName({
          displayName: profileDisplayName,
          username: login,
        });
      }
      return resolveUserDisplayName({
        displayName: user?.displayName ?? user?.DisplayName,
        username: login || openerVisibleName,
        fallback: openerVisibleName || 'Пользователь',
      });
    }

    if (openerVisibleName) {
      return openerVisibleName;
    }

    if (activeProfile) {
      return resolveUserDisplayName({
        displayName: profileDisplayName,
        username: login,
      });
    }

    return 'Пользователь';
  })();
  const avatarInitial = resolveAvatarInitial({
    displayName: profileDisplayName,
    login,
    fallback: username || 'П',
  });
  const accentColor = activeProfile?.avatarColor || '#5865f2';

  const bannerStyle = useMemo(() => {
    const banner = activeProfile?.banner;
    if (isBannerImage(banner)) {
      return {
        backgroundImage: `url(${resolveMediaUrl(banner)})`,
        backgroundColor: 'transparent',
      };
    }
    if (banner?.startsWith('#')) {
      return {
        backgroundImage: `linear-gradient(135deg, ${banner} 0%, ${banner}cc 50%, ${accentColor}88 100%)`,
        backgroundColor: banner,
      };
    }
    return {
      backgroundImage: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}99 45%, #1e1f22 100%)`,
      backgroundColor: accentColor,
    };
  }, [activeProfile?.banner, accentColor]);

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await userApi.getProfile(userId);
      const normalized = normalizeProfilePayload(data);
      const next = {
        ...data,
        ...(normalized || {}),
        status: data?.status ?? data?.Status,
        createdAt: data?.createdAt ?? data?.CreatedAt,
      };
      setProfile(next);
      setBioDraft(next.description || next.Description || '');
      onProfileUpdated?.(next);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }, [userId, onProfileUpdated]);

  const loadPosts = useCallback(async () => {
    if (!userId) return;
    setPostsLoading(true);
    setPostsError('');
    try {
      const posts = await feedApi.getUserPosts(userId);
      setProfilePosts(posts);
    } catch (error) {
      setProfilePosts([]);
      setPostsError(
        error?.response?.data?.error ||
          (error?.response?.status === 403
            ? 'Публикации видны только друзьям'
            : 'Не удалось загрузить публикации'),
      );
    } finally {
      setPostsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!isOpen || !userId) return;

    setProfile(
      initialStatus != null ? { status: normalizeUserStatus(initialStatus) } : null,
    );
    setBioDraft('');
    setCopyHint('');
    setIsEditingBio(false);
    setBioError('');
    setComposerOpen(false);
    loadProfile();
  }, [isOpen, userId, loadProfile, initialStatus]);

  useEffect(() => {
    if (isOpen) return;
    setProfile(null);
    setBioDraft('');
    setCopyHint('');
    setIsEditingBio(false);
    setBioError('');
    setProfilePosts([]);
    setPreviewMedia(null);
    setComposerOpen(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !userId) {
      return undefined;
    }

    const handleProfileUpdated = (event) => {
      const patch = event.detail;
      if (!patch?.userId || String(patch.userId) !== String(userId)) {
        return;
      }

      setProfile((prev) => mergeProfileState(prev, patch));
      if (patch.description !== undefined) {
        setBioDraft(patch.description || '');
      }
    };

    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
  }, [isOpen, userId]);

  useEffect(() => {
    if (!isOpen || !userId) {
      setProfilePosts([]);
      setPostsError('');
      return undefined;
    }

    void loadPosts();
    return undefined;
  }, [isOpen, userId, loadPosts]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !composerOpen && !previewMedia) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, composerOpen, previewMedia]);

  const handleSaveBio = async () => {
    if (!isOwnProfile || !userId) return;
    setIsSavingBio(true);
    setBioError('');
    try {
      const result = await userApi.updateDescription(userId, bioDraft.trim());
      const nextDescription = result?.description ?? result?.Description ?? bioDraft.trim();
      setProfile((prev) => ({ ...prev, description: nextDescription }));
      setBioDraft(nextDescription || '');
      setIsEditingBio(false);
      onProfileUpdated?.({ ...profile, description: nextDescription });
    } catch (error) {
      setBioError(error.message || 'Не удалось сохранить описание');
    } finally {
      setIsSavingBio(false);
    }
  };

  const handleCopyId = async () => {
    if (!userId) return;
    try {
      await navigator.clipboard.writeText(String(userId));
      setCopyHint('Скопировано');
      window.setTimeout(() => setCopyHint(''), 2000);
    } catch {
      setCopyHint('Ошибка');
    }
  };

  const handleDeletePost = async (postId) => {
    if (!isOwnProfile || !userId || !postId) return;
    if (!window.confirm('Удалить этот пост?')) return;
    try {
      await feedApi.deletePost(postId);
      setProfilePosts((prev) => prev.filter((post) => post.id !== postId));
    } catch (error) {
      setPostsError(error?.response?.data?.error || 'Не удалось удалить пост');
    }
  };

  const memberSince = activeProfile?.createdAt
    ? new Date(activeProfile.createdAt).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  if (!isOpen) return null;

  const avatarUrl = resolveMediaUrl(activeProfile?.avatar);
  const avatarDecorationUrl = resolveAvatarDecorationUrl(activeProfile?.avatarDecoration);
  const hasAvatarDecoration = Boolean(avatarDecorationUrl);

  const renderPostAttachments = (post) => {
    const attachments = post.attachments || [];
    if (!attachments.length) return null;

    const images = attachments.filter((item) => item.contentType?.startsWith('image/'));
    const videos = attachments.filter((item) => item.contentType?.startsWith('video/'));
    const files = attachments.filter(
      (item) => !item.contentType?.startsWith('image/') && !item.contentType?.startsWith('video/'),
    );

    return (
      <div className="profile-wall__attachments">
        {images.length > 0 ? (
          <div
            className={`profile-wall__media-grid profile-wall__media-grid--${Math.min(images.length, 4)}`}
          >
            {images.map((item) => (
              <button
                key={item.id}
                type="button"
                className="profile-wall__media-item"
                onClick={() => setPreviewMedia(item)}
              >
                <img src={buildMediaUrl(item.filePath)} alt={item.originalFileName} />
              </button>
            ))}
          </div>
        ) : null}

        {videos.map((item) => (
          <video
            key={item.id}
            className="profile-wall__video"
            src={buildMediaUrl(item.filePath)}
            controls
            preload="metadata"
          />
        ))}

        {files.map((item) => (
          <button
            key={item.id}
            type="button"
            className="profile-wall__file"
            onClick={() => downloadMediaFile(item.filePath, item.originalFileName)}
          >
            <InsertDriveFileOutlinedIcon sx={{ fontSize: 18 }} />
            <span className="profile-wall__file-meta">
              <span className="profile-wall__file-name">{item.originalFileName}</span>
              <span className="profile-wall__file-size">{formatFileSize(item.fileSize)}</span>
            </span>
          </button>
        ))}
      </div>
    );
  };

  const savedAboutText =
    activeProfile?.description ?? activeProfile?.Description ?? '';
  const aboutText = isEditingBio ? bioDraft : (savedAboutText || bioDraft || '');
  const hasAboutText = Boolean(String(aboutText).trim());

  const bioPanel = (
    <>
      <div className="profile-hero__bio-head">
        <span className="profile-hero__bio-label">О себе</span>
        {isOwnProfile && !isEditingBio ? (
          <button
            type="button"
            className="profile-modal__text-btn"
            onClick={() => {
              setBioDraft(savedAboutText || bioDraft || '');
              setIsEditingBio(true);
            }}
          >
            {hasAboutText ? 'Изменить' : 'Добавить'}
          </button>
        ) : null}
      </div>

      {isOwnProfile && isEditingBio ? (
        <div className="profile-modal__bio-edit">
          <textarea
            className="profile-modal__bio-input"
            value={bioDraft}
            maxLength={MAX_BIO_LENGTH}
            placeholder="Расскажите немного о себе..."
            onChange={(e) => setBioDraft(e.target.value)}
            rows={4}
          />
          <div className="profile-modal__bio-footer">
            <span className="profile-modal__bio-count">
              {bioDraft.length}/{MAX_BIO_LENGTH}
            </span>
            <div className="profile-modal__bio-actions">
              <button
                type="button"
                className="profile-modal__btn profile-modal__btn--ghost"
                onClick={() => {
                  setIsEditingBio(false);
                  setBioDraft(savedAboutText);
                  setBioError('');
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                className="profile-modal__btn profile-modal__btn--primary"
                disabled={isSavingBio}
                onClick={handleSaveBio}
              >
                {isSavingBio ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
          {bioError ? <p className="profile-modal__error">{bioError}</p> : null}
        </div>
      ) : (
        <p className={`profile-modal__bio ${!hasAboutText ? 'is-empty' : ''}`}>
          {hasAboutText
            ? aboutText
            : isOwnProfile
              ? 'Добавьте описание, чтобы друзья знали вас лучше.'
              : 'Нет описания'}
        </p>
      )}
    </>
  );

  return (
    <div className="profile-modal" role="dialog" aria-modal="true" aria-label="Профиль">
      <button type="button" className="profile-modal__backdrop" onClick={onClose} aria-label="Закрыть" />
      <div className="profile-modal__shell">
        <header className="profile-hero">
          <div className="profile-hero__banner" style={bannerStyle}>
            <div className="profile-hero__shade" />

            <div className="profile-hero__actions">
              {isOwnProfile && onOpenSettings && (
                <button
                  type="button"
                  className="profile-modal__edit-btn"
                  onClick={() => {
                    onClose();
                    onOpenSettings('appearance');
                  }}
                >
                  <EditOutlinedIcon sx={{ fontSize: 16 }} />
                  <span className="profile-modal__edit-label">Редактировать</span>
                </button>
              )}
              <button type="button" className="profile-modal__close" onClick={onClose} aria-label="Закрыть">
                <CloseIcon fontSize="small" />
              </button>
            </div>

            <div className="profile-hero__chip">
              <div className="profile-hero__chip-inner">
                <div className="profile-hero__chip-user">
                  <div
                    className={`profile-hero__chip-avatar ${hasAvatarDecoration ? 'profile-hero__chip-avatar--decorated' : ''}`}
                    style={
                      hasAvatarDecoration
                        ? undefined
                        : { backgroundColor: accentColor, ['--profile-accent']: accentColor }
                    }
                  >
                    {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{avatarInitial}</span>}
                    {hasAvatarDecoration && (
                      <div className="profile-hero__chip-decoration" aria-hidden="true">
                        <AvatarDecorationMedia
                          src={avatarDecorationUrl}
                          className="profile-modal__avatar-decoration"
                        />
                      </div>
                    )}
                  </div>
                  <h1 className="profile-hero__name">{visibleName}</h1>
                </div>

                <UserNameplate nameplate={activeProfile?.nameplate} className="profile-hero__nameplate">
                  <span className="profile-hero__nameplate-fill" aria-hidden="true" />
                </UserNameplate>
              </div>
            </div>

            <div className="profile-hero__titles" aria-hidden="true" />
          </div>

          <div className="profile-hero__bio-dock">
            <div className="profile-hero__bio-panel">{bioPanel}</div>
          </div>
        </header>

        <div className="profile-modal__body profile-modal__body--wall">
          <div className="profile-wall profile-wall--solo">
            <div className="profile-wall__main">
              <section className="profile-wall__card profile-wall__card--meta">
                <div className="profile-modal__info-list profile-modal__info-list--inline">
                  {memberSince ? (
                    <div className="profile-modal__info-row">
                      <span className="profile-modal__info-label">Участник с</span>
                      <span className="profile-modal__info-value">{memberSince}</span>
                    </div>
                  ) : null}
                  <div className="profile-modal__info-row">
                    <span className="profile-modal__info-label">ID</span>
                    <button type="button" className="profile-modal__copy-id" onClick={handleCopyId}>
                      <code>{String(userId).slice(0, 8)}…</code>
                      <ContentCopyIcon sx={{ fontSize: 14 }} />
                      {copyHint ? <span className="profile-modal__copy-hint">{copyHint}</span> : null}
                    </button>
                  </div>
                </div>
              </section>

              {isOwnProfile ? (
                <button
                  type="button"
                  className="profile-wall__composer"
                  onClick={() => setComposerOpen(true)}
                >
                  <span className="profile-wall__composer-icon">
                    <AddIcon sx={{ fontSize: 20 }} />
                  </span>
                  <span>Создать пост</span>
                </button>
              ) : null}

              <section className="profile-wall__card profile-wall__card--feed">
                <div className="profile-wall__card-head">
                  <h3 className="profile-wall__card-title">Стена</h3>
                  <span className="profile-wall__card-count">{profilePosts.length}</span>
                </div>

                {postsError ? <p className="profile-modal__error">{postsError}</p> : null}

                {postsLoading ? (
                  <p className="profile-wall__empty">Загрузка…</p>
                ) : profilePosts.length === 0 ? (
                  <p className="profile-wall__empty">
                    {isOwnProfile
                      ? 'Пока тихо. Создайте первый пост — он появится здесь и в ленте друзей.'
                      : postsError
                        ? ''
                        : 'Пока нет публикаций'}
                  </p>
                ) : (
                  <div className="profile-wall__feed">
                    {profilePosts.map((post) => (
                      <article key={post.id} className="profile-wall__post">
                        <div className="profile-wall__post-top">
                          <div className="profile-wall__post-author">
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt=""
                                className="profile-wall__post-avatar"
                              />
                            ) : (
                              <div
                                className="profile-wall__post-avatar profile-wall__post-avatar--fallback"
                                style={{ backgroundColor: accentColor }}
                              >
                                {avatarInitial}
                              </div>
                            )}
                            <div className="profile-wall__post-author-meta">
                              <span className="profile-wall__post-name">{visibleName}</span>
                              <span className="profile-wall__post-time">
                                {formatRelativeTime(post.createdAt)}
                                {post.scope === 'server'
                                  ? ` · ${post.serverName || 'сервер'}`
                                  : ''}
                              </span>
                            </div>
                          </div>
                          {isOwnProfile ? (
                            <button
                              type="button"
                              className="profile-wall__post-more"
                              title="Удалить"
                              onClick={() => void handleDeletePost(post.id)}
                            >
                              <MoreHorizIcon sx={{ fontSize: 20 }} />
                            </button>
                          ) : null}
                        </div>

                        {post.text ? <p className="profile-wall__post-text">{post.text}</p> : null}
                        {renderPostAttachments(post)}

                        <div className="profile-wall__post-stats">
                          <span className="profile-wall__stat">
                            <ThumbUpAltOutlinedIcon sx={{ fontSize: 16 }} />
                            {Number(post.likesCount || 0) - Number(post.dislikesCount || 0)}
                          </span>
                          <span className="profile-wall__stat">
                            <ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />
                            {post.commentsCount || 0}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>

      <ImagePreview
        mediaFile={previewMedia}
        isOpen={Boolean(previewMedia)}
        onClose={() => setPreviewMedia(null)}
      />

      <CreateFeedPostModal
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreated={() => {
          setComposerOpen(false);
          void loadPosts();
        }}
      />
    </div>
  );
};

export default ProfileModal;
