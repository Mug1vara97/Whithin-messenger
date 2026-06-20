import React, { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, Headset, HeadsetOff, Settings as SettingsIcon } from '@mui/icons-material';
import { userApi } from '../../../../entities/user/api';
import { useConnectionContext } from '../../../lib/contexts/ConnectionContext';
import { useGlobalCall } from '../../../lib/hooks/useGlobalCall';
import { useCallStore } from '../../../lib/stores/callStore';
import {
  selectActiveServerDeafened,
  selectActiveServerMuted,
} from '../../../lib/voice/serverVoiceModerationState';
import {
  getUserStatusColor,
  getUserStatusLabel,
  getUserStatusOptions,
  normalizeUserStatus,
  PRESENCE_STATUS,
  toBackendUserStatus,
} from '../../../lib/utils/userStatus';
import { useAuthContext } from '../../../lib/contexts/AuthContext';
import { PROFILE_UPDATED_EVENT, useProfileModal } from '../../../lib/contexts/ProfileModalContext';
import { resolveUserDisplayName } from '../../../lib/utils/userDisplayNameHelpers';
import UserAvatar from '../../atoms/UserAvatar';
import styles from './UserPanel.module.css';

const resolveProfileDisplayName = (profile) =>
  profile?.displayName ?? profile?.DisplayName ?? null;

const resolveProfileLogin = (profile, fallbackLogin) =>
  profile?.username ?? profile?.Username ?? fallbackLogin ?? '';

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

