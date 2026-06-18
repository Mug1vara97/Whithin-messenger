import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { useCallStore } from '../../../lib/stores/callStore';
import {
  findChannelParticipant,
  getParticipantIsDeafened,
  getParticipantIsMuted,
  getParticipantIsServerDeafened,
  getParticipantIsServerMuted,
  getParticipantIsSpeaking,
  useActiveVoiceChannelParticipantList,
  useParticipantGlobalAudioStates,
  useParticipantMuteStates,
  useParticipantSpeakingStates,
} from '../../../lib/hooks/useParticipantSpeakingStates';
import {
  selectActiveServerDeafened,
  selectActiveServerMuted,
} from '../../../lib/voice/serverVoiceModerationState';
import SettingsIcon from '@mui/icons-material/Settings';
import MicOffIcon from '@mui/icons-material/MicOff';
import MicIcon from '@mui/icons-material/Mic';
import HeadsetOffIcon from '@mui/icons-material/HeadsetOff';
import GavelIcon from '@mui/icons-material/Gavel';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { Slider } from '@mui/material';
import { useVoiceParticipantModeration } from '../../molecules/VoiceParticipantModerationMenu';
import UserAvatar from '../UserAvatar/UserAvatar';
import './VideoCallGrid.css';

/** Максимум участников на одной странице сетки (есть CSS для 1–9) */
const GRID_PAGE_SIZE = 9;

// Компонент для управления video элементом
const VideoElement = React.memo(({ stream, participantId, isLocal = false }) => {
  const videoRef = useRef(null);
  
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    
    if (stream) {
      console.log('🎥 VideoElement: Setting stream for participant:', participantId, 'isLocal:', isLocal);
      videoElement.srcObject = stream;
      videoElement.play().catch(error => {
        if (error.name !== 'AbortError') {
          console.warn('Camera video play error:', error);
        }
      });
    } else {
      // Очищаем srcObject когда stream null
      console.log('🎥 VideoElement: Clearing stream for participant:', participantId);
      videoElement.srcObject = null;
    }
    
    // Cleanup при размонтировании или изменении stream
    return () => {
      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, [stream, participantId, isLocal]);
  
  // Не рендерим видео если нет потока или он неактивен
  if (!stream || !stream.active) {
    return null;
  }
  
  return (
    <video
      ref={videoRef}
      className={`tile-video ${isLocal ? 'tile-video-mirrored' : ''}`}
      autoPlay
      muted
      playsInline
    />
  );
});

// Мемоизированный компонент для демонстрации экрана
const ScreenShareElement = React.memo(({ stream, participantId }) => {
  const videoRef = useRef(null);
  
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    
    if (stream && stream.active) {
      console.log('🖥️ ScreenShareElement: Setting stream for participant:', participantId);
      videoElement.srcObject = stream;
      videoElement.play().catch(error => {
        if (error.name !== 'AbortError') {
          console.warn('Screen share video play error:', error);
        }
      });
    } else {
      console.log('🖥️ ScreenShareElement: Clearing stream for participant:', participantId);
      videoElement.srcObject = null;
    }
    
    // Cleanup при размонтировании
    return () => {
      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, [stream, participantId]);
  
  // Не рендерим если нет активного потока
  if (!stream || !stream.active) {
    return null;
  }
  
  return (
    <video
      ref={videoRef}
      className="tile-video"
      autoPlay
      muted
      playsInline
    />
  );
});

