import React, { useState, useEffect, useMemo } from 'react';
import { useGlobalCall } from '../../../shared/lib/hooks/useGlobalCall';
import { VideoCallGrid } from '../../../shared/ui/atoms';
import { createParticipant } from '../../../entities/video-call/model/types';
import { Menu, MenuItem } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import HeadsetIcon from '@mui/icons-material/Headset';
import HeadsetOffIcon from '@mui/icons-material/HeadsetOff';
import ChatIcon from '@mui/icons-material/Chat';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import NoiseAwareIcon from '@mui/icons-material/NoiseAware';
import NoiseControlOffIcon from '@mui/icons-material/NoiseControlOff';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import { userApi } from '../../../entities/user/api/userApi';
import { MEDIA_BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import { MusicBotControls } from '../../../shared/ui/molecules';
import './VoiceCallView.css';

// Определяет, является ли banner путём к изображению или цветом
const isBannerImage = (banner) => {
  if (!banner) return false;
  
  // Если начинается с #, это цвет
  if (banner.startsWith('#')) return false;
  
  // Если содержит расширения изображений, это путь к файлу
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
  const lowerBanner = banner.toLowerCase();
  if (imageExtensions.some(ext => lowerBanner.includes(ext))) return true;
  
  // Если начинается с http://, https://, /uploads/, /api/, это путь
  if (banner.startsWith('http://') || 
      banner.startsWith('https://') || 
      banner.startsWith('/uploads/') || 
      banner.startsWith('/api/') ||
      banner.startsWith('uploads/')) {
    return true;
  }
  
  // Если это валидный hex-цвет (например, #5865f2), это цвет
  const hexColorPattern = /^#[0-9A-Fa-f]{6}$/;
  if (hexColorPattern.test(banner)) return false;
  
  // По умолчанию считаем цветом, если не похоже на путь
  return false;
};

const VoiceCallView = ({
  channelId,
  channelName,
  userId,
  userName,
  onClose
}) => {
  const {
    isConnected,
    isMuted,
    isAudioEnabled,
    participants,
    audioBlocked,
    error,
    isNoiseSuppressed,
    noiseSuppressionMode,
    userVolumes,
    userMutedStates,
    showVolumeSliders,
    isGlobalAudioMuted,
    currentCall,
    isScreenSharing,
    screenShareStream,
    remoteScreenShares,
    isVideoEnabled,
    cameraStream,
    participantMuteStates,
    participantAudioStates,
    participantGlobalAudioStates,
    participantVideoStates,
    startCall,
    endCall,
    toggleMute,
    toggleNoiseSuppression,
    changeNoiseSuppressionMode,
    toggleUserMute,
    changeUserVolume,
    toggleVolumeSlider,
    toggleGlobalAudio,
    toggleScreenShare,
    toggleVideo
  } = useGlobalCall(userId, userName);

  const [showChatPanel, setShowChatPanel] = useState(false);
  const [noiseSuppressMenuAnchor, setNoiseSuppressMenuAnchor] = useState(null);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [showMusicBotPanel, setShowMusicBotPanel] = useState(false);

  // Логирование состояния демонстрации экрана
  // console.log('VoiceCallView screen share state:', { 
  //   isScreenSharing, 
  //   hasScreenShareStream: !!screenShareStream, 
  //   remoteScreenSharesSize: remoteScreenShares.size 
  // });

  useEffect(() => {
    console.log('VoiceCallView: useEffect triggered with:', { channelId, userId, userName, channelName });
    console.log('VoiceCallView: Current call state:', { isConnected, currentCall });
    
    if (channelId && userId && userName) {
      // Проверяем, не активен ли уже звонок в этом канале
      if (isConnected && currentCall?.channelId === channelId) {
        console.log('VoiceCallView: Call already active in this channel, skipping start');
        return;
      }
      
      console.log('VoiceCallView: Starting voice call');
      startCall(channelId, channelName).catch((err) => {
        console.error('Call start error:', err);
      });
    } else {
      console.log('VoiceCallView: Missing required parameters:', { channelId, userId, userName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, channelName, userId, userName]); // Убрали startCall из зависимостей

  // Загружаем профиль текущего пользователя
  useEffect(() => {
    if (userId) {
      userApi.getProfile(userId)
        .then(profile => {
          if (profile) {
            // Определяем, является ли banner изображением или цветом
            const bannerIsImage = isBannerImage(profile.banner);
            const bannerValue = profile.banner 
              ? (bannerIsImage ? `${MEDIA_BASE_URL}${profile.banner}` : profile.banner)
              : null;
            
            setCurrentUserProfile({
              avatar: profile.avatar ? `${MEDIA_BASE_URL}${profile.avatar}` : null,
              avatarColor: profile.avatarColor || '#5865f2',
              banner: bannerValue
            });
          }
        })
        .catch(error => {
          console.warn('Failed to load current user profile:', error);
        });
    }
  }, [userId]);

  useEffect(() => {
    return () => {
      // НЕ завершаем звонок при размонтировании компонента
      // Звонок должен продолжать работать в фоне
      console.log('VoiceCallView: Component unmounted, but call continues in background');
    };
  }, []);

  // Преобразуем участников голосового звонка в формат для видеосетки с мемоизацией
  const videoParticipants = useMemo(() => {
    console.log('🔄 useMemo triggered with:', {
      isMuted,
      isAudioEnabled,
      isGlobalAudioMuted,
      isVideoEnabled,
      participantMuteStatesSize: participantMuteStates?.size,
      participantAudioStatesSize: participantAudioStates?.size,
      participantGlobalAudioStatesSize: participantGlobalAudioStates?.size,
      participantVideoStatesSize: participantVideoStates?.size
    });
    
    // Текущий пользователь (хост)
    const currentUser = createParticipant(userId, userName, currentUserProfile?.avatar || null, 'online', 'host');
    currentUser.isMuted = isMuted;
    currentUser.isAudioEnabled = isAudioEnabled !== undefined ? isAudioEnabled : true; // Исправляем undefined
    currentUser.isGlobalAudioMuted = isGlobalAudioMuted; // Добавляем статус глобального звука
    currentUser.isSpeaking = false; // Можно добавить логику определения говорит ли пользователь
    currentUser.isVideoEnabled = isVideoEnabled; // Добавляем состояние веб-камеры
    currentUser.videoStream = cameraStream; // Добавляем видео поток
    currentUser.isCurrentUser = true; // Помечаем как текущего пользователя
    currentUser.avatarColor = currentUserProfile?.avatarColor || '#5865f2';
    currentUser.banner = currentUserProfile?.banner || null;
    
    console.log('🧑 Current user state:', {
      isMuted: currentUser.isMuted,
      isAudioEnabled: currentUser.isAudioEnabled,
      isGlobalAudioMuted: currentUser.isGlobalAudioMuted
    });
    
    const videoParticipantsList = [currentUser];
    
    // Добавляем всех остальных участников
    // Используем отдельные Maps для реактивности в реальном времени
    participants.forEach(participant => {
      const participantUserId = participant.userId || participant.id || participant.name;
      
      const videoParticipant = createParticipant(
        participantUserId, 
        participant.name, 
        participant.avatar || null, 
        'online', 
        'participant'
      );
      
      // Читаем состояния из отдельных Maps для реактивности в реальном времени
      videoParticipant.isMuted = participantMuteStates?.get(participantUserId) ?? participant.isMuted ?? false;
      videoParticipant.isAudioEnabled = participantAudioStates?.get(participantUserId) ?? participant.isAudioEnabled ?? true;
      videoParticipant.isGlobalAudioMuted = participantGlobalAudioStates?.get(participantUserId) ?? participant.isGlobalAudioMuted ?? false;
      videoParticipant.isSpeaking = participant.isSpeaking || false;
      videoParticipant.isVideoEnabled = participantVideoStates?.get(participantUserId) ?? participant.isVideoEnabled ?? false;
      videoParticipant.videoStream = participant.videoStream; // Добавляем видео поток
      // Добавляем данные профиля
      videoParticipant.avatarColor = participant.avatarColor || '#5865f2';
      videoParticipant.banner = participant.banner || null;
      videoParticipantsList.push(videoParticipant);
    });
    
    console.log('Video participants updated:', videoParticipantsList);
    return videoParticipantsList;
  }, [
    participants, 
    userId, 
    userName, 
    isMuted, 
    isAudioEnabled, 
    isGlobalAudioMuted, 
    isVideoEnabled, 
    cameraStream,
    participantMuteStates,
    participantAudioStates,
    participantGlobalAudioStates,
    participantVideoStates,
    currentUserProfile
  ]);


  const handleClose = () => {
    // НЕ завершаем звонок, только скрываем интерфейс
    // Звонок продолжает работать в фоне
    console.log('VoiceCallView: Interface closed, but call continues in background');
    if (onClose) {
      onClose();
    }
  };

  const enableAudioPlayback = async () => {
    const audioElements = document.querySelectorAll('audio');
    for (const audio of audioElements) {
      try {
        await audio.play();
      } catch (e) {
        console.log('Failed to play audio:', e);
      }
    }
  };

  // Обработчики меню шумоподавления
  const handleNoiseSuppressionMenuClose = () => {
    setNoiseSuppressMenuAnchor(null);
  };

  const handleNoiseSuppressionModeSelect = async (mode) => {
    console.log('UI: Selecting noise suppression mode:', mode);
    const success = await changeNoiseSuppressionMode(mode);
    if (success) {
      console.log('UI: Noise suppression mode changed successfully');
    } else {
      console.error('UI: Failed to change noise suppression mode');
    }
    handleNoiseSuppressionMenuClose();
  };

  const handleToggleNoiseSuppression = async () => {
    console.log('UI: Toggling noise suppression, current state:', isNoiseSuppressed);
    const success = await toggleNoiseSuppression();
    if (success) {
      console.log('UI: Noise suppression toggled successfully to:', !isNoiseSuppressed);
    } else {
      console.error('UI: Failed to toggle noise suppression');
    }
  };


  return (
    <div className="voice-call-container">
      {/* Main Wrapper */}
      <div className="call-container">
        <div className="root-idle">
          <div className="video-grid-wrapper">
            {/* Scroller */}
            <div className="scroller">
              <div className="list-items">

                {/* Error Banner */}
                {error && (
                  <div className="error-banner">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                {/* Audio Blocked Banner */}
                {audioBlocked && (
                  <div className="audio-blocked-banner">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    <div className="audio-blocked-text">
                      <strong>Браузер заблокировал автовоспроизведение</strong>
                      <span>Нажмите кнопку ниже, чтобы разрешить воспроизведение звука</span>
                      <button className="enable-audio-btn" onClick={enableAudioPlayback}>
                        Разрешить воспроизведение
                      </button>
                    </div>
                  </div>
                )}

                {/* Video Call Grid */}
                {(participants.length > 0 || isConnected) && (
                  <div className="video-call-grid-container">
                    <VideoCallGrid 
                      participants={videoParticipants}
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
                      onStopScreenShare={toggleScreenShare}
                      enableAutoFocus={false} // Отключаем автофокус для серверных звонков
                    />
                  </div>
                )}

              </div>
            </div>

            {/* Voice Controls */}
            <div className="video-controls">
              <div className="gradient-top"></div>
              <div className="gradient-bottom"></div>
              
              {/* Top Controls */}
              <div className="top-controls">
                <div className="header-wrapper">
                  <div className="header-bar">
                    <div className="header-children">
                      <div className="channel-title">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 3a1 1 0 0 0-1-1h-.06a1 1 0 0 0-.74.32L5.92 7H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2.92l4.28 4.68a1 1 0 0 0 .74.32H11a1 1 0 0 0 1-1V3ZM15.1 20.75c-.58.14-1.1-.33-1.1-.92v-.03c0-.5.37-.92.85-1.05a7 7 0 0 0 0-13.5A1.11 1.11 0 0 1 14 4.2v-.03c0-.6.52-1.06 1.1-.92a9 9 0 0 1 0 17.5Z"/>
                          <path d="M15.16 16.51c-.57.28-1.16-.2-1.16-.83v-.14c0-.43.28-.8.63-1.02a3 3 0 0 0 0-5.04c-.35-.23-.63-.6-.63-1.02v-.14c0-.63.59-1.1 1.16-.83a5 5 0 0 1 0 9.02Z"/>
                        </svg>
                        <span>{channelName}</span>
                      </div>
                    </div>
                    <div className="toolbar">
                      <button 
                        className="toolbar-button" 
                        type="button" 
                        aria-label="Показать музыкального бота"
                        onClick={() => setShowMusicBotPanel(!showMusicBotPanel)}
                      >
                        <MusicNoteIcon sx={{ fontSize: 24 }} />
                      </button>
                      <button 
                        className="toolbar-button" 
                        type="button" 
                        aria-label="Показать чат"
                        onClick={() => setShowChatPanel(!showChatPanel)}
                      >
                        <ChatIcon sx={{ fontSize: 24 }} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Music Bot Controls */}
              {showMusicBotPanel && (
                <div className="music-bot-container">
                  <MusicBotControls roomId={channelId} />
                </div>
              )}

              {/* Bottom Controls */}
              <div className="bottom-controls">
                <div className="edge-controls left"></div>
                <div className="center-controls">
                  <div className="wrapper">
                    <div className="button-section">
                      {/* Microphone with dropdown */}
                      <div className="attached-caret-button-container">
                        <button 
                          className={`center-button attached-button ${isMuted ? 'muted' : ''}`}
                          type="button" 
                          aria-label={isMuted ? 'Включить микрофон' : 'Заглушить'}
                          onClick={toggleMute}
                        >
                          {isMuted ? (
                            <MicOffIcon sx={{ fontSize: 24 }} />
                          ) : (
                            <MicIcon sx={{ fontSize: 24 }} />
                          )}
                        </button>
                        <div className={`context-menu-caret ${isMuted ? 'muted' : ''}`}>
                          <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
                        </div>
                      </div>

                      {/* Camera with dropdown */}
                      <div className="attached-caret-button-container">
                        <button 
                          className={`center-button attached-button ${isVideoEnabled ? 'active' : ''}`}
                          type="button" 
                          aria-label={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
                          onClick={toggleVideo}
                        >
                          <VideocamIcon sx={{ fontSize: 24 }} />
                        </button>
                        <div className="context-menu-caret">
                          <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
                        </div>
                      </div>
                    </div>

                    <div className="button-section">
                      {/* Screen Share */}
                      <div className="attached-button-container control-button">
                        <button 
                          className={`center-button ${isScreenSharing ? 'active' : ''}`}
                          type="button" 
                          aria-label="Продемонстрируйте свой экран"
                          onClick={() => {
                            console.log('Screen share button clicked, isScreenSharing:', isScreenSharing);
                            toggleScreenShare();
                          }}
                        >
                          <ScreenShareIcon sx={{ fontSize: 24 }} />
                        </button>
                      </div>

                      {/* Global Audio Toggle */}
                      <div className="attached-button-container">
                        <button 
                          className={`center-button ${isGlobalAudioMuted ? 'muted' : ''}`}
                          type="button"
                          onClick={toggleGlobalAudio}
                          aria-label={isGlobalAudioMuted ? 'Включить звук всех' : 'Выключить звук всех'}
                          title={isGlobalAudioMuted ? 'Звук всех участников выключен' : 'Звук всех участников включен'}
                        >
                          {isGlobalAudioMuted ? (
                            <HeadsetOffIcon sx={{ fontSize: 24 }} />
                          ) : (
                            <HeadsetIcon sx={{ fontSize: 24 }} />
                          )}
                        </button>
                      </div>

                      {/* Noise Suppression with dropdown */}
                      <div className="attached-caret-button-container">
                        <button 
                          className={`center-button attached-button ${isNoiseSuppressed ? '' : 'muted'}`}
                          type="button"
                          onClick={handleToggleNoiseSuppression}
                          aria-label={isNoiseSuppressed ? `Выключить шумоподавление (${noiseSuppressionMode})` : 'Включить шумоподавление'}
                          title={isNoiseSuppressed ? `Шумоподавление включено: ${noiseSuppressionMode === 'rnnoise' ? 'RNNoise (AI)' : noiseSuppressionMode === 'speex' ? 'Speex' : 'Noise Gate'}` : 'Шумоподавление выключено'}
                        >
                          {isNoiseSuppressed ? (
                            <NoiseAwareIcon sx={{ fontSize: 24 }} />
                          ) : (
                            <NoiseControlOffIcon sx={{ fontSize: 24 }} />
                          )}
                        </button>
                        <div 
                          className={`context-menu-caret ${isNoiseSuppressed ? '' : 'muted'}`}
                          onClick={(e) => setNoiseSuppressMenuAnchor(e.currentTarget)}
                          title="Выбрать режим шумоподавления"
                          style={{ cursor: 'pointer' }}
                        >
                          <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
                        </div>
                      </div>

                      {/* More Options */}
                      <div className="attached-button-container">
                        <button 
                          className="center-button"
                          type="button" 
                          aria-label="Другие настройки"
                        >
                          <MoreVertIcon sx={{ fontSize: 24 }} />
                        </button>
                      </div>
                    </div>

                    {/* Disconnect Button */}
                    <div className="disconnect-button-wrapper">
                      <div className="attached-button-container">
                        <button 
                          className="center-button disconnect"
                          type="button" 
                          aria-label="Завершить звонок"
                          onClick={async () => {
                            await endCall();
                            handleClose();
                          }}
                        >
                          <CallEndIcon sx={{ fontSize: 24 }} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="edge-controls right">
                  <button className="right-tray-icon" type="button" aria-label="В отдельном окне">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M15 2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V4.41l-4.3 4.3a1 1 0 1 1-1.4-1.42L19.58 3H16a1 1 0 0 1-1-1Z"/>
                      <path d="M5 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-6a1 1 0 1 0-2 0v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6a1 1 0 1 0 0-2H5Z"/>
                    </svg>
                  </button>
                  <button className="right-tray-icon" type="button" aria-label="Полноэкранный режим">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M4 6c0-1.1.9-2 2-2h3a1 1 0 0 0 0-2H6a4 4 0 0 0-4 4v3a1 1 0 0 0 2 0V6ZM4 18c0 1.1.9 2 2 2h3a1 1 0 1 1 0 2H6a4 4 0 0 1-4-4v-3a1 1 0 1 1 2 0v3ZM18 4a2 2 0 0 1 2 2v3a1 1 0 1 0 2 0V6a4 4 0 0 0-4-4h-3a1 1 0 1 0 0 2h3ZM20 18a2 2 0 0 1-2 2h-3a1 1 0 1 0 0 2h3a4 4 0 0 0 4-4v-3a1 1 0 1 0-2 0v3Z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Noise Suppression Menu */}
      <Menu
        anchorEl={noiseSuppressMenuAnchor}
        open={Boolean(noiseSuppressMenuAnchor)}
        onClose={handleNoiseSuppressionMenuClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        PaperProps={{
          sx: {
            backgroundColor: '#111214',
            color: '#f2f3f5',
            borderRadius: '8px',
            border: '1px solid #1e1f22',
            minWidth: '220px',
            '& .MuiMenuItem-root': {
              fontSize: '14px',
              padding: '10px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              '&:hover': {
                backgroundColor: '#2e3035',
              },
              '&.Mui-selected': {
                backgroundColor: '#5865f2',
                '&:hover': {
                  backgroundColor: '#4752c4',
                },
              },
            },
          },
        }}
      >
        <MenuItem 
          onClick={() => handleNoiseSuppressionModeSelect('rnnoise')}
          selected={noiseSuppressionMode === 'rnnoise'}
        >
          <div style={{ fontWeight: 600 }}>RNNoise</div>
          <div style={{ fontSize: '12px', color: '#b5bac1', marginTop: '2px' }}>AI-алгоритм, лучшее качество</div>
        </MenuItem>
        <MenuItem 
          onClick={() => handleNoiseSuppressionModeSelect('speex')}
          selected={noiseSuppressionMode === 'speex'}
        >
          <div style={{ fontWeight: 600 }}>Speex</div>
          <div style={{ fontSize: '12px', color: '#b5bac1', marginTop: '2px' }}>Классический, стабильный</div>
        </MenuItem>
        <MenuItem 
          onClick={() => handleNoiseSuppressionModeSelect('noisegate')}
          selected={noiseSuppressionMode === 'noisegate'}
        >
          <div style={{ fontWeight: 600 }}>Noise Gate</div>
          <div style={{ fontSize: '12px', color: '#b5bac1', marginTop: '2px' }}>Простой, быстрый</div>
        </MenuItem>
      </Menu>
    </div>
  );
};

export default VoiceCallView;