import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGlobalCall } from '../../../lib/hooks/useGlobalCall';
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
import { useCallStore } from '../../../lib/stores/callStore';
import {
  selectActiveServerDeafened,
  selectActiveServerMuted,
} from '../../../lib/voice/serverVoiceModerationState';
import { VoiceParticipantStatusIcons } from '../../atoms/VoiceParticipantStatusIcons';
import { isSameVoiceChannel } from '../../../lib/stores/callStore';
import { useCallGridTestMode } from '../../../lib/hooks/useCallGridTestMode';
import { createParticipant } from '../../../../entities/video-call/model/types';
import { userApi } from '../../../../entities/user/api/userApi';
import { MEDIA_BASE_URL } from '../../../lib/constants/apiEndpoints';
import { VideoCallGrid } from '../../atoms';
import UserAvatar from '../../atoms/UserAvatar';
import CometDial from '../../atoms/CometDial/CometDial';
import {
  useDismissibleCallBanners,
  VoiceCallChromeOverlay
} from '../VoiceCallChrome';
import styles from './ChatVoiceCall.module.css';

const PANEL_MIN_HEIGHT = 230;
const CIRCLE_PAGE_SIZE = 8;
const DM_FOCUS_CHROME_HIDE_MS = 5000;

/** Макс. высота панели = ширина × 9/16 (и в сетке, и в фокусе) */
const getPanelMaxHeightForWidth = (width) => {
  const w = Math.max(0, Number(width) || 0);
  return Math.max(PANEL_MIN_HEIGHT, (w * 9) / 16);
};

