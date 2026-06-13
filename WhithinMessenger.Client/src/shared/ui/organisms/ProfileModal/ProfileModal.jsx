import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { userApi } from '../../../../entities/user/api';
import { MEDIA_BASE_URL } from '../../../lib/constants/apiEndpoints';
import { useAuthContext } from '../../../lib/contexts/AuthContext';
import { useConnectionContext } from '../../../lib/contexts/ConnectionContext';
import {
  getUserStatusColor,
  getUserStatusLabel,
  normalizeUserStatus,
} from '../../../lib/utils/userStatus';
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

  const displayName = profile?.username || username || 'Пользователь';
  const accentColor = profile?.avatarColor || '#5865f2';
  const presenceStatus = normalizeUserStatus(profile?.status ?? initialStatus);
  const presenceLabel = getUserStatusLabel(presenceStatus);
  const presenceColor = getUserStatusColor(presenceStatus);

  const bannerStyle = useMemo(() => {
    const banner = profile?.banner;
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
  }, [profile?.banner, accentColor]);

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
    if (isOpen && userId) {
      loadProfile();
      setIsEditingBio(false);
      setBioError('');
      if (initialStatus != null) {
        setProfile((prev) => ({
          ...(prev || {}),
          status: normalizeUserStatus(initialStatus),
        }));
      }
    }
  }, [isOpen, userId, loadProfile, initialStatus]);

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

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  if (!isOpen) return null;

  const avatarUrl = resolveMediaUrl(profile?.avatar);

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
              className="profile-modal__avatar-ring"
              style={{ '--profile-accent': accentColor }}
            >
              <div className="profile-modal__avatar" style={{ backgroundColor: accentColor }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="profile-modal__avatar-img" />
                ) : (
                  <span>{displayName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <span
                className="profile-modal__avatar-status"
                style={{ backgroundColor: presenceColor }}
                title={presenceLabel}
                aria-label={presenceLabel}
              />
            </div>
          </div>

          <div className="profile-modal__identity">
            <h2 className="profile-modal__name">{displayName}</h2>
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
                      setBioDraft(profile?.description || '');
                      setIsEditingBio(true);
                    }}
                  >
                    {profile?.description ? 'Изменить' : 'Добавить'}
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
                          setBioDraft(profile?.description || '');
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
                <p className={`profile-modal__bio ${!profile?.description ? 'is-empty' : ''}`}>
                  {profile?.description ||
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
