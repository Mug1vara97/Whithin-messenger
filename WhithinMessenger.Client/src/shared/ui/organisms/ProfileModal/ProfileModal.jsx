import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { userApi } from '../../../../entities/user/api';
import { MEDIA_BASE_URL } from '../../../lib/constants/apiEndpoints';
import { useAuthContext } from '../../../lib/contexts/AuthContext';
import { useConnectionContext } from '../../../lib/contexts/ConnectionContext';
import { PROFILE_UPDATED_EVENT } from '../../../lib/contexts/ProfileModalContext';
import { mergeProfileState } from '../../../lib/utils/profilePatchHelpers';
import {
  getUserStatusColor,
  getUserStatusLabel,
  normalizeUserStatus,
} from '../../../lib/utils/userStatus';
import { resolveUserDisplayName, resolveAvatarInitial } from '../../../lib/utils/userDisplayNameHelpers';
import UserNameplate from '../../atoms/UserNameplate';
import { resolveAvatarDecorationUrl } from '../../../lib/utils/avatarDecorationHelpers';
import AvatarDecorationMedia from '../../atoms/UserAvatar/AvatarDecorationMedia';
import './ProfileModal.css';

const MAX_BIO_LENGTH = 190;

const resolveMediaUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${MEDIA_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

const isBannerImage = (banner) =>
  banner && (banner.startsWith('/uploads/') || banner.startsWith('http'));

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
  const { user } = useAuthContext();
  const { getConnection } = useConnectionContext();
  const viewerId = user?.id || user?.userId || user?.Id;

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
  const presenceStatus = normalizeUserStatus(activeProfile?.status ?? initialStatus);
  const presenceLabel = getUserStatusLabel(presenceStatus);
  const presenceColor = getUserStatusColor(presenceStatus);

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
    loadProfile();
  }, [isOpen, userId, loadProfile, initialStatus]);

  useEffect(() => {
    if (isOpen) return;
    setProfile(null);
    setBioDraft('');
    setCopyHint('');
    setIsEditingBio(false);
    setBioError('');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !userId || !getConnection || !viewerId) return undefined;

    let mounted = true;
    let connectionRef = null;

    const setupStatusListener = async () => {
      try {
        const connection = await getConnection('notificationhub', viewerId);
        if (!mounted) return;
        connectionRef = connection;

        const onUserStatusChanged = (payload) => {
          const changedUserId = payload?.userId ?? payload?.UserId;
          if (String(changedUserId) !== String(userId)) return;
          const nextStatus = normalizeUserStatus(payload?.status ?? payload?.Status);
          setProfile((prev) => ({ ...(prev || {}), status: nextStatus }));
        };

        connection.on('UserStatusChanged', onUserStatusChanged);
      } catch (error) {
        console.error('Error subscribing to profile status updates:', error);
      }
    };

    setupStatusListener();

    return () => {
      mounted = false;
      if (connectionRef) {
        connectionRef.off('UserStatusChanged');
      }
    };
  }, [isOpen, userId, viewerId, getConnection]);

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
              <div className="profile-modal__avatar" style={{ backgroundColor: accentColor }}>
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
                className="profile-modal__avatar-status"
                style={{ backgroundColor: presenceColor }}
                title={presenceLabel}
                aria-label={presenceLabel}
              />
            </div>
          </div>

          <div className="profile-modal__identity">
            <UserNameplate nameplate={activeProfile?.nameplate} className="profile-modal__nameplate">
              <h2 className="profile-modal__name">{visibleName}</h2>
            </UserNameplate>
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
    </div>
  );
};

export default ProfileModal;