const VideoCallGrid = ({ 
  participants = [], 
  onParticipantClick,
  className = '',
  userVolumes = new Map(),
  userMutedStates = new Map(),
  showVolumeSliders = new Map(),
  onToggleUserMute,
  onChangeUserVolume,
  onToggleVolumeSlider,
  screenShareStream = null,
  isScreenSharing = false,
  screenShareParticipant = null,
  remoteScreenShares = new Map(),
  forceGridMode = false,
  hideBottomUsers = false,
  enableAutoFocus = true, // Новый пропс для управления автофокусом
  testMode = false, // Режим тестирования с кнопками добавления/удаления пользователей
  onAddTestParticipant, // Callback для добавления тестового участника
  onRemoveTestParticipant, // Callback для удаления тестового участника
  canMuteMembers = false,
  voiceChannelId = null,
  serverId = null,
  currentUserId = null,
}) => {
  const bottomGridRef = useRef(null);
  const participantSpeakingStates = useParticipantSpeakingStates();
  const participantMuteStates = useParticipantMuteStates();
  const participantGlobalAudioStates = useParticipantGlobalAudioStates();
  const activeVoiceChannelParticipants = useActiveVoiceChannelParticipantList();
  const localIsMuted = useCallStore((state) => state.isMuted);
  const localIsGlobalAudioMuted = useCallStore((state) => state.isGlobalAudioMuted);
  const localIsServerMuted = useCallStore((state) => selectActiveServerMuted(state, serverId));
  const localIsServerDeafened = useCallStore((state) => selectActiveServerDeafened(state, serverId));
  const { handleParticipantContextMenu, moderationMenu } = useVoiceParticipantModeration({
    channelId: voiceChannelId,
    currentUserId,
    canMuteMembers,
    serverId,
  });

  const getInitials = (name) => {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length === 1) {
      return name.charAt(0).toUpperCase();
    }
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = [
      '#5865f2', '#3ba55d', '#faa81a', '#ed4245', '#eb459e',
      '#57f287', '#fee75c', '#f26522', '#00d9ff', '#7289da'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

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

  // Создаем расширенный список участников, включая демонстрации экрана
  const extendedParticipants = useMemo(() => {
    const screenShareParticipants = [];
    
    // Локальная демонстрация экрана
    if (isScreenSharing && screenShareStream && screenShareParticipant) {
      screenShareParticipants.push({
        id: `screen-share-local-${screenShareParticipant.id}`,
        name: screenShareParticipant.name,
        isScreenShare: true,
        isLocal: true,
        stream: screenShareStream
      });
    }
    
    // Удаленные демонстрации экрана
    Array.from(remoteScreenShares.values()).forEach((screenShare) => {
      screenShareParticipants.push({
        id: `screen-share-remote-${screenShare.producerId}`,
        name: screenShare.userName,
        isScreenShare: true,
        isLocal: false,
        stream: screenShare.stream,
        producerId: screenShare.producerId
      });
    });
    
    const extended = [...participants, ...screenShareParticipants];
    return extended;
  }, [
    participants, 
    isScreenSharing, 
    screenShareStream, 
    screenShareParticipant, 
    remoteScreenShares
  ]);

  // Локальная логика вместо useVideoCall
  const [focusedParticipantId, setFocusedParticipantId] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [bottomPage, setBottomPage] = useState(0);
  const [visibleBottomUsers] = useState(6);
  const [lastVideoParticipants, setLastVideoParticipants] = useState(new Set());
  const [fullscreenScreenShareId, setFullscreenScreenShareId] = useState(null);

  // Сброс состояния полноэкранного режима при выходе
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setFullscreenScreenShareId(null);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const isFocusedMode = focusedParticipantId !== null;
  const focusedParticipant = extendedParticipants.find(p => p.id === focusedParticipantId);

  const totalPages = extendedParticipants.length <= GRID_PAGE_SIZE
    ? 1
    : Math.ceil(extendedParticipants.length / GRID_PAGE_SIZE);

  const bottomParticipants = useMemo(
    () => extendedParticipants.filter((participant) => participant.id !== focusedParticipantId),
    [extendedParticipants, focusedParticipantId]
  );

  const totalBottomPages = bottomParticipants.length <= visibleBottomUsers
    ? 1
    : Math.ceil(bottomParticipants.length / visibleBottomUsers);

  const currentPageParticipants = useMemo(() => {
    if (extendedParticipants.length <= GRID_PAGE_SIZE) {
      return extendedParticipants;
    }
    const start = currentPage * GRID_PAGE_SIZE;
    return extendedParticipants.slice(start, start + GRID_PAGE_SIZE);
  }, [extendedParticipants, currentPage]);

  const currentBottomParticipants = useMemo(() => {
    if (bottomParticipants.length <= visibleBottomUsers) {
      return bottomParticipants;
    }
    const start = bottomPage * visibleBottomUsers;
    return bottomParticipants.slice(start, start + visibleBottomUsers);
  }, [bottomParticipants, bottomPage, visibleBottomUsers]);

  useEffect(() => {
    setCurrentPage((page) => {
      const maxPage = Math.max(0, totalPages - 1);
      return Math.min(page, maxPage);
    });
  }, [totalPages]);

  useEffect(() => {
    setBottomPage((page) => {
      const maxPage = Math.max(0, totalBottomPages - 1);
      return Math.min(page, maxPage);
    });
  }, [totalBottomPages]);

  const renderTestControls = () => {
    if (!testMode) return null;

    return (
      <div className="test-controls">
        <button
          type="button"
          className="test-btn test-btn-add"
          onClick={onAddTestParticipant}
          title="Добавить тестового участника"
        >
          + Добавить участника ({extendedParticipants.length})
        </button>
        <button
          type="button"
          className="test-btn test-btn-remove"
          onClick={onRemoveTestParticipant}
          disabled={extendedParticipants.length <= 1}
          title="Удалить последнего участника"
        >
          − Удалить участника
        </button>
      </div>
    );
  };
  
  // Действия
  const focusParticipant = useCallback((participantId) => {
    if (focusedParticipantId === participantId) {
      setFocusedParticipantId(null);
      setBottomPage(0);
    } else {
      setFocusedParticipantId(participantId);
      setBottomPage(0);
    }
  }, [focusedParticipantId]);

  const goToPage = (page) => {
    setCurrentPage(page);
  };

  const goToBottomPage = (page) => {
    setBottomPage(page);
  };

  // Автоматический фокус на вебкамеру (только при включении новой)
  useEffect(() => {
    // Проверяем, включен ли автофокус
    if (!enableAutoFocus) {
      console.log('VideoCallGrid: Auto-focus disabled');
      return;
    }
    
    if (!isFocusedMode) {
      // Получаем текущих участников с вебкамерой
      const currentVideoParticipants = new Set(
        extendedParticipants
          .filter(p => p.isVideoEnabled && p.videoStream)
          .map(p => p.id)
      );
      
      // Находим новых участников с вебкамерой (которых не было в предыдущем состоянии)
      const newVideoParticipants = [...currentVideoParticipants].filter(
        id => !lastVideoParticipants.has(id)
      );
      
      if (newVideoParticipants.length > 0) {
        console.log('VideoCallGrid: New video participants detected:', newVideoParticipants);
        
        // Сначала ищем удаленного участника с вебкамерой
        let videoParticipant = extendedParticipants.find(p => 
          p.isVideoEnabled && p.videoStream && !p.isCurrentUser && newVideoParticipants.includes(p.id)
        );
        
        // Если удаленного участника с вебкамерой нет, фокусируемся на текущем пользователе
        if (!videoParticipant) {
          videoParticipant = extendedParticipants.find(p => 
            p.isVideoEnabled && p.videoStream && p.isCurrentUser && newVideoParticipants.includes(p.id)
          );
        }
        
        if (videoParticipant) {
          console.log('VideoCallGrid: Auto-focusing on new video participant:', videoParticipant.id, 'isCurrentUser:', videoParticipant.isCurrentUser);
          focusParticipant(videoParticipant.id);
        }
      }
      
      // Обновляем состояние для следующей проверки
      setLastVideoParticipants(currentVideoParticipants);
    }
  }, [extendedParticipants, isFocusedMode, focusParticipant, lastVideoParticipants, enableAutoFocus]);

  const handleParticipantClick = (participant) => {
    focusParticipant(participant.id);
    onParticipantClick?.(participant);
  };

  const handlePrevPage = () => {
    goToPage(Math.max(0, currentPage - 1));
  };

  const handleNextPage = () => {
    goToPage(Math.min(totalPages - 1, currentPage + 1));
  };

  const handlePrevBottomPage = () => {
    goToBottomPage(Math.max(0, bottomPage - 1));
  };

  const handleNextBottomPage = () => {
    goToBottomPage(Math.min(totalBottomPages - 1, bottomPage + 1));
  };

  const handleScreenShareFullscreen = useCallback((participantId, e) => {
    e?.stopPropagation?.();
    const tile = e?.target?.closest?.('.video-tile');
    if (!tile) return;
    if (fullscreenScreenShareId === participantId) {
      document.exitFullscreen?.();
      setFullscreenScreenShareId(null);
    } else {
      tile.requestFullscreen?.();
      setFullscreenScreenShareId(participantId);
    }
  }, [fullscreenScreenShareId]);

  const renderTileAvatar = (participant, isSmall, { overlay = false } = {}) => {
    const avatarSize = isSmall ? 60 : 100;
    const avatarNode = (
      <div className={`tile-avatar-wrap${overlay ? ' tile-avatar-wrap--overlay' : ''}`}>
        <UserAvatar
          username={participant.name || 'U'}
          avatarUrl={participant.avatar}
          avatarColor={participant.avatarColor || getAvatarColor(participant.name)}
          avatarDecoration={participant.avatarDecoration}
          size={avatarSize}
        />
      </div>
    );

    if (overlay) {
      return avatarNode;
    }

    return <div className="tile-avatar-stage">{avatarNode}</div>;
  };

  const renderParticipantTile = (participant, isSmall = false) => {
    const isFocused = participant.id === focusedParticipantId;
    const channelParticipant = findChannelParticipant(activeVoiceChannelParticipants, participant.id);
    const isMuted = getParticipantIsMuted(
      participantMuteStates,
      participant,
      localIsMuted,
      channelParticipant
    );
    const isDeafened = getParticipantIsDeafened(
      participantGlobalAudioStates,
      participant,
      localIsGlobalAudioMuted,
      channelParticipant
    );
    const isSpeaking = getParticipantIsSpeaking(participantSpeakingStates, participant.id, {
      isMuted,
    });
    const isServerMuted =
      getParticipantIsServerMuted(channelParticipant, {
        isCurrentUser: participant.isCurrentUser,
        localIsServerMuted,
      }) || Boolean(participant.isServerMuted);
    const isServerDeafened =
      getParticipantIsServerDeafened(channelParticipant, {
        isCurrentUser: participant.isCurrentUser,
        localIsServerDeafened,
      }) || Boolean(participant.isServerDeafened);
    const micModerated = Boolean(isMuted && isServerMuted);
    const micSelfMuted = Boolean(isMuted && !isServerMuted);
    const deafModerated = Boolean(isDeafened && isServerDeafened);
    const deafSelf = Boolean(isDeafened && !isServerDeafened);
    const iconSize = isSmall ? 16 : 18;
    const modColor = '#f0b232';
    const isScreenShare = participant.isScreenShare || false;
    const isAudioMuted = userMutedStates.get(participant.id) || false;
    const volume = userVolumes.get(participant.id) || 100;
    const showSlider = showVolumeSliders.get(participant.id) || false;
    
    const handleVolumeClick = (e) => {
      e.stopPropagation();
      if (onToggleUserMute) {
        onToggleUserMute(participant.id);
      }
    };

    const handleVolumeRightClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (onToggleVolumeSlider) {
        onToggleVolumeSlider(participant.id);
      }
    };

    const handleSliderChange = (e, newValue) => {
      e.stopPropagation();
      if (onChangeUserVolume) {
        onChangeUserVolume(participant.id, newValue);
      }
    };
    
    const onTileContextMenu = canMuteMembers && !participant.isCurrentUser
      ? (event) => handleParticipantContextMenu(event, participant, channelParticipant)
      : undefined;

    return (
      <div
        key={participant.id}
        className={`video-tile ${isScreenShare ? 'screen-share-tile' : ''} ${isFocused ? 'focused-tile' : ''} ${isSmall ? 'small-tile' : ''} ${isSpeaking ? 'speaking' : ''} ${isServerMuted ? 'server-muted' : ''} ${isServerDeafened ? 'server-deafened' : ''}`}
        onClick={() => handleParticipantClick(participant)}
        onContextMenu={onTileContextMenu}
      >
        <div className={`tile-content ${isScreenShare ? 'screen-share-content' : ''}`}>
          {/* Background with avatar, video, or screen share */}
          <div className="tile-background">
            {isScreenShare && participant.stream && participant.stream.active ? (
              <ScreenShareElement 
                stream={participant.stream} 
                participantId={participant.id}
              />
            ) : participant.isVideoEnabled && participant.videoStream && participant.videoStream.active ? (
              <VideoElement 
                stream={participant.videoStream}
                participantId={participant.id}
                isLocal={participant.isCurrentUser || false}
              />
            ) : participant.banner || participant.avatarColor ? (
              // Если есть баннер или цвет аватара, показываем фон
              (() => {
                const bannerIsImage = isBannerImage(participant.banner);
                const bannerColor = participant.banner && !bannerIsImage ? participant.banner : null;
                const backgroundColor = bannerColor || participant.avatarColor || getAvatarColor(participant.name);
                
                return (
                  <div style={{ 
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    backgroundColor: backgroundColor,
                    ...(bannerIsImage && participant.banner ? {
                      backgroundImage: `url(${participant.banner})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    } : {})
                  }}>
                {renderTileAvatar(participant, isSmall, { overlay: true })}
                  </div>
                );
              })()
            ) : (
              renderTileAvatar(participant, isSmall)
            )}
          </div>

          {/* Bottom overlay with name and status */}
          <div className="tile-bottom-overlay">
            <div className="bottom-info">
              {isScreenShare ? (
                <div className="screen-share-status">
                  <span className="status-indicator screen-share-indicator"></span>
                  <span className="status-text">Демонстрация экрана</span>
                </div>
              ) : (
                <>
                  {micModerated ? (
                    <div className="mic-status server-moderated" title="Микрофон отключён модератором">
                      <MicOffIcon sx={{ fontSize: iconSize, color: modColor }} />
                      <GavelIcon className="tile-mod-badge" sx={{ fontSize: isSmall ? 9 : 10 }} />
                    </div>
                  ) : micSelfMuted || isMuted ? (
                    <div className="mic-status muted" title="Микрофон выключен">
                      <MicOffIcon sx={{ fontSize: iconSize, color: '#ed4245' }} />
                    </div>
                  ) : isSpeaking ? (
                    <div className="mic-status speaking" title="Говорит">
                      <MicIcon sx={{ fontSize: iconSize, color: '#3ba55c' }} />
                    </div>
                  ) : (
                    <div className="mic-status silent" title="Микрофон включён">
                      <MicIcon sx={{ fontSize: iconSize, color: '#B5BAC1' }} />
                    </div>
                  )}
                  {deafModerated ? (
                    <div className="headset-status server-moderated" title="Звук отключён модератором">
                      <HeadsetOffIcon sx={{ fontSize: iconSize, color: modColor }} />
                      <GavelIcon className="tile-mod-badge" sx={{ fontSize: isSmall ? 9 : 10 }} />
                    </div>
                  ) : deafSelf ? (
                    <div className="headset-status muted" title="Звук выключен">
                      <HeadsetOffIcon sx={{ fontSize: iconSize, color: '#ed4245' }} />
                    </div>
                  ) : null}
                </>
              )}
              <span className="participant-name">{participant.name}</span>
            </div>
            
            {/* Volume controls — скрыты для своего тайла (мут только у других участников) */}
            {(isScreenShare || !participant.isCurrentUser) && (
            <div className="tile-volume-controls">
              {isScreenShare ? (
                <button
                  type="button"
                  className="screen-share-fullscreen-btn"
                  onClick={(e) => handleScreenShareFullscreen(participant.id, e)}
                  title={fullscreenScreenShareId === participant.id ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}
                  aria-label={fullscreenScreenShareId === participant.id ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}
                >
                  {fullscreenScreenShareId === participant.id ? (
                    <FullscreenExitIcon sx={{ fontSize: isSmall ? 18 : 20 }} />
                  ) : (
                    <FullscreenIcon sx={{ fontSize: isSmall ? 18 : 20 }} />
                  )}
                </button>
              ) : (
                <>
                  <button 
                    className={`tile-volume-btn ${
                      isAudioMuted || volume === 0
                        ? 'muted'
                        : isSpeaking
                        ? 'speaking'
                        : 'silent'
                    }`}
                    onClick={handleVolumeClick}
                    onContextMenu={handleVolumeRightClick}
                    title="ЛКМ - мут, ПКМ - слайдер"
                  >
                    {isAudioMuted || volume === 0 ? (
                      <VolumeOffIcon sx={{ fontSize: isSmall ? 14 : 16 }} />
                    ) : (
                      <VolumeUpIcon sx={{ fontSize: isSmall ? 14 : 16 }} />
                    )}
                  </button>

                  {/* Volume slider */}
                  {showSlider && (
                    <div className="volume-slider-container" onClick={(e) => e.stopPropagation()}>
                      <Slider
                        value={volume}
                        onChange={handleSliderChange}
                        orientation="vertical"
                        min={0}
                        max={100}
                        step={1}
                        size="small"
                        sx={{
                          color: '#5865f2',
                          height: '80px',
                          '& .MuiSlider-track': {
                            backgroundColor: '#5865f2',
                          },
                          '& .MuiSlider-thumb': {
                            backgroundColor: '#fff',
                            width: 12,
                            height: 12,
                            '&:hover': {
                              boxShadow: '0 0 0 8px rgba(88, 101, 242, 0.16)',
                            },
                          },
                        }}
                      />
                      <span className="volume-percentage">{volume}%</span>
                    </div>
                  )}
                </>
              )}
            </div>
            )}
          </div>
        </div>

        {/* Border for speaking/hover */}
        <div className="tile-border"></div>
      </div>
    );
  };

  // Режим фокусировки (но не принудительная сетка)
  if (isFocusedMode && !forceGridMode) {
    // console.log('Focused mode:', { 
    //   focusedParticipantId, 
    //   focusedParticipant,
    //   isScreenShare: focusedParticipant?.isScreenShare 
    // });
    
    return (
      <>
      <div className={`video-call-container focused-mode ${className}`}>
        {renderTestControls()}
        <div className="focused-view">
          <div className="focused-user-wrapper">
            {focusedParticipant && renderParticipantTile(focusedParticipant, false)}
          </div>
          
          {!hideBottomUsers && (
            <div className="bottom-users-container">
              {totalBottomPages > 1 && bottomPage > 0 && (
                <button 
                  className="pagination-arrow pagination-arrow-left" 
                  onClick={handlePrevBottomPage}
                  aria-label="Предыдущая страница"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}

              <div className="bottom-users-grid" ref={bottomGridRef}>
                {currentBottomParticipants.map((participant) => renderParticipantTile(participant, true))}
              </div>

              {totalBottomPages > 1 && bottomPage < totalBottomPages - 1 && (
                <button 
                  className="pagination-arrow pagination-arrow-right" 
                  onClick={handleNextBottomPage}
                  aria-label="Следующая страница"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {moderationMenu}
      </>
    );
  }

  // Обычный режим (сетка)
  return (
    <>
    <div className={`video-call-container ${className}`}>
      {renderTestControls()}

      <div className="video-grid-wrapper">
        {totalPages > 1 && currentPage > 0 && (
          <button 
            className="pagination-arrow pagination-arrow-left" 
            onClick={handlePrevPage}
            aria-label="Предыдущая страница"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}

        <div className="video-grid" data-user-count={currentPageParticipants.length}>
          {currentPageParticipants.map((participant) => renderParticipantTile(participant, false))}
        </div>

        {totalPages > 1 && currentPage < totalPages - 1 && (
          <button 
            className="pagination-arrow pagination-arrow-right" 
            onClick={handleNextPage}
            aria-label="Следующая страница"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination-info">
          Страница {currentPage + 1} из {totalPages}
        </div>
      )}
    </div>
    {moderationMenu}
    </>
  );
};

// Мемоизированный компонент с кастомной функцией сравнения
const MemoizedVideoCallGrid = React.memo(VideoCallGrid, (prevProps, nextProps) => {
  if (prevProps.testMode !== nextProps.testMode) {
    return false;
  }

  // Сравниваем только критически важные пропсы
  const criticalProps = [
    'participants',
    'screenShareStream', 
    'isScreenSharing',
    'remoteScreenShares',
    'enableAutoFocus',
    'userVolumes',
    'userMutedStates',
    'showVolumeSliders'
  ];
  
  for (const prop of criticalProps) {
    if (prevProps[prop] !== nextProps[prop]) {
      // Для объектов и массивов делаем глубокое сравнение
      if (prop === 'participants') {
        if (prevProps.participants.length !== nextProps.participants.length) {
          return false;
        }
        // Сравниваем только ключевые свойства участников
        for (let i = 0; i < prevProps.participants.length; i++) {
          const prev = prevProps.participants[i];
          const next = nextProps.participants[i];
          if (prev.userId !== next.userId || 
              prev.isVideoEnabled !== next.isVideoEnabled ||
              prev.isScreenSharing !== next.isScreenSharing ||
              prev.isMuted !== next.isMuted ||
              prev.isAudioEnabled !== next.isAudioEnabled ||
              prev.isGlobalAudioMuted !== next.isGlobalAudioMuted ||
              prev.isSpeaking !== next.isSpeaking ||
              prev.isServerMuted !== next.isServerMuted ||
              prev.isServerDeafened !== next.isServerDeafened) {
            return false;
          }
        }
      } else if (prop === 'remoteScreenShares' || prop === 'userVolumes' || prop === 'userMutedStates' || prop === 'showVolumeSliders') {
        // Для всех Map проверяем размер - если изменился, нужен перерендер
        if (prevProps[prop]?.size !== nextProps[prop]?.size) {
          return false;
        }
        // Если размер одинаковый, но это разные объекты Map, тоже перерендериваем
        // (т.к. содержимое могло измениться)
        if (prevProps[prop] !== nextProps[prop]) {
          return false;
        }
      } else if (prop === 'screenShareStream') {
        // Сравниваем только наличие потока, не сам объект
        const prevHasStream = !!prevProps.screenShareStream;
        const nextHasStream = !!nextProps.screenShareStream;
        if (prevHasStream !== nextHasStream) {
          return false;
        }
      } else if (prop === 'isScreenSharing') {
        // Сравниваем только булево значение
        if (prevProps.isScreenSharing !== nextProps.isScreenSharing) {
          return false;
        }
      } else {
        return false;
      }
    }
  }
  
  return true; // Пропсы не изменились, не перерендериваем
});

export default MemoizedVideoCallGrid;
