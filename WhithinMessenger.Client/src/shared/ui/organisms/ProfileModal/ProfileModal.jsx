import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { userApi } from '../../../../entities/user/api';
import { feedApi, formatFeedTime } from '../../../../entities/feed';
import { MEDIA_BASE_URL } from '../../../lib/constants/apiEndpoints';
import { useAuthContext } from '../../../lib/contexts/AuthContext';
import { PROFILE_UPDATED_EVENT } from '../../../lib/contexts/ProfileModalContext';
import { useResolvedPresence } from '../../../lib/contexts/PresenceContext';
import { getOwnStatusLabel, normalizeUserStatus } from '../../../lib/utils/userStatus';
import { mergeProfileState } from '../../../lib/utils/profilePatchHelpers';
import { resolveUserDisplayName, resolveAvatarInitial } from '../../../lib/utils/userDisplayNameHelpers';
import UserNameplate from '../../atoms/UserNameplate';
import { resolveAvatarDecorationUrl } from '../../../lib/utils/avatarDecorationHelpers';
import AvatarDecorationMedia from '../../atoms/UserAvatar/AvatarDecorationMedia';
import ImagePreview from '../../molecules/ImagePreview/ImagePreview';
import { buildMediaUrl, downloadMediaFile } from '../../../lib/utils/urlHelpers';
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
  const [postDraft, setPostDraft] = useState('');
  const [isPublishingPost, setIsPublishingPost] = useState(false);
  const [profilePosts, setProfilePosts] = useState([]);
  const [postsError, setPostsError] = useState('');
  const [postsLoading, setPostsLoading] = useState(false);
  const [previewMedia, setPreviewMedia] = useState(null);
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
  const presence = useResolvedPresence(userId, activeProfile?.status ?? initialStatus);
  const presenceLabel = isOwnProfile
    ? getOwnStatusLabel(presence.normalized)
    : presence.label;
  const presenceColor = presence.color;

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
      setProfile(data);
      setBioDraft(data?.description || '');
      onProfileUpdated?.(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }, [userId, onProfileUpdated]);

  useEffect(() => {
    if (!isOpen || !userId) return;

    setProfile(
      initialStatus != null ? { status: normalizeUserStatus(initialStatus) } : null,
    );
    setBioDraft('');
    setCopyHint('');
    setIsEditingBio(false);
    setBioError('');
    setPostDraft('');
    loadProfile();
  }, [isOpen, userId, loadProfile, initialStatus]);

  useEffect(() => {
    if (isOpen) return;
    setProfile(null);
    setBioDraft('');
    setCopyHint('');
    setIsEditingBio(false);
    setBioError('');
    setPostDraft('');
    setProfilePosts([]);
    setPreviewMedia(null);
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

    let cancelled = false;
    const loadPosts = async () => {
      setPostsLoading(true);
      setPostsError('');
      try {
        const posts = await feedApi.getUserPosts(userId);
        if (!cancelled) setProfilePosts(posts);
      } catch (error) {
        if (!cancelled) {
          setProfilePosts([]);
          setPostsError(
            error?.response?.data?.error ||
              (error?.response?.status === 403
                ? 'Публикации видны только друзьям'
                : 'Не удалось загрузить публикации'),
          );
        }
      } finally {
        if (!cancelled) setPostsLoading(false);
      }
    };

    void loadPosts();
    return () => {
      cancelled = true;
    };
  }, [isOpen, userId]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const handleSaveBio = async () => {
    if (!isOwnProfile || !userId) return;
    setIsSavingBio(true);
    setBioError('');
    try {
      const result = await userApi.updateDescription(userId, bioDraft.trim());
      setProfile((prev) => ({ ...prev, description: result.description }));
      setIsEditingBio(false);
      onProfileUpdated?.({ ...profile, description: result.description });
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

  const handlePublishPost = async () => {
    if (!isOwnProfile || !userId || !postDraft.trim() || isPublishingPost) return;
    setIsPublishingPost(true);
    setPostsError('');
    try {
      const created = await feedApi.createPost({
        text: postDraft,
        scope: 'friend',
      });
      setPostDraft('');
      if (created) {
        setProfilePosts((prev) => [created, ...prev]);
      }
    } catch (error) {
      setPostsError(error?.response?.data?.error || 'Не удалось опубликовать пост');
    } finally {
      setIsPublishingPost(false);
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

  return (
    <div className="profile-modal" role="dialog" aria-modal="true" aria-label="Профиль">
      <button type="button" className="profile-modal__backdrop" onClick={onClose} aria-label="Закрыть" />
      <div className="profile-modal__card">
        <div className="profile-modal__banner" style={bannerStyle}>
          <div className="profile-modal__banner-shade" />
          <div className="profile-modal__banner-actions">
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
                <span className="profile-modal__edit-label">Редактировать профиль</span>
              </button>
            )}
            <button type="button" className="profile-modal__close" onClick={onClose} aria-label="Закрыть">
              <CloseIcon fontSize="small" />
            </button>
          </div>
        </div>

        <div className="profile-modal__hero">
          <div className="profile-modal__avatar-wrap">
            <div
              className={`profile-modal__avatar-ring ${hasAvatarDecoration ? 'profile-modal__avatar-ring--decorated' : ''}`}
              style={hasAvatarDecoration ? undefined : { '--profile-accent': accentColor }}
            >
              <div
                className="profile-modal__avatar"
                style={{
                  backgroundColor: hasAvatarDecoration && avatarUrl ? 'transparent' : accentColor,
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="profile-modal__avatar-img" />
                ) : (
                  <span>{avatarInitial}</span>
                )}
              </div>
              {hasAvatarDecoration && (
                <div className="profile-modal__avatar-decoration-layer" aria-hidden="true">
                  <AvatarDecorationMedia
                    src={avatarDecorationUrl}
                    className="profile-modal__avatar-decoration"
                  />
                </div>
              )}
              <span
                className={`profile-modal__avatar-status profile-modal__avatar-status--${presence.normalized}`}
                style={{ ['--presence-color']: presenceColor }}
                title={presenceLabel}
                aria-label={presenceLabel}
              />
            </div>
          </div>

          <div className="profile-modal__identity">
            <UserNameplate nameplate={activeProfile?.nameplate} className="profile-modal__nameplate">
              <h2 className="profile-modal__name">{visibleName}</h2>
            </UserNameplate>
            <p className="profile-modal__status-text">{presenceLabel}</p>
            {login && (
              <p className="profile-modal__login">@{login}</p>
            )}
          </div>
        </div>

        <div className="profile-modal__body">
          <div className="profile-modal__panel">
            <section className="profile-modal__section">
              <div className="profile-modal__section-head">
                <h3 className="profile-modal__section-title">Обо мне</h3>
                {isOwnProfile && !isEditingBio && (
                  <button
                    type="button"
                    className="profile-modal__text-btn"
                    onClick={() => {
                      setBioDraft(activeProfile?.description || '');
                      setIsEditingBio(true);
                    }}
                  >
                    {activeProfile?.description ? 'Изменить' : 'Добавить'}
                  </button>
                )}
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
                          setBioDraft(activeProfile?.description || '');
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
                  {bioError && <p className="profile-modal__error">{bioError}</p>}
                </div>
              ) : (
                <p className={`profile-modal__bio ${!activeProfile?.description ? 'is-empty' : ''}`}>
                  {activeProfile?.description ||
                    (isOwnProfile
                      ? 'Добавьте описание, чтобы друзья знали вас лучше.'
                      : 'Нет описания')}
                </p>
              )}
            </section>

            <section className="profile-modal__section">
              <div className="profile-modal__section-head">
                <h3 className="profile-modal__section-title">Публикации</h3>
              </div>

              {isOwnProfile && (
                <div className="profile-modal__posts-composer">
                  <textarea
                    className="profile-modal__bio-input"
                    value={postDraft}
                    maxLength={2000}
                    rows={3}
                    placeholder="Напишите пост для ленты друзей…"
                    onChange={(event) => setPostDraft(event.target.value)}
                  />
                  <div className="profile-modal__posts-composer-footer">
                    <span className="profile-modal__bio-count">
                      {postDraft.length}/2000
                    </span>
                    <button
                      type="button"
                      className="profile-modal__btn profile-modal__btn--primary"
                      disabled={!postDraft.trim() || isPublishingPost}
                      onClick={handlePublishPost}
                    >
                      {isPublishingPost ? 'Публикация…' : 'Опубликовать'}
                    </button>
                  </div>
                </div>
              )}

              {postsError ? <p className="profile-modal__error">{postsError}</p> : null}

              {postsLoading ? (
                <p className="profile-modal__bio is-empty">Загрузка…</p>
              ) : profilePosts.length === 0 ? (
                <p className="profile-modal__bio is-empty">
                  {isOwnProfile
                    ? 'Постов пока нет. Опубликуйте первый — его увидят друзья в ленте.'
                    : postsError
                      ? ''
                      : 'У пользователя пока нет публикаций'}
                </p>
              ) : (
                <div className="profile-modal__posts-list">
                  {profilePosts.map((post) => {
                    const attachments = post.attachments || [];
                    const images = attachments.filter((item) =>
                      item.contentType?.startsWith('image/'),
                    );
                    const videos = attachments.filter((item) =>
                      item.contentType?.startsWith('video/'),
                    );
                    const files = attachments.filter(
                      (item) =>
                        !item.contentType?.startsWith('image/') &&
                        !item.contentType?.startsWith('video/'),
                    );

                    return (
                      <article key={post.id} className="profile-modal__post">
                        <div className="profile-modal__post-head">
                          <span className="profile-modal__post-time">
                            {formatFeedTime(post.createdAt)}
                            {post.scope === 'server' ? ' · сервер' : ''}
                          </span>
                          {isOwnProfile && (
                            <button
                              type="button"
                              className="profile-modal__text-btn"
                              onClick={() => handleDeletePost(post.id)}
                            >
                              Удалить
                            </button>
                          )}
                        </div>
                        {post.text ? (
                          <p className="profile-modal__post-text">{post.text}</p>
                        ) : null}

                        {images.length > 0 ? (
                          <div
                            className={`profile-modal__post-media profile-modal__post-media--${Math.min(images.length, 4)}`}
                          >
                            {images.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className="profile-modal__post-image"
                                onClick={() => setPreviewMedia(item)}
                              >
                                <img
                                  src={buildMediaUrl(item.filePath)}
                                  alt={item.originalFileName}
                                />
                              </button>
                            ))}
                          </div>
                        ) : null}

                        {videos.map((item) => (
                          <video
                            key={item.id}
                            className="profile-modal__post-video"
                            src={buildMediaUrl(item.filePath)}
                            controls
                            preload="metadata"
                          />
                        ))}

                        {files.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="profile-modal__post-file"
                            onClick={() =>
                              downloadMediaFile(item.filePath, item.originalFileName)
                            }
                          >
                            <span className="profile-modal__post-file-name">
                              {item.originalFileName}
                            </span>
                            <span className="profile-modal__post-file-size">
                              {formatFileSize(item.fileSize)}
                            </span>
                          </button>
                        ))}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="profile-modal__section">
              <h3 className="profile-modal__section-title">Информация</h3>
              <div className="profile-modal__info-list">
                {memberSince && (
                  <div className="profile-modal__info-row">
                    <span className="profile-modal__info-label">Участник с</span>
                    <span className="profile-modal__info-value">{memberSince}</span>
                  </div>
                )}
                <div className="profile-modal__info-row">
                  <span className="profile-modal__info-label">ID</span>
                  <button type="button" className="profile-modal__copy-id" onClick={handleCopyId}>
                    <code>{String(userId).slice(0, 8)}…</code>
                    <ContentCopyIcon sx={{ fontSize: 14 }} />
                    {copyHint && <span className="profile-modal__copy-hint">{copyHint}</span>}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <ImagePreview
        mediaFile={previewMedia}
        isOpen={Boolean(previewMedia)}
        onClose={() => setPreviewMedia(null)}
      />
    </div>
  );
};

export default ProfileModal;
