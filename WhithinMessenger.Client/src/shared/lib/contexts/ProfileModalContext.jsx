import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ProfileModal, SettingsModal } from '../../ui/organisms';
import { useAuthContext } from './AuthContext';

const ProfileModalContext = createContext(null);

export const PROFILE_UPDATED_EVENT = 'userProfileUpdated';

const dispatchProfileUpdated = (profile) => {
  window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: profile }));
};

export const ProfileModalProvider = ({ children }) => {
  const { user } = useAuthContext();
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
    openProfile(currentUserId, currentUsername, status);
  }, [currentUserId, currentUsername, openProfile]);

  const openSettings = useCallback((tab = 'account') => {
    setSettingsInitialTab(tab);
    setShowSettings(true);
  }, []);

  const handleOpenSettingsFromProfile = useCallback(
    (tab) => {
      closeProfile();
      openSettings(tab);
    },
    [closeProfile, openSettings]
  );

  const handleProfileUpdated = useCallback((profile) => {
    dispatchProfileUpdated(profile);
  }, []);

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