const UserPanel = ({
  userId,
  username,
  isOpen,
  serverId = null,
}) => {
  const { user, updateUser } = useAuthContext();
  const { toggleMute, toggleGlobalAudio, isInCall } = useGlobalCall();
  const isMuted = useCallStore((state) => state.isMuted);
  const isGlobalAudioMuted = useCallStore((state) => state.isGlobalAudioMuted);
  const isServerMuted = useCallStore((state) => selectActiveServerMuted(state, serverId));
  const isServerDeafened = useCallStore((state) => selectActiveServerDeafened(state, serverId));

  const [userProfile, setUserProfile] = useState(null);
  const [currentStatus, setCurrentStatus] = useState(PRESENCE_STATUS.ONLINE);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [, setIsStatusUpdating] = useState(false);
  const { openOwnProfile, openSettings } = useProfileModal();
  const handleOpenOwnProfile = () => openOwnProfile(currentStatus);
  const manualStatusRef = useRef(PRESENCE_STATUS.ONLINE);
  const currentStatusRef = useRef(PRESENCE_STATUS.ONLINE);
  const notificationConnectionRef = useRef(null);
  const statusMenuRef = useRef(null);
  const { getConnection } = useConnectionContext();

  const getStorageKey = () => (userId ? `whithin:user-status:${userId}` : 'whithin:user-status');

  const syncAuthDisplayName = (profile) => {
    if (typeof updateUser !== 'function') return;
    const nextDisplayName = resolveProfileDisplayName(profile);
    if (nextDisplayName !== (user?.displayName ?? user?.DisplayName ?? null)) {
      updateUser({ displayName: nextDisplayName });
    }
  };

  const fetchUserProfile = async () => {
    if (!userId) return;
    try {
      const data = await userApi.getProfile(userId);
      setUserProfile(data);
      syncAuthDisplayName(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  useEffect(() => {
    if (!userId) return undefined;

    const handleProfileUpdated = (event) => {
      if (String(event.detail?.userId) === String(userId)) {
        setUserProfile(event.detail);
        syncAuthDisplayName(event.detail);
      }
    };

    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetchUserProfile();
  }, [userId]);

  useEffect(() => {
    if (!isOpen) return;

    const storageKey = getStorageKey();
    const savedStatus = localStorage.getItem(storageKey);
    if (savedStatus) {
      const normalizedSavedStatus = normalizeUserStatus(savedStatus);
      setCurrentStatus(normalizedSavedStatus);
      manualStatusRef.current = normalizedSavedStatus;
      currentStatusRef.current = normalizedSavedStatus;
    } else {
      setCurrentStatus(PRESENCE_STATUS.ONLINE);
      manualStatusRef.current = PRESENCE_STATUS.ONLINE;
      currentStatusRef.current = PRESENCE_STATUS.ONLINE;
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (!isStatusMenuOpen) return undefined;

    const handleClickOutside = (event) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target)) {
        setIsStatusMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isStatusMenuOpen]);

  useEffect(() => {
    if (!isStatusMenuOpen) return undefined;

    const handleEscapeClose = (event) => {
      if (event.key === 'Escape') {
        setIsStatusMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscapeClose);
    return () => document.removeEventListener('keydown', handleEscapeClose);
  }, [isStatusMenuOpen]);

  const applyStatus = async (statusValue, isManualChange = false) => {
    const normalizedStatus = normalizeUserStatus(statusValue);
    const storageKey = getStorageKey();

    setCurrentStatus(normalizedStatus);
    currentStatusRef.current = normalizedStatus;
    localStorage.setItem(storageKey, normalizedStatus);

    if (isManualChange) {
      manualStatusRef.current = normalizedStatus;
    }

    if (!userId) return;

    try {
      setIsStatusUpdating(true);
      await userApi.updateStatus(userId, toBackendUserStatus(normalizedStatus));
    } catch (error) {
      console.error('Error updating user status:', error);
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const handleStatusChange = async (statusValue) => {
    setIsStatusMenuOpen(false);
    await applyStatus(statusValue, true);
  };

  const syncPresenceFromServer = (statusValue) => {
    const normalizedStatus = normalizeUserStatus(statusValue);
    const storageKey = getStorageKey();
    setCurrentStatus(normalizedStatus);
    currentStatusRef.current = normalizedStatus;
    manualStatusRef.current = normalizedStatus;
    localStorage.setItem(storageKey, normalizedStatus);
  };

  const syncOnlineAfterHubConnect = () => {
    const saved = normalizeUserStatus(localStorage.getItem(getStorageKey()));
    if (saved !== PRESENCE_STATUS.OFFLINE) {
      return;
    }
    syncPresenceFromServer(PRESENCE_STATUS.ONLINE);
  };

  useEffect(() => {
    if (!isOpen || !userId) return undefined;

    let idleTimerId = null;

    const resetIdleTimer = () => {
      if (idleTimerId) {
        window.clearTimeout(idleTimerId);
        idleTimerId = null;
      }

      if (
        manualStatusRef.current === PRESENCE_STATUS.ONLINE &&
        currentStatusRef.current === PRESENCE_STATUS.INACTIVE
      ) {
        applyStatus(PRESENCE_STATUS.ONLINE);
      }

      if (isInCall || useCallStore.getState().isInCall) {
        return;
      }

      idleTimerId = window.setTimeout(() => {
        if (useCallStore.getState().isInCall) {
          return;
        }
        if (
          manualStatusRef.current === PRESENCE_STATUS.ONLINE &&
          currentStatusRef.current === PRESENCE_STATUS.ONLINE
        ) {
          applyStatus(PRESENCE_STATUS.INACTIVE);
        }
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach((eventName) => {
      window.addEventListener(eventName, resetIdleTimer, { passive: true });
    });

    resetIdleTimer();

    return () => {
      if (idleTimerId) {
        window.clearTimeout(idleTimerId);
      }
      events.forEach((eventName) => {
        window.removeEventListener(eventName, resetIdleTimer);
      });
    };
  }, [isOpen, userId, isInCall]);

  useEffect(() => {
    if (!isInCall || !userId) return;

    if (
      manualStatusRef.current === PRESENCE_STATUS.ONLINE &&
      currentStatusRef.current === PRESENCE_STATUS.INACTIVE
    ) {
      applyStatus(PRESENCE_STATUS.ONLINE);
    }
  }, [isInCall, userId]);

  useEffect(() => {
    if (!isOpen || !userId || !getConnection) return undefined;

    let mounted = true;

    const setupRealtimeStatus = async () => {
      try {
        const notificationConnection = await getConnection('notificationhub', userId);
        if (!mounted) return;
        notificationConnectionRef.current = notificationConnection;

        const onUserStatusChanged = (payload) => {
          const changedUserId = payload?.userId ?? payload?.UserId;
          if (String(changedUserId) !== String(userId)) {
            return;
          }
          syncPresenceFromServer(payload?.status ?? payload?.Status);
        };

        const onReconnected = () => {
          if (!mounted) return;
          syncOnlineAfterHubConnect();
        };

        notificationConnection.on('UserStatusChanged', onUserStatusChanged);
        notificationConnection.onreconnected(onReconnected);

        if (notificationConnection.state === 'Connected') {
          syncOnlineAfterHubConnect();
        }
      } catch (error) {
        console.error('Error setting up realtime status in user panel:', error);
      }
    };

    setupRealtimeStatus();

    return () => {
      mounted = false;
      if (notificationConnectionRef.current) {
        notificationConnectionRef.current.off('UserStatusChanged');
      }
      notificationConnectionRef.current = null;
    };
  }, [isOpen, userId, getConnection]);

  if (!isOpen) return null;

  const avatarColor = userProfile?.avatarColor || '#5865F2';
  const profileDisplayName =
    resolveProfileDisplayName(userProfile) ??
    user?.displayName ??
    user?.DisplayName ??
    null;
  const login = resolveProfileLogin(userProfile, username);
  const visibleName = resolveUserDisplayName({
    displayName: profileDisplayName,
    username: login,
  });

  return (
    <>
      <div className={styles['user-panel']}>
        <div className={styles['user-panel-content']}>
          <div className={styles['user-avatar-wrap']}>
            <UserAvatar
              displayName={profileDisplayName}
              login={login}
              avatarUrl={userProfile?.avatar}
              avatarColor={avatarColor}
              avatarDecoration={userProfile?.avatarDecoration}
              size={40}
              onClick={handleOpenOwnProfile}
              statusIndicatorInteractive
              statusIndicator={
                <button
                  className={styles['user-avatar-status-button']}
                  onClick={() => setIsStatusMenuOpen((prev) => !prev)}
                  title={getUserStatusLabel(currentStatus)}
                  type="button"
                >
                  <span
                    className="user-avatar-presence-dot"
                    style={{ backgroundColor: getUserStatusColor(currentStatus) }}
                  />
                </button>
              }
            />
          </div>

          <div className={styles['user-identity']} ref={statusMenuRef}>
            <button
              className={styles['user-identity-button']}
              onClick={() => setIsStatusMenuOpen((prev) => !prev)}
              title="Изменить статус"
              type="button"
            >
              <span className={styles.username}>{visibleName || 'Пользователь'}</span>
              <span className={styles['user-status-text']}>{getUserStatusLabel(currentStatus)}</span>
            </button>

            {isStatusMenuOpen && (
              <div className={styles['status-menu']}>
                {getUserStatusOptions().map((statusOption) => (
                  <button
                    key={statusOption.value}
                    className={`${styles['status-menu-item']} ${currentStatus === statusOption.value ? styles['status-menu-item-active'] : ''}`}
                    onClick={() => handleStatusChange(statusOption.value)}
                    type="button"
                  >
                    <span
                      className={styles['status-dot']}
                      style={{ backgroundColor: statusOption.color }}
                    />
                    <span>{statusOption.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles['voice-controls']}>
            <button
              className={`${styles['voice-control-button']} ${isServerMuted && isMuted ? styles['voice-control-buttonModerated'] : ''} ${isMuted && !isServerMuted ? styles['voice-control-buttonMuted'] : ''}`}
              onClick={toggleMute}
              disabled={isServerMuted && isMuted}
              title={
                isServerMuted && isMuted
                  ? 'Микрофон отключён модератором'
                  : isMuted
                    ? 'Включить микрофон'
                    : 'Выключить микрофон'
              }
            >
              {isMuted ? <MicOff fontSize="small" /> : <Mic fontSize="small" />}
            </button>

            <button
              className={`${styles['voice-control-button']} ${isServerDeafened && isGlobalAudioMuted ? styles['voice-control-buttonModerated'] : ''} ${isGlobalAudioMuted && !isServerDeafened ? styles['voice-control-buttonMuted'] : ''}`}
              onClick={toggleGlobalAudio}
              disabled={isServerDeafened && isGlobalAudioMuted}
              title={
                isServerDeafened && isGlobalAudioMuted
                  ? 'Звук отключён модератором'
                  : !isGlobalAudioMuted
                    ? 'Выключить звук'
                    : 'Включить звук'
              }
            >
              {!isGlobalAudioMuted ? <Headset fontSize="small" /> : <HeadsetOff fontSize="small" />}
            </button>

            <button
              className={styles['voice-control-button']}
              onClick={() => openSettings('account')}
              title="Настройки"
            >
              <SettingsIcon fontSize="small" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default UserPanel;
