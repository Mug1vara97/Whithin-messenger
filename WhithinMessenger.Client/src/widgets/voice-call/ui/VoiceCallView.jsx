import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { People } from '@mui/icons-material';
import { useGlobalCall } from '../../../shared/lib/hooks/useGlobalCall';
import { useCallStore } from '../../../shared/lib/stores/callStore';
import {
  selectActiveServerDeafened,
  selectActiveServerMuted,
} from '../../../shared/lib/voice/serverVoiceModerationState';
import { isSameVoiceChannel } from '../../../shared/lib/stores/callStore';
import { useCallGridTestMode } from '../../../shared/lib/hooks/useCallGridTestMode';
import { VideoCallGrid } from '../../../shared/ui/atoms';
import { createParticipant } from '../../../entities/video-call/model/types';
import { userApi } from '../../../entities/user/api/userApi';
import { MEDIA_BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import {
  useDismissibleCallBanners,
  VoiceCallChromeOverlay
} from '../../../shared/ui/molecules/VoiceCallChrome';
import { MemberListSidebar } from '../../../shared/ui/molecules/MemberListSidebar';
import { ResizableSidebarShell } from '../../../shared/ui/molecules/ResizableSidebarShell';
import { memberListPanelWidthStorage } from '../../../shared/lib/utils/memberListPanelWidthStorage';
import { useMembers } from '../../../entities/member/hooks';
import { useRoles } from '../../../entities/role/hooks';
import { usePresenceOverrides } from '../../../shared/lib/hooks/usePresenceOverrides';
import { useServerHubConnection } from '../../../shared/lib/hooks/useServerHubConnection';
import { mapServerMemberToListItem } from '../../../shared/lib/utils/memberListUtils';
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
  onClose,
  serverId = null,
  serverOwnerId = null,
  canMuteMembers = false,
}) => {
  const [showMemberList, setShowMemberList] = useState(true);
  const showMembersSidebar = Boolean(serverId && showMemberList);

  const serverConnection = useServerHubConnection(serverId);
  const { members: serverMembers, isLoading: serverMembersLoading } = useMembers(
    serverConnection,
    serverId,
    userId,
  );
  const { roles: serverRoles } = useRoles(serverConnection, serverId, userId);
  const { resolveStatus } = usePresenceOverrides();

  const sidebarMembers = useMemo(() => {
    if (!serverId) return [];
    return (serverMembers || []).map((member) =>
      mapServerMemberToListItem(member, { serverOwnerId, resolveStatus, serverRoles }),
    );
  }, [serverId, serverMembers, serverOwnerId, resolveStatus, serverRoles]);

  const handleMemberListToggle = useCallback(() => {
    setShowMemberList((open) => !open);
  }, []);
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
    isInCall,
    currentRoomId,
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
    participantSpeakingStates,
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
    stopScreenShare,
    changeScreenShareSource,
    toggleScreenShareAudio,
    screenShareAudioEnabled,
    toggleVideo,
    spatialAudioEnabled,
    showSpatialAudioStage,
    toggleSpatialAudio,
    toggleSpatialAudioStage
  } = useGlobalCall(userId, userName);

  const isServerMuted = useCallStore((state) => selectActiveServerMuted(state, serverId));
  const isServerDeafened = useCallStore((state) => selectActiveServerDeafened(state, serverId));
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const {
    showErrorBanner,
    showAudioBlockedBanner,
    setDismissedError,
    setDismissedAudioBlocked
  } = useDismissibleCallBanners(error, audioBlocked);
  
  const {
    testMode,
    testParticipants,
    handleAddTestParticipant,
    handleRemoveTestParticipant,
    appendTestParticipants,
  } = useCallGridTestMode();

  // Логирование состояния демонстрации экрана
  // console.log('VoiceCallView screen share state:', { 
  //   isScreenSharing, 
  //   hasScreenShareStream: !!screenShareStream, 
  //   remoteScreenSharesSize: remoteScreenShares.size 
  // });

  useEffect(() => {
    if (!channelId || !userId || !userName) return;

    const alreadyInThisChannel =
      isInCall &&
      (isSameVoiceChannel(currentRoomId, channelId) ||
        isSameVoiceChannel(currentCall?.channelId, channelId));

    if (!alreadyInThisChannel && isInCall) {
      startCall(channelId, channelName, serverId).catch((err) => {
        console.error('Call start error:', err);
      });
      return;
    }

    if (alreadyInThisChannel) {
      useCallStore.getState().refreshVoiceChannelParticipantsList(channelId);
      return;
    }

    if (!isInCall) {
      startCall(channelId, channelName, serverId).catch((err) => {
        console.error('Call start error:', err);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, channelName, userId, userName]);

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
              banner: bannerValue,
              avatarDecoration: profile.avatarDecoration || null,
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
      participantVideoStatesSize: participantVideoStates?.size,
      participantSpeakingStatesSize: participantSpeakingStates?.size
    });
    
    // Текущий пользователь (хост)
    const selfParticipant = participants.find(
      (participant) => String(participant.userId || participant.id) === String(userId),
    );
    const resolvedSelfProfile = currentUserProfile || (selfParticipant ? {
      avatar: selfParticipant.avatar || null,
      avatarColor: selfParticipant.avatarColor || '#5865f2',
      banner: selfParticipant.banner || null,
      avatarDecoration: selfParticipant.avatarDecoration || null,
    } : null);

    const currentUser = createParticipant(userId, userName, resolvedSelfProfile?.avatar || null, 'online', 'host');
    currentUser.isMuted = isMuted;
    currentUser.isAudioEnabled = isAudioEnabled !== undefined ? isAudioEnabled : true; // Исправляем undefined
    currentUser.isGlobalAudioMuted = isGlobalAudioMuted; // Добавляем статус глобального звука
    // Используем Voice Activity Detection для определения говорения (если микрофон не замьючен)
    currentUser.isSpeaking =
      !isMuted && (participantSpeakingStates?.get(String(userId)) || false);
    currentUser.isVideoEnabled = isVideoEnabled; // Добавляем состояние веб-камеры
    currentUser.videoStream = cameraStream; // Добавляем видео поток
    currentUser.isCurrentUser = true; // Помечаем как текущего пользователя
    currentUser.avatarColor = resolvedSelfProfile?.avatarColor || '#5865f2';
    currentUser.banner = resolvedSelfProfile?.banner || null;
    currentUser.avatarDecoration = resolvedSelfProfile?.avatarDecoration || null;
    
    console.log('🧑 Current user state:', {
      isMuted: currentUser.isMuted,
      isAudioEnabled: currentUser.isAudioEnabled,
      isGlobalAudioMuted: currentUser.isGlobalAudioMuted,
      isSpeaking: currentUser.isSpeaking
    });
    
    const videoParticipantsList = [currentUser];
    
    // Добавляем всех остальных участников
    // Используем отдельные Maps для реактивности в реальном времени
    participants.forEach(participant => {
      const participantUserId = participant.userId || participant.id || participant.name;
      if (String(participantUserId) === String(userId)) {
        return;
      }

      const videoParticipant = createParticipant(
        participantUserId, 
        participant.name, 
        participant.avatar || null, 
        'online', 
        'participant'
      );
      
      // Читаем состояния из отдельных Maps для реактивности в реальном времени
      videoParticipant.isMuted =
        participantMuteStates?.get(String(participantUserId)) ?? participant.isMuted ?? false;
      videoParticipant.isAudioEnabled = participantAudioStates?.get(participantUserId) ?? participant.isAudioEnabled ?? true;
      videoParticipant.isGlobalAudioMuted = participantGlobalAudioStates?.get(participantUserId) ?? participant.isGlobalAudioMuted ?? false;
      // Используем Voice Activity Detection для определения говорения (если микрофон не замьючен)
      const participantIsMuted =
        participantMuteStates?.get(String(participantUserId)) ?? participant.isMuted ?? false;
      videoParticipant.isSpeaking =
        !participantIsMuted &&
        (participantSpeakingStates?.get(String(participantUserId)) || false);
      videoParticipant.isVideoEnabled = participantVideoStates?.get(participantUserId) ?? participant.isVideoEnabled ?? false;
      videoParticipant.videoStream = participant.videoStream; // Добавляем видео поток
      // Добавляем данные профиля
      videoParticipant.avatarColor = participant.avatarColor || '#5865f2';
      videoParticipant.banner = participant.banner || null;
      videoParticipant.avatarDecoration = participant.avatarDecoration || null;
      videoParticipantsList.push(videoParticipant);
    });
    
    console.log('Video participants updated:', videoParticipantsList);
    return appendTestParticipants(videoParticipantsList);
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
    participantSpeakingStates,
    appendTestParticipants,
    currentUserProfile,
  ]);


  const handleClose = () => {
    // НЕ завершаем звонок, только скрываем интерфейс
    // Звонок продолжает работать в фоне
    console.log('VoiceCallView: Interface closed, but call continues in background');
    if (onClose) {
      onClose();
    }
  };

  const handleNoiseSuppressionModeSelect = async (mode) => {
    await changeNoiseSuppressionMode(mode);
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
    <div className="voice-call-shell">
      <header className="chat-header">
        <div className="header-left">
          <h2 className="username">{currentCall?.channelName || channelName}</h2>
        </div>
        {serverId && (
          <div className="header-actions">
            <button
              type="button"
              className={`member-list-toggle ${showMembersSidebar ? 'active' : ''}`}
              onClick={handleMemberListToggle}
              title={showMembersSidebar ? 'Скрыть список участников' : 'Показать список участников'}
              aria-pressed={showMembersSidebar}
            >
              <People style={{ fontSize: '20px' }} />
            </button>
          </div>
        )}
      </header>

      <div className="voice-call-body">
        <div className="voice-call-container">
          <div className="call-container">
        <div className="root-idle">
          <div className="video-grid-wrapper">
            {/* Scroller */}
            <div className="scroller">
              <div className="list-items">
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
                      testMode={testMode}
                      onAddTestParticipant={handleAddTestParticipant}
                      onRemoveTestParticipant={handleRemoveTestParticipant}
                      canMuteMembers={canMuteMembers}
                      voiceChannelId={channelId}
                      serverId={serverId}
                      currentUserId={userId}
                    />
                  </div>
                )}

              </div>
            </div>

            <VoiceCallChromeOverlay
              showHeader={false}
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
                isServerMuted,
                isServerDeafened,
                isNoiseSuppressed,
                noiseSuppressionMode,
                onToggleNoiseSuppression: handleToggleNoiseSuppression,
                onNoiseSuppressionModeSelect: handleNoiseSuppressionModeSelect,
                isVideoEnabled,
                onToggleVideo: toggleVideo,
                isScreenSharing,
                onToggleScreenShare: toggleScreenShare,
                onStopScreenShare: stopScreenShare,
                onChangeScreenShareSource: changeScreenShareSource,
                screenShareAudioEnabled,
                onToggleScreenShareAudio: toggleScreenShareAudio,
                spatialAudioEnabled,
                showSpatialAudioStage,
                onToggleSpatialAudioStage: () => toggleSpatialAudioStage(),
                onToggleSpatialAudio: () => toggleSpatialAudio(),
                spatialAudioUserId: userId,
                spatialAudioUserProfile: {
                  name: userName,
                  avatar: currentUserProfile?.avatar || null,
                  avatarColor: currentUserProfile?.avatarColor || '#5865f2',
                },
                onDisconnect: async () => {
                  await endCall();
                  handleClose();
                }
              }}
            />
          </div>
        </div>
      </div>
        </div>

        {showMembersSidebar && (
          <ResizableSidebarShell
            widthStorage={memberListPanelWidthStorage}
            handleEdge="left"
          >
            <MemberListSidebar
              members={sidebarMembers}
              isLoading={serverMembersLoading}
              emptyLabel="Участники сервера не найдены"
              groupByRoles
              serverRoles={serverRoles}
            />
          </ResizableSidebarShell>
        )}
      </div>
    </div>
  );
};

export default VoiceCallView;