const ChatVoiceCall = ({
  chatId,
  chatName,
  userId,
  userName,
  onClose
}) => {
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [panelHeight, setPanelHeight] = useState(null);
  const [panelMaxHeight, setPanelMaxHeight] = useState(null);
  const [circlePage, setCirclePage] = useState(0);
  const [testBlockLayout, setTestBlockLayout] = useState(false);
  const [isGridFocusedMode, setIsGridFocusedMode] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const containerRef = useRef(null);
  const chromeHideTimerRef = useRef(null);
  const chromePinnedRef = useRef(false);
  const {
    testMode,
    handleAddTestParticipant,
    handleRemoveTestParticipant,
    appendTestParticipants,
  } = useCallGridTestMode();

  useEffect(() => {
    if (!testMode) {
      setTestBlockLayout(false);
    }
  }, [testMode]);

  const handleFocusedModeChange = useCallback((focused) => {
    setIsGridFocusedMode(Boolean(focused));
  }, []);

  const clearChromeHideTimer = useCallback(() => {
    if (chromeHideTimerRef.current) {
      clearTimeout(chromeHideTimerRef.current);
      chromeHideTimerRef.current = null;
    }
  }, []);

  const scheduleChromeHide = useCallback(() => {
    clearChromeHideTimer();
    if (chromePinnedRef.current) return;
    chromeHideTimerRef.current = setTimeout(() => {
      setChromeVisible(false);
    }, DM_FOCUS_CHROME_HIDE_MS);
  }, [clearChromeHideTimer]);

  const bumpChromeVisibility = useCallback(() => {
    setChromeVisible(true);
    scheduleChromeHide();
  }, [scheduleChromeHide]);

  const handleCallScreenPointerEnter = useCallback(() => {
    setChromeVisible(true);
    scheduleChromeHide();
  }, [scheduleChromeHide]);

  const handleCallScreenPointerLeave = useCallback(() => {
    chromePinnedRef.current = false;
    clearChromeHideTimer();
    setChromeVisible(false);
  }, [clearChromeHideTimer]);

  const handleChromePointerEnter = useCallback(() => {
    chromePinnedRef.current = true;
    clearChromeHideTimer();
    setChromeVisible(true);
  }, [clearChromeHideTimer]);

  const handleChromePointerLeave = useCallback(() => {
    chromePinnedRef.current = false;
    scheduleChromeHide();
  }, [scheduleChromeHide]);

  const handleResizeStart = useCallback((event) => {
    event.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const startY = event.clientY;
    const startHeight = container.getBoundingClientRect().height;
    const maxHeight = getPanelMaxHeightForWidth(container.getBoundingClientRect().width);

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
    screenShareVolumes,
    screenShareMutedStates,
    screenShareAudioUserIds,
    remoteScreenShares,
    participantSpeakingStates,
    participantMuteStates,
    isNoiseSuppressed,
    noiseSuppressionMode,
    startCall,
    endCall,
    toggleMute,
    toggleGlobalAudio,
    toggleUserMute,
    changeUserVolume,
    toggleVolumeSlider,
    toggleScreenShareMute,
    changeScreenShareVolume,
    toggleScreenShareVolumeSlider,
    toggleScreenShare,
    stopScreenShare,
    changeScreenShareSource,
    toggleScreenShareAudio,
    screenShareAudioEnabled,
    toggleVideo,
    toggleNoiseSuppression,
    changeNoiseSuppressionMode,
    spatialAudioEnabled,
    showSpatialAudioStage,
    toggleSpatialAudio,
    toggleSpatialAudioStage
  } = useGlobalCall(userId, userName);

  const participantSpeakingStatesLive = useParticipantSpeakingStates();
  const participantMuteStatesLive = useParticipantMuteStates();
  const participantGlobalAudioStatesLive = useParticipantGlobalAudioStates();
  const activeVoiceChannelParticipants = useActiveVoiceChannelParticipantList();
  const isServerMuted = useCallStore(selectActiveServerMuted);
  const isServerDeafened = useCallStore(selectActiveServerDeafened);
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
          avatar: profile.avatar || null,
          avatarColor: profile.avatarColor || '#5865f2',
          banner: toBannerValue(profile.banner),
          nameplate: profile.nameplate || null,
          avatarDecoration: profile.avatarDecoration || null,
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

  const handleDisconnect = async () => {
    await endCall();
    if (onClose) {
      onClose();
    }
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
  currentUser.avatar = currentUserProfile?.avatar ? toMediaUrl(currentUserProfile.avatar) : null;
  currentUser.avatarColor = currentUserProfile?.avatarColor || '#5865f2';
  currentUser.banner = currentUserProfile?.banner || null;
  currentUser.nameplate = currentUserProfile?.nameplate || null;
  currentUser.avatarDecoration = currentUserProfile?.avatarDecoration || null;

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
      videoParticipant.isMuted =
        participantMuteStatesLive?.get(String(pid)) ??
        participantMuteStatesLive?.get(pid) ??
        participant.isMuted ??
        false;
      videoParticipant.isGlobalAudioMuted =
        participantGlobalAudioStatesLive?.get(String(pid)) ??
        participantGlobalAudioStatesLive?.get(pid) ??
        participant.isGlobalAudioMuted ??
        false;
      videoParticipant.isAudioDisabled = participant.isAudioDisabled || participant.isDeafened || false;
      videoParticipant.isSpeaking =
        !videoParticipant.isMuted &&
        (participantSpeakingStates?.get(String(pid)) || false);
      videoParticipant.isVideoEnabled = participant.isVideoEnabled || false;
      videoParticipant.videoStream = participant.videoStream || null;
      videoParticipant.avatarColor = participant.avatarColor || '#5865f2';
      videoParticipant.banner = participant.banner || null;
      videoParticipant.nameplate = participant.nameplate || null;
      videoParticipant.avatarDecoration = participant.avatarDecoration || null;
      list.push(videoParticipant);
    });

    return appendTestParticipants(list);
  }, [
    appendTestParticipants,
    currentUser,
    participantGlobalAudioStatesLive,
    participantMuteStatesLive,
    participantSpeakingStates,
    participants,
    userId,
  ]);

  const circleTotalPages =
    displayParticipants.length <= CIRCLE_PAGE_SIZE
      ? 1
      : Math.ceil(displayParticipants.length / CIRCLE_PAGE_SIZE);

  const visibleCircleParticipants = useMemo(() => {
    if (displayParticipants.length <= CIRCLE_PAGE_SIZE) {
      return displayParticipants;
    }
    const start = circlePage * CIRCLE_PAGE_SIZE;
    return displayParticipants.slice(start, start + CIRCLE_PAGE_SIZE);
  }, [displayParticipants, circlePage]);

  useEffect(() => {
    setCirclePage((page) => Math.min(page, Math.max(0, circleTotalPages - 1)));
  }, [circleTotalPages]);

  const hasAnyScreenShare = isScreenSharing || remoteScreenShares.size > 0;
  const hasAnyVideo = isVideoEnabled || participants.some((participant) => participant.isVideoEnabled);
  // Сетка при видео/SS или в тестовом режиме «блоки»
  const shouldShowVideoGrid =
    hasAnyScreenShare || hasAnyVideo || (testMode && testBlockLayout);
  const isCircleVoiceMode = !shouldShowVideoGrid;
  // Автоскрытие дока на всём экране звонка 1-на-1
  const isDmChromeAutoHide = true;
  const isDmFocusFullscreen = shouldShowVideoGrid && isGridFocusedMode;

  useEffect(() => {
    if (!isDmChromeAutoHide) {
      chromePinnedRef.current = false;
      clearChromeHideTimer();
      setChromeVisible(true);
      return undefined;
    }
    bumpChromeVisibility();
    return () => clearChromeHideTimer();
  }, [isDmChromeAutoHide, bumpChromeVisibility, clearChromeHideTimer]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const updateMaxHeight = () => {
      const width = container.getBoundingClientRect().width;
      const maxHeight = getPanelMaxHeightForWidth(width);
      setPanelMaxHeight(maxHeight);
      setPanelHeight((prev) => (prev != null && prev > maxHeight ? maxHeight : prev));
    };

    updateMaxHeight();
    const observer = new ResizeObserver(updateMaxHeight);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  if (!isConnected) {
    return null;
  }

  const containerStyle = {
    ...(panelMaxHeight != null ? { maxHeight: `${panelMaxHeight}px` } : null),
    ...(panelHeight != null
      ? {
          height: `${panelHeight}px`,
          flex: '0 0 auto',
        }
      : null),
  };

  return (
    <div
      ref={containerRef}
      className={`chat-voice-call ${styles.voiceCallContainer}${
        isDmFocusFullscreen ? ` ${styles.dmFocusFullscreen}` : ''
      }`}
      style={containerStyle}
      onPointerEnter={isDmChromeAutoHide ? handleCallScreenPointerEnter : undefined}
      onPointerLeave={isDmChromeAutoHide ? handleCallScreenPointerLeave : undefined}
      onPointerMove={isDmChromeAutoHide ? bumpChromeVisibility : undefined}
      onPointerDown={isDmChromeAutoHide ? bumpChromeVisibility : undefined}
    >
      {testMode && (
        <div className={styles.testControls}>
          <button
            type="button"
            className={styles.testBtnAdd}
            onClick={handleAddTestParticipant}
            title="Добавить тестового участника"
          >
            + Добавить участника ({displayParticipants.length})
          </button>
          <button
            type="button"
            className={styles.testBtnRemove}
            onClick={handleRemoveTestParticipant}
            disabled={displayParticipants.length <= 1}
            title="Удалить последнего участника"
          >
            − Удалить участника
          </button>
          {!hasAnyScreenShare && !hasAnyVideo && (
            <button
              type="button"
              className={testBlockLayout ? styles.testBtnLayoutActive : styles.testBtnLayout}
              onClick={() => setTestBlockLayout((prev) => !prev)}
              title={testBlockLayout ? 'Показать кружки' : 'Показать блоки (как сетка)'}
            >
              {testBlockLayout ? '○ Кружки' : '▦ Блоки'}
            </button>
          )}
        </div>
      )}

      <div className={styles.voiceCallWrapper}>
        <div
          className={`${styles.participantsContainer} ${isCircleVoiceMode ? styles.oneToOneParticipants : ''} ${isCircleVoiceMode && displayParticipants.length > 2 ? styles.circleParticipantsWrap : ''} ${isCircleVoiceMode && circleTotalPages > 1 ? styles.hasCirclePagination : ''}`}
        >
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
                screenShareVolumes={screenShareVolumes}
                screenShareMutedStates={screenShareMutedStates}
                screenShareAudioUserIds={screenShareAudioUserIds}
                onToggleScreenShareMute={toggleScreenShareMute}
                onChangeScreenShareVolume={changeScreenShareVolume}
                onToggleScreenShareVolumeSlider={toggleScreenShareVolumeSlider}
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
                /* Discord focus в DM: только сцена, без полосы блоков снизу */
                hideBottomUsers
                gridPageSize={6}
                isVideoEnabled={isVideoEnabled}
                videoStream={cameraStream}
                enableAutoFocus={false}
                testMode={false}
                onAddTestParticipant={handleAddTestParticipant}
                onRemoveTestParticipant={handleRemoveTestParticipant}
                onFocusedModeChange={handleFocusedModeChange}
              />
            </div>
          ) : (
            <>
            {circleTotalPages > 1 && (
              <button
                type="button"
                className={`${styles.circlePaginationArrow} ${styles.circlePaginationArrowLeft}`}
                onClick={() => setCirclePage((page) => Math.max(0, page - 1))}
                disabled={circlePage <= 0}
                aria-label="Предыдущая страница"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
            <div
              className={styles.circleParticipantsGrid}
              style={{
                '--circle-cols': (() => {
                  const n = visibleCircleParticipants.length;
                  if (n <= 5) return Math.max(1, n); // одна линия
                  if (n === 6) return 3; // 3×2
                  return 4; // 7–8: 4×2, нижний ряд центрируется
                })(),
              }}
            >
            {visibleCircleParticipants.map((participant) => {
              const channelParticipant = findChannelParticipant(
                activeVoiceChannelParticipants,
                participant.id
              );
              const isMutedLive = getParticipantIsMuted(
                participantMuteStatesLive,
                participant,
                isMuted,
                channelParticipant
              );
              const participantIsDeafened = getParticipantIsDeafened(
                participantGlobalAudioStatesLive,
                participant,
                isGlobalAudioMuted,
                channelParticipant
              );
              const isSpeakingLive = getParticipantIsSpeaking(
                participantSpeakingStatesLive,
                participant.id,
                {
                  isMuted: isMutedLive,
                }
              );
              const participantIsServerMuted = getParticipantIsServerMuted(channelParticipant, {
                isCurrentUser: participant.isCurrentUser,
                localIsServerMuted: isServerMuted,
              });
              const participantIsServerDeafened = getParticipantIsServerDeafened(channelParticipant, {
                isCurrentUser: participant.isCurrentUser,
                localIsServerDeafened: isServerDeafened,
              });
              const canAdjustVolume = !participant.isCurrentUser;
              const showVolumeDial =
                canAdjustVolume && Boolean(showVolumeSliders?.get?.(participant.id));
              const volume = userVolumes?.get?.(participant.id) ?? 100;
              const avatar = (
                <UserAvatar
                  username={participant.name || 'U'}
                  avatarUrl={participant.avatar}
                  avatarColor={participant.avatarColor}
                  avatarDecoration={participant.avatarDecoration}
                  size={72}
                />
              );
              const handleAvatarContextMenu = (event) => {
                if (!canAdjustVolume) return;
                event.preventDefault();
                event.stopPropagation();
                toggleVolumeSlider?.(participant.id);
              };
              return (
                <div
                  key={participant.id}
                  className={`${styles.participantItem} ${participant.isCurrentUser ? styles.currentUserParticipant : ''} ${
                    isSpeakingLive ? styles.participantSpeaking : ''
                  }${showVolumeDial ? ` ${styles.volumeDialOpen}` : ''}`}
                >
                  <div
                    className={styles.participantAvatarContainer}
                    onContextMenu={handleAvatarContextMenu}
                    title={canAdjustVolume ? 'ПКМ — громкость' : undefined}
                  >
                    {showVolumeDial ? (
                      <CometDial
                        className={styles.participantCometDial}
                        value={volume}
                        min={0}
                        max={100}
                        step={1}
                        unit="%"
                        label={`Громкость ${participant.name || ''}`}
                        accent="#ffffff"
                        ink="rgba(255, 255, 255, 0.32)"
                        size={148}
                        sweep={289}
                        thickness={7}
                        speed={8}
                        deadZone={42}
                        passthroughCenter
                        onChange={(next) => changeUserVolume?.(participant.id, next)}
                        onContextMenu={handleAvatarContextMenu}
                      >
                        <div className={styles.participantVolumeCenter}>
                          <UserAvatar
                            username={participant.name || 'U'}
                            avatarUrl={participant.avatar}
                            avatarColor={participant.avatarColor}
                            avatarDecoration={participant.avatarDecoration}
                            size={72}
                          />
                          <span className={styles.participantVolumeValue} aria-hidden="true">
                            {volume}%
                          </span>
                        </div>
                      </CometDial>
                    ) : (
                      avatar
                    )}
                  </div>
                  <span className={styles.participantName}>{participant.name || 'Unknown'}</span>
                  <div className={styles.participantStatusRow}>
                    <VoiceParticipantStatusIcons
                      isMuted={isMutedLive}
                      isDeafened={participantIsDeafened}
                      isServerMuted={participantIsServerMuted}
                      isServerDeafened={participantIsServerDeafened}
                      isSpeaking={isSpeakingLive}
                      variant="pills"
                    />
                  </div>
                </div>
              );
            })}
            </div>
            {circleTotalPages > 1 && (
              <button
                type="button"
                className={`${styles.circlePaginationArrow} ${styles.circlePaginationArrowRight}`}
                onClick={() => setCirclePage((page) => Math.min(circleTotalPages - 1, page + 1))}
                disabled={circlePage >= circleTotalPages - 1}
                aria-label="Следующая страница"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
            </>
          )}
        </div>
      </div>

      <VoiceCallChromeOverlay
        showHeader={false}
        compactBanners
        error={error}
        showErrorBanner={showErrorBanner}
        showAudioBlockedBanner={showAudioBlockedBanner}
        onDismissError={() => setDismissedError(true)}
        onDismissAudioBlocked={() => setDismissedAudioBlocked(true)}
        chromeVisible={!isDmChromeAutoHide || chromeVisible}
        onChromePointerEnter={isDmChromeAutoHide ? handleChromePointerEnter : undefined}
        onChromePointerLeave={isDmChromeAutoHide ? handleChromePointerLeave : undefined}
        controlProps={{
          isMuted,
          onToggleMute: toggleMute,
          isGlobalAudioMuted,
          onToggleGlobalAudio: toggleGlobalAudio,
          isServerMuted,
          isServerDeafened,
          isNoiseSuppressed,
          noiseSuppressionMode,
          onToggleNoiseSuppression: toggleNoiseSuppression,
          onNoiseSuppressionModeSelect: changeNoiseSuppressionMode,
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
