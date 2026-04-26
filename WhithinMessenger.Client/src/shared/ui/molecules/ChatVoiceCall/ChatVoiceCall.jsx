import React, { useEffect, useState } from 'react';
import { useGlobalCall } from '../../../lib/hooks/useGlobalCall';
import { createParticipant } from '../../../../entities/video-call/model/types';
import { userApi } from '../../../../entities/user/api/userApi';
import { MEDIA_BASE_URL } from '../../../lib/constants/apiEndpoints';
import { VideoCallGrid } from '../../atoms';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import CallEndIcon from '@mui/icons-material/CallEnd';
import HeadsetIcon from '@mui/icons-material/Headset';
import HeadsetOffIcon from '@mui/icons-material/HeadsetOff';
import NoiseAwareIcon from '@mui/icons-material/NoiseAware';
import NoiseControlOffIcon from '@mui/icons-material/NoiseControlOff';
import styles from './ChatVoiceCall.module.css';

const ChatVoiceCall = ({
  chatId,
  chatName,
  userId,
  userName,
  onClose
}) => {
  const [currentUserProfile, setCurrentUserProfile] = useState(null);

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
    isGlobalAudioMuted,
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
    startCall,
    endCall,
    toggleMute,
    toggleGlobalAudio,
    toggleUserMute,
    changeUserVolume,
    toggleVolumeSlider,
    startScreenShare,
    stopScreenShare,
    toggleVideo
  } = useGlobalCall(userId, userName);

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
      } catch (error) {
        console.warn('ChatVoiceCall: failed to load current user profile', error);
      }
    };
    loadCurrentUserProfile();
    return () => {
      mounted = false;
    };
  }, [userId]);

  // Автоматически начинаем звонок при монтировании
  useEffect(() => {
    console.log('ChatVoiceCall: useEffect triggered with:', { chatId, userId, userName, chatName });

    if (chatId && userId && userName) {
      // Проверяем, не активен ли уже звонок в этом чате
      if (isConnected && currentCall?.channelId === chatId) {
        console.log('ChatVoiceCall: Call already active in this chat, skipping start');
        return;
      }

      console.log('ChatVoiceCall: Starting voice call');
      startCall(chatId, chatName).catch((err) => {
        console.error('Call start error:', err);
      });
    } else {
      console.log('ChatVoiceCall: Missing required parameters:', { chatId, userId, userName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, chatName, userId, userName]);

  // Отладочная информация для демонстрации экрана
  useEffect(() => {
    console.log('ChatVoiceCall: Screen sharing state changed:', { 
      isScreenSharing, 
      hasScreenShareStream: !!screenShareStream,
      participants: participants.length,
      isConnected
    });
  }, [isScreenSharing, screenShareStream, participants.length, isConnected]);

  // Автофокус отключен - используем enableAutoFocus={false} в VideoCallGrid

  // Очистка при размонтировании
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

  const handleToggleMute = () => {
    toggleMute();
  };

  const handleToggleVideo = async () => {
    try {
      console.log('🎥 Video button clicked, isVideoEnabled:', isVideoEnabled);
      console.log('🎥 toggleVideo function:', typeof toggleVideo);
      await toggleVideo();
      console.log('🎥 Video toggle completed');
    } catch (error) {
      console.error('🎥 Video toggle error:', error);
    }
  };

  const handleScreenShare = async () => {
    try {
      console.log('ChatVoiceCall: Screen share button clicked, isScreenSharing:', isScreenSharing);
      if (isScreenSharing) {
        await stopScreenShare();
      } else {
        await startScreenShare();
      }
    } catch (error) {
      console.error('Screen share error:', error);
    }
  };


  const handleEndCall = async () => {
    handleDisconnect();
  };

  // Создаем участников для отображения, как в VoiceCallView.jsx
  const currentUser = createParticipant(userId, userName || 'You', null, 'online', 'host');
  currentUser.isMuted = isMuted;
  currentUser.isAudioEnabled = isAudioEnabled;
  currentUser.isGlobalAudioMuted = isGlobalAudioMuted; // Используем из глобального состояния
  currentUser.isSpeaking = !isMuted && (participantSpeakingStates?.get(userId) || false);
  currentUser.isVideoEnabled = isVideoEnabled;
  currentUser.videoStream = cameraStream;
  currentUser.isCurrentUser = true; // Помечаем как текущего пользователя
  currentUser.avatar = currentUserProfile?.avatar || null;
  currentUser.avatarColor = currentUserProfile?.avatarColor || '#5865f2';
  currentUser.banner = currentUserProfile?.banner || null;
  
  const displayParticipants = [currentUser];
  
  // Добавляем всех остальных участников из глобального состояния
  participants.forEach(participant => {
    const pid = participant.userId || participant.id || participant.name;
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
      !videoParticipant.isMuted && remoteAudioOn && (participantSpeakingStates?.get(pid) || false);
    videoParticipant.isVideoEnabled = participant.isVideoEnabled || false;
    videoParticipant.videoStream = participant.videoStream || null;
    videoParticipant.avatarColor = participant.avatarColor || '#5865f2';
    videoParticipant.banner = participant.banner || null;
    console.log('🎥 Creating display participant:', {
      id: videoParticipant.id,
      name: videoParticipant.name,
      isVideoEnabled: videoParticipant.isVideoEnabled,
      hasVideoStream: !!videoParticipant.videoStream
    });
    displayParticipants.push(videoParticipant);
  });

  if (!isConnected) {
    return null;
  }

  const hasAnyScreenShare = isScreenSharing || remoteScreenShares.size > 0;
  const hasAnyVideo = isVideoEnabled || participants.some((participant) => participant.isVideoEnabled);
  const shouldShowVideoGrid = hasAnyScreenShare || hasAnyVideo;
  const isOneToOneVoiceMode = !shouldShowVideoGrid && displayParticipants.length <= 2;

  return (
    <div className={styles.voiceCallContainer}>
      {/* Основная область участников */}
      <div className={styles.voiceCallWrapper}>
        <div className={`${styles.participantsContainer} ${isOneToOneVoiceMode ? styles.oneToOneParticipants : ''}`}>
          {console.log('ChatVoiceCall: Rendering participants, isScreenSharing:', isScreenSharing, 'remoteScreenShares:', remoteScreenShares.size, 'isVideoEnabled:', isVideoEnabled)}
          {shouldShowVideoGrid ? (
            /* При демонстрации экрана или вебкамере используем VideoCallGrid для фокуса */
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
                screenShareParticipant={isScreenSharing ? {
                  id: userId,
                  name: userName,
                  isScreenSharing: true
                } : null}
                remoteScreenShares={remoteScreenShares}
                onStopScreenShare={handleScreenShare}
                forceGridMode={false}
                hideBottomUsers={displayParticipants.length <= 2}
                isVideoEnabled={isVideoEnabled}
                videoStream={cameraStream}
                enableAutoFocus={false}
              />
            </div>
          ) : (
            /* Обычное отображение кружков пользователей */
            displayParticipants.map((participant) => (
              (() => {
                const participantIsDeafened = participant.isGlobalAudioMuted || participant.isAudioDisabled || participant.isDeafened;
                return (
              <div
                key={participant.id}
                className={`${styles.participantItem} ${participant.isCurrentUser ? styles.currentUserParticipant : ''}`}
              >
                <div className={styles.participantAvatarContainer}>
                  <div className={styles.participantAvatar}>
                    <div
                      className={styles.avatarCircle}
                      style={!participant.avatar ? { backgroundColor: participant.avatarColor || '#5865f2' } : undefined}
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
              })()
            ))
          )}
        </div>
      </div>


      {/* Нижняя панель управления */}
      <div className={styles.bottomControls}>
        <div className={styles.controlSection}>
          <div className={styles.mainControls}>
            {/* Микрофон */}
            <button 
              className={`${styles.controlBtn} ${styles.microphoneBtn} ${isMuted ? 'muted' : 'unmuted'}`}
              onClick={handleToggleMute}
              title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
            >
              {isMuted ? <MicOffIcon /> : <MicIcon />}
            </button>

            {/* Камера */}
            <button 
              className={`${styles.controlBtn} ${styles.cameraBtn} ${isVideoEnabled ? 'active' : ''}`}
              onClick={handleToggleVideo}
              title={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
              style={{ 
                backgroundColor: isVideoEnabled ? '#5865f2' : '#40444b',
                color: isVideoEnabled ? '#ffffff' : '#b9bbbe'
              }}
            >
              {isVideoEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
            </button>

            {/* Демонстрация экрана */}
            <button 
              className={`${styles.controlBtn} ${styles.screenShareBtn} ${isScreenSharing ? 'active' : ''}`}
              onClick={handleScreenShare}
              title={isScreenSharing ? 'Остановить демонстрацию экрана' : 'Начать демонстрацию экрана'}
              style={{ 
                backgroundColor: isScreenSharing ? '#5865f2' : '#40444b',
                color: isScreenSharing ? '#ffffff' : '#b9bbbe'
              }}
            >
              {isScreenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
            </button>

            {/* Глобальный звук */}
            <button 
              className={`${styles.controlBtn} ${styles.globalAudioBtn} ${isGlobalAudioMuted ? 'muted' : 'unmuted'}`}
              onClick={toggleGlobalAudio}
              title={isGlobalAudioMuted ? 'Включить звук' : 'Выключить звук'}
            >
              {isGlobalAudioMuted ? <HeadsetOffIcon /> : <HeadsetIcon />}
            </button>

            {/* Завершить звонок */}
            <button 
              className={`${styles.controlBtn} ${styles.endCallBtn}`}
              onClick={handleEndCall}
              title="Завершить звонок"
            >
              <CallEndIcon />
            </button>
          </div>
        </div>
      </div>

      {/* Ошибки */}
      {error && (
        <div className={styles.errorBanner}>
          <span>Ошибка: {error}</span>
        </div>
      )}
    </div>
  );
};

export default ChatVoiceCall;
