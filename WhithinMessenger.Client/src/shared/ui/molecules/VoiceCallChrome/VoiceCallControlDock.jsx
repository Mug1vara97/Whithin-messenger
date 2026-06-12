import React, { useState } from 'react';
import { Menu, MenuItem } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VideocamIcon from '@mui/icons-material/Videocam';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import CallEndIcon from '@mui/icons-material/CallEnd';
import HeadsetIcon from '@mui/icons-material/Headset';
import HeadsetOffIcon from '@mui/icons-material/HeadsetOff';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import NoiseAwareIcon from '@mui/icons-material/NoiseAware';
import NoiseControlOffIcon from '@mui/icons-material/NoiseControlOff';
import SurroundSoundIcon from '@mui/icons-material/SurroundSound';
import { SpatialAudioStage } from '../SpatialAudioStage';
import './voiceCallChrome.css';

const noiseMenuPaperSx = {
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
      backgroundColor: '#2e3035'
    },
    '&.Mui-selected': {
      backgroundColor: '#5865f2',
      '&:hover': {
        backgroundColor: '#4752c4'
      }
    }
  }
};

export function VoiceCallControlDock({
  isMuted,
  onToggleMute,
  isGlobalAudioMuted,
  onToggleGlobalAudio,
  isServerMuted = false,
  isServerDeafened = false,
  isNoiseSuppressed,
  noiseSuppressionMode,
  onToggleNoiseSuppression,
  onNoiseSuppressionModeSelect,
  isVideoEnabled,
  onToggleVideo,
  isScreenSharing,
  onToggleScreenShare,
  spatialAudioEnabled,
  showSpatialAudioStage,
  onToggleSpatialAudioStage,
  onToggleSpatialAudio,
  spatialAudioUserId,
  spatialAudioUserProfile,
  onDisconnect
}) {
  const [noiseSuppressMenuAnchor, setNoiseSuppressMenuAnchor] = useState(null);

  const closeNoiseMenu = () => setNoiseSuppressMenuAnchor(null);

  const handleNoiseModeSelect = async (mode) => {
    if (onNoiseSuppressionModeSelect) {
      await onNoiseSuppressionModeSelect(mode);
    }
    closeNoiseMenu();
  };

  return (
    <>
      <div className="bottom-controls">
        <div className="call-control-dock">
          <div className="button-section">
            <div className="attached-button-container">
              <button
                className={`center-button ${isServerMuted && isMuted ? 'server-moderated' : ''} ${isMuted && !isServerMuted ? 'muted' : ''}`}
                type="button"
                aria-label={isMuted ? 'Включить микрофон' : 'Заглушить'}
                title={
                  isServerMuted && isMuted
                    ? 'Микрофон отключён модератором'
                    : isMuted
                      ? 'Включить микрофон'
                      : 'Выключить микрофон'
                }
                disabled={isServerMuted && isMuted}
                onClick={onToggleMute}
              >
                {isMuted ? <MicOffIcon sx={{ fontSize: 24 }} /> : <MicIcon sx={{ fontSize: 24 }} />}
              </button>
            </div>

            <div className="attached-button-container">
              <button
                className={`center-button ${isServerDeafened && isGlobalAudioMuted ? 'server-moderated' : ''} ${isGlobalAudioMuted && !isServerDeafened ? 'muted' : ''}`}
                type="button"
                onClick={onToggleGlobalAudio}
                aria-label={isGlobalAudioMuted ? 'Включить звук всех' : 'Выключить звук всех'}
                title={
                  isServerDeafened && isGlobalAudioMuted
                    ? 'Звук отключён модератором'
                    : isGlobalAudioMuted
                      ? 'Звук всех участников выключен'
                      : 'Звук всех участников включен'
                }
                disabled={isServerDeafened && isGlobalAudioMuted}
              >
                {isGlobalAudioMuted ? (
                  <HeadsetOffIcon sx={{ fontSize: 24 }} />
                ) : (
                  <HeadsetIcon sx={{ fontSize: 24 }} />
                )}
              </button>
            </div>

            {onToggleNoiseSuppression && (
              <div className="attached-caret-button-container">
                <button
                  className={`center-button attached-button ${isNoiseSuppressed ? '' : 'muted'}`}
                  type="button"
                  onClick={onToggleNoiseSuppression}
                  aria-label={
                    isNoiseSuppressed
                      ? `Выключить шумоподавление (${noiseSuppressionMode})`
                      : 'Включить шумоподавление'
                  }
                  title={
                    isNoiseSuppressed
                      ? `Шумоподавление включено: ${
                          noiseSuppressionMode === 'rnnoise'
                            ? 'RNNoise (AI)'
                            : noiseSuppressionMode === 'speex'
                              ? 'Speex'
                              : 'Noise Gate'
                        }`
                      : 'Шумоподавление выключено'
                  }
                >
                  {isNoiseSuppressed ? (
                    <NoiseAwareIcon sx={{ fontSize: 24 }} />
                  ) : (
                    <NoiseControlOffIcon sx={{ fontSize: 24 }} />
                  )}
                </button>
                {onNoiseSuppressionModeSelect && (
                  <div
                    className={`context-menu-caret ${isNoiseSuppressed ? '' : 'muted'}`}
                    onClick={(e) => setNoiseSuppressMenuAnchor(e.currentTarget)}
                    title="Выбрать режим шумоподавления"
                    style={{ cursor: 'pointer' }}
                  >
                    <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="dock-divider" aria-hidden />

          <div className="button-section">
            <div className="attached-button-container">
              <button
                className={`center-button ${isVideoEnabled ? 'active' : ''}`}
                type="button"
                aria-label={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
                onClick={onToggleVideo}
              >
                <VideocamIcon sx={{ fontSize: 24 }} />
              </button>
            </div>

            <div className="attached-button-container control-button">
              <button
                className={`center-button ${isScreenSharing ? 'active' : ''}`}
                type="button"
                aria-label="Продемонстрируйте свой экран"
                onClick={onToggleScreenShare}
              >
                <ScreenShareIcon sx={{ fontSize: 24 }} />
              </button>
            </div>

            {onToggleSpatialAudioStage && (
              <div className="attached-button-container control-button spatial-audio-anchor">
                {showSpatialAudioStage && spatialAudioUserId && (
                  <SpatialAudioStage
                    currentUserId={spatialAudioUserId}
                    currentUserProfile={spatialAudioUserProfile}
                    anchored
                  />
                )}
                <button
                  className={`center-button ${showSpatialAudioStage || spatialAudioEnabled ? 'active' : ''}`}
                  type="button"
                  aria-label="Пространственный звук"
                  title={
                    spatialAudioEnabled
                      ? 'ЛКМ — карта 3D-звука, ПКМ — выключить 3D'
                      : 'ЛКМ — карта 3D-звука, ПКМ — включить 3D'
                  }
                  onClick={onToggleSpatialAudioStage}
                  onContextMenu={(event) => {
                    if (!onToggleSpatialAudio) return;
                    event.preventDefault();
                    onToggleSpatialAudio();
                  }}
                >
                  <SurroundSoundIcon sx={{ fontSize: 24 }} />
                </button>
              </div>
            )}
          </div>

          <div className="dock-divider" aria-hidden />

          <button
            className="center-button disconnect"
            type="button"
            aria-label="Завершить звонок"
            onClick={onDisconnect}
          >
            <CallEndIcon sx={{ fontSize: 24 }} />
          </button>
        </div>
      </div>

      {onNoiseSuppressionModeSelect && (
        <Menu
          anchorEl={noiseSuppressMenuAnchor}
          open={Boolean(noiseSuppressMenuAnchor)}
          onClose={closeNoiseMenu}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          PaperProps={{ sx: noiseMenuPaperSx }}
        >
          <MenuItem
            onClick={() => handleNoiseModeSelect('rnnoise')}
            selected={noiseSuppressionMode === 'rnnoise'}
          >
            <div style={{ fontWeight: 600 }}>RNNoise</div>
            <div style={{ fontSize: '12px', color: '#b5bac1', marginTop: '2px' }}>
              AI-алгоритм, лучшее качество
            </div>
          </MenuItem>
          <MenuItem
            onClick={() => handleNoiseModeSelect('speex')}
            selected={noiseSuppressionMode === 'speex'}
          >
            <div style={{ fontWeight: 600 }}>Speex</div>
            <div style={{ fontSize: '12px', color: '#b5bac1', marginTop: '2px' }}>
              Классический алгоритм
            </div>
          </MenuItem>
          <MenuItem
            onClick={() => handleNoiseModeSelect('noisegate')}
            selected={noiseSuppressionMode === 'noisegate'}
          >
            <div style={{ fontWeight: 600 }}>Noise Gate</div>
            <div style={{ fontSize: '12px', color: '#b5bac1', marginTop: '2px' }}>
              Простое подавление тишины
            </div>
          </MenuItem>
        </Menu>
      )}
    </>
  );
}
