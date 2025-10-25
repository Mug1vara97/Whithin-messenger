import React, { useEffect } from 'react';
import { useGlobalCall } from '../../../lib/hooks/useGlobalCall';
import { createParticipant } from '../../../../entities/video-call/model/types';
import { VideoCallGrid } from '../../atoms';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import CallEndIcon from '@mui/icons-material/CallEnd';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
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

  // Принудительная активация фокуса на демонстрации экрана или вебкамере
  useEffect(() => {
    const hasAnyScreenShare = isScreenSharing || remoteScreenShares.size > 0;
    const hasAnyVideo = isVideoEnabled || participants.some(p => p.isVideoEnabled);
    const shouldAutoFocus = hasAnyScreenShare || hasAnyVideo;
    
    if (shouldAutoFocus) {
      // Небольшая задержка для того, чтобы VideoCallGrid успел отрендериться
      const timer = setTimeout(() => {
        // Сначала пробуем найти screen share tile
        let targetTile = document.querySelector('.screen-share-content');
        
        // Если screen share не найден, ищем video tile (вебкамера)
        if (!targetTile) {
          // Сначала ищем tile с видео удаленного пользователя
          const allVideoTiles = document.querySelectorAll('.video-tile, [data-participant-id]');
          for (const tile of allVideoTiles) {
            const participantId = tile.getAttribute('data-participant-id');
            if (participantId && participantId !== userId) {
              targetTile = tile;
              break;
            }
          }
          
          // Если удаленного пользователя с видео нет, ищем текущего пользователя
          if (!targetTile) {
            for (const tile of allVideoTiles) {
              const participantId = tile.getAttribute('data-participant-id');
              if (participantId && participantId === userId) {
                targetTile = tile;
                break;
              }
            }
          }
        }
        
        // Если все еще не найден, ищем любой tile с видео
        if (!targetTile) {
          targetTile = document.querySelector('[data-participant-id]');
        }
        
        if (targetTile) {
          targetTile.click();
          console.log('ChatVoiceCall: Auto-focused on screen share or video');
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isScreenSharing, screenShareStream, remoteScreenShares.size, isVideoEnabled, participants, userId]);

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
  currentUser.isSpeaking = false;
  currentUser.isVideoEnabled = isVideoEnabled;
  currentUser.videoStream = cameraStream;
  currentUser.isCurrentUser = true; // Помечаем как текущего пользователя
  
  const displayParticipants = [currentUser];
  
  // Добавляем всех остальных участников из глобального состояния
  participants.forEach(participant => {
    const videoParticipant = createParticipant(
      participant.userId || participant.id || participant.name, 
      participant.name, 
      participant.avatar || null, 
      'online', 
      'participant'
    );
    videoParticipant.isMuted = participant.isMuted || false;
    videoParticipant.isGlobalAudioMuted = participant.isGlobalAudioMuted || false;
    videoParticipant.isSpeaking = participant.isSpeaking || false;
    videoParticipant.isVideoEnabled = participant.isVideoEnabled || false;
    videoParticipant.videoStream = participant.videoStream || null;
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

  return (
    <div className={styles.voiceCallContainer}>
      {/* Основная область участников */}
      <div className={styles.voiceCallWrapper}>
        <div className={styles.participantsContainer}>
          {(() => {
            console.log('ChatVoiceCall: Rendering participants, isScreenSharing:', isScreenSharing, 'remoteScreenShares:', remoteScreenShares.size, 'isVideoEnabled:', isVideoEnabled);
            const hasAnyScreenShare = isScreenSharing || remoteScreenShares.size > 0;
            const hasAnyVideo = isVideoEnabled || participants.some(p => p.isVideoEnabled);
            const shouldShowVideoGrid = hasAnyScreenShare || hasAnyVideo;
            return shouldShowVideoGrid ? (
              /* При демонстрации экрана или вебкамере используем VideoCallGrid для фокуса */
              <div className={styles.screenShareContainer}>
                <VideoCallGrid 
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
                  hideBottomUsers={true}
                  isVideoEnabled={isVideoEnabled}
                  videoStream={cameraStream}
                  enableAutoFocus={false} // Отключаем автофокус для серверных звонков
                />
              </div>
            ) : (
              /* Обычное отображение кружков пользователей */
              displayParticipants.map((participant) => (
                <div key={participant.id} className={styles.participantItem}>
                  <div className={styles.participantAvatarContainer}>
                    <div className={styles.participantAvatar}>
                      <div className={styles.avatarCircle}>
                        {(participant.name || 'U').charAt(0).toUpperCase()}
                      </div>
                      {/* Индикаторы статуса */}
                      <div className={styles.statusIndicators}>
                        {participant.isMuted && (
                          <div className={`${styles.statusIndicator} ${styles.muteIndicator}`}>
                            <MicOffIcon />
                          </div>
                        )}
                        {participant.isGlobalAudioMuted && (
                          <div className={`${styles.statusIndicator} ${styles.audioMutedIndicator}`}>
                            <VolumeOffIcon />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            );
          })()}
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
              {isGlobalAudioMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
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
