import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGlobalCall } from '../../../lib/hooks/useGlobalCall';
import {
  getParticipantIsSpeaking,
  useParticipantSpeakingStates,
} from '../../../lib/hooks/useParticipantSpeakingStates';
import { isSameVoiceChannel } from '../../../lib/stores/callStore';
import { useCallGridTestMode } from '../../../lib/hooks/useCallGridTestMode';
import { createParticipant } from '../../../../entities/video-call/model/types';
import { userApi } from '../../../../entities/user/api/userApi';
import { MEDIA_BASE_URL } from '../../../lib/constants/apiEndpoints';
import { VideoCallGrid } from '../../atoms';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import HeadsetIcon from '@mui/icons-material/Headset';
import HeadsetOffIcon from '@mui/icons-material/HeadsetOff';
import {
  useDismissibleCallBanners,
  VoiceCallChromeOverlay
} from '../VoiceCallChrome';
import { SpatialAudioStage } from '../SpatialAudioStage';
import styles from './ChatVoiceCall.module.css';

const PANEL_MIN_HEIGHT = 230;
const PANEL_MAX_HEIGHT_VH = 80;

const ChatVoiceCall = ({
  chatId,
  chatName,
  userId,
  userName,
  onClose
}) => {
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [panelHeight, setPanelHeight] = useState(null);
  const containerRef = useRef(null);
  const {
    testMode,
    handleAddTestParticipant,
    handleRemoveTestParticipant,
    appendTestParticipants,
  } = useCallGridTestMode();

  const handleResizeStart = useCallback((event) => {
    event.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const startY = event.clientY;
    const startHeight = container.getBoundingClientRect().height;
    const maxHeight = (window.innerHeight * PANEL_MAX_HEIGHT_VH) / 100;

    const handleMouseMove = (moveEvent) => {
      const nextHeight = Math.min(
        maxHeight,
        Math.max(PANEL_MIN_HEIGHT, startHeight + (moveEvent.clientY - startY))
      );
      setPanelHeight(nextHeight);
    };

    const handleMouseUp = () => {
      document.body.classList.remove('is-resizing-chat-voice-call');
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    document.body.classList.add('is-resizing-chat-voice-call');
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  const toMediaUrl = (value) => {
    if (!value) return null;
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    return `${MEDIA_BASE_URL}${value}`;
  };

  const toBannerValue = (value) => {
    if (!value) return null;
    if (value.startsWith('#')) return value;
    const lower = value.toLowerCase();
    const looksLikeImage =
      value.startsWith('http://') ||
      value.startsWith('https://') ||
      value.startsWith('/uploads/') ||
      value.startsWith('/api/') ||
      value.startsWith('uploads/') ||
      ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'].some((ext) => lower.includes(ext));
    return looksLikeImage ? toMediaUrl(value) : value;
  };

  const {
    isConnected,
    isMuted,
    isAudioEnabled,
    participants,
    error,
    audioBlocked,
    isGlobalAudioMuted,
    isInCall,
    currentRoomId,
    currentCall,
    isScreenSharing,
    screenShareStream,
    isVideoEnabled,
    cameraStream,
    userVolumes,
    userMutedStates,
    showVolumeSliders,
    remoteScreenShares,
    participantSpeakingStates,
    participantMuteStates,
    participantAudioStates,
    isNoiseSuppressed,
    noiseSuppressionMode,
    startCall,
    endCall,
    toggleMute,
    toggleGlobalAudio,
    toggleUserMute,
    changeUserVolume,
    toggleVolumeSlider,
    toggleScreenShare,
    toggleVideo,
    toggleNoiseSuppression,
    changeNoiseSuppressionMode,
    spatialAudioEnabled,
    showSpatialAudioStage,
    toggleSpatialAudio,
    toggleSpatialAudioStage
  } = useGlobalCall(userId, userName);

  const participantSpeakingStatesLive = useParticipantSpeakingStates();

  const {
    showErrorBanner,
    showAudioBlockedBanner,
    setDismissedError,
    setDismissedAudioBlocked
  } = useDismissibleCallBanners(error, audioBlocked);

  useEffect(() => {
    let mounted = true;
    const loadCurrentUserProfile = async () => {
      if (!userId) return;
      try {
        const profile = await userApi.getProfile(userId);
        if (!mounted || !profile) return;
        setCurrentUserProfile({
          avatar: toMediaUrl(profile.avatar),
          avatarColor: profile.avatarColor || '#5865f2',
          banner: toBannerValue(profile.banner)
        });
      } catch (profileError) {
        console.warn('ChatVoiceCall: failed to load current user profile', profileError);
      }
    };
    loadCurrentUserProfile();
    return () => {
      mounted = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!chatId || !userId || !userName) return;

    const alreadyInThisChat =
      isInCall &&
      (isSameVoiceChannel(currentRoomId, chatId) ||
        isSameVoiceChannel(currentCall?.channelId, chatId));

    if (!alreadyInThisChat && isInCall) {
      startCall(chatId, chatName).catch((err) => {
        console.error('Call start error:', err);
      });
      return;
    }

    if (alreadyInThisChat) {
      startCall(chatId, chatName).catch((err) => {
        console.error('Call resync error:', err);
      });
      return;
    }

    if (!isInCall) {
      startCall(chatId, chatName).catch((err) => {
        console.error('Call start error:', err);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, chatName, userId, userName]);

  useEffect(() => {
    return () => {
      console.log('ChatVoiceCall: Component unmounted, but call continues in background');
    };
  }, []);

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  const handleDisconnect = async () => {
    await endCall();
    handleClose();
  };

  const currentUser = createParticipant(userId, userName || 'You', null, 'online', 'host');
  currentUser.isMuted = isMuted;
  currentUser.isAudioEnabled = isAudioEnabled;
  currentUser.isGlobalAudioMuted = isGlobalAudioMuted;
  currentUser.isSpeaking =
    !isMuted && (participantSpeakingStates?.get(String(userId)) || false);
  currentUser.isVideoEnabled = isVideoEnabled;
  currentUser.videoStream = cameraStream;
  currentUser.isCurrentUser = true;
  currentUser.avatar = currentUserProfile?.avatar || null;
  currentUser.avatarColor = currentUserProfile?.avatarColor || '#5865f2';
  currentUser.banner = currentUserProfile?.banner || null;

  const displayParticipants = useMemo(() => {
    const list = [currentUser];

    participants.forEach((participant) => {
      const pid = participant.userId || participant.id || participant.name;
      if (String(pid) === String(userId)) {
        return;
      }
      const videoParticipant = createParticipant(
        pid,
        participant.name,
        participant.avatar || null,
        'online',
        'participant'
      );
      videoParticipant.isMuted = participantMuteStates?.get(pid) ?? participant.isMuted ?? false;
      videoParticipant.isGlobalAudioMuted = participant.isGlobalAudioMuted || false;
      videoParticipant.isAudioDisabled = participant.isAudioDisabled || participant.isDeafened || false;
      const remoteAudioOn = participantAudioStates?.get(pid) !== false;
      videoParticipant.isSpeaking =
        !videoParticipant.isMuted &&
        remoteAudioOn &&
        (participantSpeakingStates?.get(String(pid)) || false);
      videoParticipant.isVideoEnabled = participant.isVideoEnabled || false;
      videoParticipant.videoStream = participant.videoStream || null;
      videoParticipant.avatarColor = participant.avatarColor || '#5865f2';
      videoParticipant.banner = participant.banner || null;
      list.push(videoParticipant);
    });

    return appendTestParticipants(list);
  }, [
    appendTestParticipants,
    currentUser,
    participantAudioStates,
    participantMuteStates,
    participantSpeakingStates,
    participants,
    userId,
  ]);

  if (!isConnected) {
    return null;
  }

  const hasAnyScreenShare = isScreenSharing || remoteScreenShares.size > 0;
  const hasAnyVideo = isVideoEnabled || participants.some((participant) => participant.isVideoEnabled);
  const shouldShowVideoGrid = hasAnyScreenShare || hasAnyVideo || testMode;
  const isOneToOneVoiceMode = !shouldShowVideoGrid && displayParticipants.length <= 2;

  const containerStyle =
    panelHeight != null
      ? { height: `${panelHeight}px`, flex: '0 0 auto' }
      : undefined;

  return (
    <div
      ref={containerRef}
      className={styles.voiceCallContainer}
      style={containerStyle}
    >
      <div className={styles.voiceCallWrapper}>
        <div className={`${styles.participantsContainer} ${isOneToOneVoiceMode ? styles.oneToOneParticipants : ''}`}>
          {shouldShowVideoGrid ? (
            <div className={styles.screenShareContainer}>
              <VideoCallGrid
                className="dm-grid-fit"
                participants={displayParticipants}
                onParticipantClick={(participant) => {
                  console.log('Clicked participant:', participant);
                }}
                userVolumes={userVolumes}
                userMutedStates={userMutedStates}
                showVolumeSliders={showVolumeSliders}
                onToggleUserMute={toggleUserMute}
                onChangeUserVolume={changeUserVolume}
                onToggleVolumeSlider={toggleVolumeSlider}
                screenShareStream={screenShareStream}
                isScreenSharing={isScreenSharing}
                screenShareParticipant={
                  isScreenSharing
                    ? {
                        id: userId,
                        name: userName,
                        isScreenSharing: true
                      }
                    : null
                }
                remoteScreenShares={remoteScreenShares}
                onStopScreenShare={toggleScreenShare}
                forceGridMode={false}
                hideBottomUsers={displayParticipants.length <= 2}
                isVideoEnabled={isVideoEnabled}
                videoStream={cameraStream}
                enableAutoFocus={false}
                testMode={testMode}
                onAddTestParticipant={handleAddTestParticipant}
                onRemoveTestParticipant={handleRemoveTestParticipant}
              />
            </div>
          ) : (
            displayParticipants.map((participant) => {
              const participantIsDeafened =
                participant.isGlobalAudioMuted || participant.isAudioDisabled || participant.isDeafened;
              const isSpeakingLive = getParticipantIsSpeaking(
                participantSpeakingStatesLive,
                participant.id,
                {
                  isMuted: participant.isMuted,
                  audioEnabled: participant.isAudioEnabled,
                }
              );
              return (
                <div
                  key={participant.id}
                  className={`${styles.participantItem} ${participant.isCurrentUser ? styles.currentUserParticipant : ''} ${
                    isSpeakingLive ? styles.participantSpeaking : ''
                  }`}
                >
                  <div className={styles.participantAvatarContainer}>
                    <div className={styles.participantAvatar}>
                      <div
                        className={styles.avatarCircle}
                        style={!participant.avatar ? { backgroundColor: participant.avatarColor || '#4e5058' } : undefined}
                      >
                        {participant.avatar ? (
                          <img
                            src={participant.avatar}
                            alt={participant.name || 'User'}
                            className={styles.avatarImage}
                          />
                        ) : (
                          (participant.name || 'U').charAt(0).toUpperCase()
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={styles.participantName}>{participant.name || 'Unknown'}</span>
                  <div className={styles.participantStatusRow}>
                    <div className={`${styles.participantStatusPill} ${participant.isMuted ? styles.statusOff : styles.statusOn}`}>
                      {participant.isMuted ? <MicOffIcon sx={{ fontSize: 14 }} /> : <MicIcon sx={{ fontSize: 14 }} />}
                    </div>
                    <div className={`${styles.participantStatusPill} ${participantIsDeafened ? styles.statusOff : styles.statusOn}`}>
                      {participantIsDeafened ? <HeadsetOffIcon sx={{ fontSize: 14 }} /> : <HeadsetIcon sx={{ fontSize: 14 }} />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <SpatialAudioStage currentUserId={userId} />

      <VoiceCallChromeOverlay
        showHeader={false}
        compactBanners
        error={error}
        showErrorBanner={showErrorBanner}
        showAudioBlockedBanner={showAudioBlockedBanner}
        onDismissError={() => setDismissedError(true)}
        onDismissAudioBlocked={() => setDismissedAudioBlocked(true)}
        controlProps={{
          isMuted,
          onToggleMute: toggleMute,
          isGlobalAudioMuted,
          onToggleGlobalAudio: toggleGlobalAudio,
          isNoiseSuppressed,
          noiseSuppressionMode,
          onToggleNoiseSuppression: toggleNoiseSuppression,
          onNoiseSuppressionModeSelect: changeNoiseSuppressionMode,
          isVideoEnabled,
          onToggleVideo: toggleVideo,
          isScreenSharing,
          onToggleScreenShare: toggleScreenShare,
          spatialAudioEnabled,
          showSpatialAudioStage,
          onToggleSpatialAudioStage: () => toggleSpatialAudioStage(),
          onToggleSpatialAudio: () => toggleSpatialAudio(),
          onDisconnect: handleDisconnect
        }}
      />

      <div
        className={styles.resizeHandle}
        onMouseDown={handleResizeStart}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Изменить высоту панели звонка"
        title="Потяните, чтобы изменить высоту"
      />
    </div>
  );
};

export default ChatVoiceCall;
