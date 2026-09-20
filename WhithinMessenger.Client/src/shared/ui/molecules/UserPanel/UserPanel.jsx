import React, { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, Headset, HeadsetOff, Settings as SettingsIcon } from '@mui/icons-material';
import { userApi } from '../../../../entities/user/api';
import { usePresence } from '../../../lib/contexts/PresenceContext';
import { useGlobalCall } from '../../../lib/hooks/useGlobalCall';
import { useCallStore } from '../../../lib/stores/callStore';
import {
  selectActiveServerDeafened,
  selectActiveServerMuted,
} from '../../../lib/voice/serverVoiceModerationState';
import {
  getOwnStatusLabel,
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
import { UserAvatarPresenceDot } from '../../atoms/UserAvatar';
import styles from './UserPanel.module.css';

const resolveProfileDisplayName = (profile) =>
  profile?.displayName ?? profile?.DisplayName ?? null;

const resolveProfileLogin = (profile, fallbackLogin) =>
  profile?.username ?? profile?.Username ?? fallbackLogin ?? '';

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

const UserPanel = ({
  userId,
  username,
  serverId = null,
}) => {
  const { user, updateUser } = useAuthContext();
  const { applyLocalStatus, statusOverrides, resolvePresence } = usePresence();
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
  const handleOpenOwnProfile = () => {
    const status = normalizeUserStatus(resolvePresence(userId, currentStatusRef.current));
    openOwnProfile(status);
  };
  const manualStatusRef = useRef(PRESENCE_STATUS.ONLINE);
  const currentStatusRef = useRef(PRESENCE_STATUS.ONLINE);
  const statusMenuRef = useRef(null);
  const hasRestoredStatusRef = useRef(false);

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
    if (!userId) return;

    hasRestoredStatusRef.current = false;

    const storageKey = getStorageKey();
    const savedStatus = localStorage.getItem(storageKey);
    const normalizedSavedStatus = savedStatus
      ? normalizeUserStatus(savedStatus)
      : PRESENCE_STATUS.ONLINE;

    setCurrentStatus(normalizedSavedStatus);
    manualStatusRef.current = normalizedSavedStatus;
    currentStatusRef.current = normalizedSavedStatus;
    applyLocalStatus(userId, normalizedSavedStatus);
  }, [userId, applyLocalStatus]);

  // Restore preferred status to the server on connect (including Invisible / Offline).
  useEffect(() => {
    if (!userId || hasRestoredStatusRef.current) return undefined;

    let cancelled = false;
    hasRestoredStatusRef.current = true;

    const restorePreferredStatus = async () => {
      const storageKey = getStorageKey();
      const savedStatus = normalizeUserStatus(
        localStorage.getItem(storageKey) || PRESENCE_STATUS.ONLINE,
      );

      setCurrentStatus(savedStatus);
      currentStatusRef.current = savedStatus;
      manualStatusRef.current = savedStatus;
      applyLocalStatus(userId, savedStatus);

      try {
        await userApi.updateStatus(userId, toBackendUserStatus(savedStatus));
      } catch (error) {
        if (!cancelled) {
          console.error('Error restoring user status on connect:', error);
        }
      }
    };

    restorePreferredStatus();

    return () => {
      cancelled = true;
    };
  }, [userId, applyLocalStatus]);

  // Sync own status from PresenceContext (other sessions / server broadcasts).
  // Do not overwrite manual Invisible/Offline with a spurious Online from connect races.
  useEffect(() => {
    if (!userId) return;
    const key = String(userId);
    const remoteStatus = statusOverrides[key];
    if (remoteStatus === undefined) return;

    const normalized = normalizeUserStatus(remoteStatus);
    if (normalized === currentStatusRef.current) return;

    if (
      manualStatusRef.current === PRESENCE_STATUS.OFFLINE &&
      normalized === PRESENCE_STATUS.ONLINE
    ) {
      // Keep Invisible locally and push preferred offline back to the server.
      setCurrentStatus(PRESENCE_STATUS.OFFLINE);
      currentStatusRef.current = PRESENCE_STATUS.OFFLINE;
      localStorage.setItem(getStorageKey(), PRESENCE_STATUS.OFFLINE);
      applyLocalStatus(userId, PRESENCE_STATUS.OFFLINE);
      void userApi
        .updateStatus(userId, toBackendUserStatus(PRESENCE_STATUS.OFFLINE))
        .catch((error) => {
          console.error('Error re-asserting offline status:', error);
        });
      return;
    }

    setCurrentStatus(normalized);
    currentStatusRef.current = normalized;
    localStorage.setItem(getStorageKey(), normalized);
  }, [userId, statusOverrides, applyLocalStatus]);

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
    applyLocalStatus(userId, normalizedStatus);

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

  useEffect(() => {
    if (!userId) return undefined;

    let idleTimerId = null;

    const clearIdleTimer = () => {
      if (idleTimerId) {
        window.clearTimeout(idleTimerId);
        idleTimerId = null;
      }
    };

    const scheduleIdleTimer = () => {
      clearIdleTimer();

      if (isInCall || useCallStore.getState().isInCall) {
        return;
      }

      if (document.hidden) {
        return;
      }

      idleTimerId = window.setTimeout(() => {
        if (document.hidden || useCallStore.getState().isInCall) {
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

    const resetIdleTimer = () => {
      if (
        manualStatusRef.current === PRESENCE_STATUS.ONLINE &&
        currentStatusRef.current === PRESENCE_STATUS.INACTIVE
      ) {
        applyStatus(PRESENCE_STATUS.ONLINE);
      }

      scheduleIdleTimer();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearIdleTimer();
        if (
          !useCallStore.getState().isInCall
          && manualStatusRef.current === PRESENCE_STATUS.ONLINE
          && currentStatusRef.current === PRESENCE_STATUS.ONLINE
        ) {
          applyStatus(PRESENCE_STATUS.INACTIVE);
        }
        return;
      }

      if (
        manualStatusRef.current === PRESENCE_STATUS.ONLINE &&
        currentStatusRef.current === PRESENCE_STATUS.INACTIVE
      ) {
        applyStatus(PRESENCE_STATUS.ONLINE);
      }
      scheduleIdleTimer();
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach((eventName) => {
      window.addEventListener(eventName, resetIdleTimer, { passive: true });
    });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    scheduleIdleTimer();

    return () => {
      clearIdleTimer();
      events.forEach((eventName) => {
        window.removeEventListener(eventName, resetIdleTimer);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId, isInCall]);

  useEffect(() => {
    if (!isInCall || !userId) return;

    if (
      manualStatusRef.current === PRESENCE_STATUS.ONLINE &&
      currentStatusRef.current === PRESENCE_STATUS.INACTIVE
    ) {
      applyStatus(PRESENCE_STATUS.ONLINE);
    }
  }, [isInCall, userId]);

  if (!userId) return null;

  // One source for label + dot (PresenceContext override wins over local state).
  const displayStatus = normalizeUserStatus(
    resolvePresence(userId, currentStatus),
  );
  const displayStatusLabel = getOwnStatusLabel(displayStatus);

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
      <div className={`user-panel ${styles['user-panel']}`}>
        <div className={styles['user-panel-content']}>
          <div className="user-avatar-slot">
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
                  className="user-avatar-status-button"
                  onClick={() => setIsStatusMenuOpen((prev) => !prev)}
                  title={displayStatusLabel}
                  type="button"
                >
                  <UserAvatarPresenceDot userId={userId} status={displayStatus} />
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
              <span className={styles['user-status-text']}>{displayStatusLabel}</span>
            </button>

            {isStatusMenuOpen && (
              <div className={styles['status-menu']}>
                {getUserStatusOptions().map((statusOption) => (
                  <button
                    key={statusOption.value}
                    className={`${styles['status-menu-item']} ${displayStatus === statusOption.value ? styles['status-menu-item-active'] : ''}`}
                    onClick={() => handleStatusChange(statusOption.value)}
                    type="button"
                  >
                    <span
                      className={styles['status-dot']}
                      style={{ backgroundColor: statusOption.color }}
                    />
                    <span>
                      {statusOption.value === PRESENCE_STATUS.OFFLINE
                        ? 'Невидимый'
                        : statusOption.label}
                    </span>
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
              type="button"
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
              type="button"
            >
              {!isGlobalAudioMuted ? <Headset fontSize="small" /> : <HeadsetOff fontSize="small" />}
            </button>

            <button
              className={styles['voice-control-button']}
              onClick={() => openSettings('account')}
              title="Настройки"
              type="button"
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
