import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ProfileModal, SettingsModal } from '../../ui/organisms';
import { useAuthContext } from './AuthContext';
import { resolveUserDisplayName } from '../utils/userDisplayNameHelpers';
import { SOUNDPAD_OPEN_MANAGER_EVENT } from '../soundpad/soundpadPanelEvents';

const ProfileModalContext = createContext(null);

export const PROFILE_UPDATED_EVENT = 'userProfileUpdated';

const dispatchProfileUpdated = (profile) => {
  window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: profile }));
};

export const ProfileModalProvider = ({ children }) => {
  const { user, updateUser } = useAuthContext();
  const currentUserId = user?.id || user?.userId || user?.Id;
  const currentUsername = user?.username || user?.Username || user?.userName;

  const [profileView, setProfileView] = useState({
    isOpen: false,
    userId: null,
    username: '',
    initialStatus: null,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState('account');

  const closeProfile = useCallback(() => {
    setProfileView({ isOpen: false, userId: null, username: '', initialStatus: null });
  }, []);

  const openProfile = useCallback((userId, username, initialStatus = null) => {
    if (!userId) return;
    setProfileView({
      isOpen: true,
      userId,
      username: username || 'Пользователь',
      initialStatus,
    });
  }, []);

  const openOwnProfile = useCallback((initialStatus = null) => {
    if (!currentUserId) return;
    let status = initialStatus;
    if (status == null) {
      try {
        const saved = localStorage.getItem(`whithin:user-status:${currentUserId}`);
        if (saved) status = saved;
      } catch {
        // ignore storage errors
      }
    }
    const currentVisibleName = resolveUserDisplayName({
      displayName: user?.displayName ?? user?.DisplayName,
      username: currentUsername,
    });
    openProfile(currentUserId, currentVisibleName, status);
  }, [currentUserId, currentUsername, openProfile, user?.DisplayName, user?.displayName]);

  const openSettings = useCallback((tab = 'account') => {
    setSettingsInitialTab(tab);
    setShowSettings(true);
  }, []);

  useEffect(() => {
    const onOpenSoundpadSettings = () => openSettings('soundpad');
    window.addEventListener(SOUNDPAD_OPEN_MANAGER_EVENT, onOpenSoundpadSettings);
    return () => window.removeEventListener(SOUNDPAD_OPEN_MANAGER_EVENT, onOpenSoundpadSettings);
  }, [openSettings]);

  const handleOpenSettingsFromProfile = useCallback(
    (tab) => {
      closeProfile();
      openSettings(tab);
    },
    [closeProfile, openSettings]
  );

  const handleProfileUpdated = useCallback((profile) => {
    dispatchProfileUpdated(profile);
    if (typeof updateUser !== 'function') return;
    const profileUserId = profile?.userId ?? profile?.UserId;
    if (
      profileUserId != null &&
      currentUserId != null &&
      String(profileUserId) === String(currentUserId)
    ) {
      const nextDisplayName = profile?.displayName ?? profile?.DisplayName ?? null;
      updateUser({ displayName: nextDisplayName });
    }
  }, [currentUserId, updateUser]);

  const isOwnProfile =
    profileView.userId != null &&
    currentUserId != null &&
    String(profileView.userId) === String(currentUserId);

  const value = useMemo(
    () => ({
      openProfile,
      openOwnProfile,
      closeProfile,
      openSettings,
      closeSettings: () => setShowSettings(false),
      isSettingsOpen: showSettings,
    }),
    [openProfile, openOwnProfile, closeProfile, openSettings, showSettings]
  );

  return (
    <ProfileModalContext.Provider value={value}>
      {children}
      <ProfileModal
        isOpen={profileView.isOpen}
        onClose={closeProfile}
        userId={profileView.userId}
        username={profileView.username}
        initialStatus={profileView.initialStatus}
        isOwnProfile={isOwnProfile}
        onOpenSettings={isOwnProfile ? handleOpenSettingsFromProfile : undefined}
        onProfileUpdated={handleProfileUpdated}
      />
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        initialTab={settingsInitialTab}
        onProfileUpdated={handleProfileUpdated}
      />
    </ProfileModalContext.Provider>
  );
};

export const useProfileModal = () => {
  const context = useContext(ProfileModalContext);
  if (!context) {
    throw new Error('useProfileModal must be used within ProfileModalProvider');
  }
  return context;
};
