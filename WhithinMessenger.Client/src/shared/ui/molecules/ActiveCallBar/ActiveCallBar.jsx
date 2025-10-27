import React, { useState, useMemo } from 'react';
import { useGlobalCall } from '../../../lib/hooks/useGlobalCall';
import { VideoCallGrid } from '../../atoms/VideoCallGrid';
import { createParticipant } from '../../../../entities/video-call/model/types';
import { Menu, MenuItem } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import NoiseAwareIcon from '@mui/icons-material/NoiseAware';
import NoiseControlOffIcon from '@mui/icons-material/NoiseControlOff';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import './ActiveCallBar.css';

const ActiveCallBar = () => {
  const {
    isCallActive,
    participants,
    isMuted,
    isGlobalAudioMuted,
    isNoiseSuppressed,
    noiseSuppressionMode,
    userVolumes,
    userMutedStates,
    showVolumeSliders,
    error,
    audioBlocked,
    toggleMute,
    toggleGlobalAudio,
    toggleNoiseSuppression,
    changeNoiseSuppressionMode,
    toggleUserMute,
    changeUserVolume,
    toggleVolumeSlider,
    endCall,
    clearError,
    setAudioBlocked
  } = useGlobalCall();

  const [isExpanded, setIsExpanded] = useState(false);
  const [noiseSuppressMenuAnchor, setNoiseSuppressMenuAnchor] = useState(null);

  // Не показываем компонент, если звонок не активен
  if (!isCallActive) {
    return null;
  }

  // Преобразуем участников голосового звонка в формат для видеосетки
  const videoParticipants = useMemo(() => {
    return participants.map(participant => {
      const videoParticipant = createParticipant(
        participant.userId || participant.id || participant.name, 
        participant.name, 
        participant.avatar || null, 
        'online', 
        'participant'
      );
      videoParticipant.isMuted = participant.isMuted || false;
      videoParticipant.isAudioEnabled = participant.isAudioEnabled !== undefined ? participant.isAudioEnabled : true;
      videoParticipant.isSpeaking = participant.isSpeaking || false;
      return videoParticipant;
    });
  }, [participants, userVolumes, userMutedStates, showVolumeSliders]);

  const enableAudioPlayback = async () => {
    const audioElements = document.querySelectorAll('audio');
    for (const audio of audioElements) {
      try {
        await audio.play();
      } catch (e) {
        console.log('Failed to play audio:', e);
      }
    }
    setAudioBlocked(false);
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
    <div className="active-call-bar">
      {/* Основная панель звонка */}
      <div className="call-bar-main">
        <div className="call-info">
          <div className="call-status">
            <div className="call-indicator"></div>
            <span>В звонке ({participants.length + 1} участников)</span>
          </div>
        </div>

        <div className="call-controls">
          {/* Микрофон */}
          <button 
            className={`control-button ${isMuted ? 'muted' : ''}`}
            onClick={toggleMute}
            title={isMuted ? 'Включить микрофон' : 'Заглушить микрофон'}
          >
            {isMuted ? <MicOffIcon /> : <MicIcon />}
          </button>

          {/* Глобальное аудио */}
          <button 
            className={`control-button ${isGlobalAudioMuted ? 'muted' : ''}`}
            onClick={toggleGlobalAudio}
            title={isGlobalAudioMuted ? 'Включить звук всех' : 'Выключить звук всех'}
          >
            {isGlobalAudioMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
          </button>

          {/* Шумоподавление */}
          <div className="noise-suppression-container">
            <button 
              className={`control-button ${isNoiseSuppressed ? '' : 'muted'}`}
              onClick={handleToggleNoiseSuppression}
              title={isNoiseSuppressed ? `Шумоподавление включено: ${noiseSuppressionMode}` : 'Шумоподавление выключено'}
            >
              {isNoiseSuppressed ? <NoiseAwareIcon /> : <NoiseControlOffIcon />}
            </button>
            <button 
              className="control-button dropdown"
              onClick={(e) => setNoiseSuppressMenuAnchor(e.currentTarget)}
              title="Выбрать режим шумоподавления"
            >
              <KeyboardArrowDownIcon />
            </button>
          </div>

          {/* Развернуть/свернуть */}
          <button 
            className="control-button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Свернуть' : 'Развернуть'}
          >
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </button>

          {/* Завершить звонок */}
          <button 
            className="control-button disconnect"
            onClick={endCall}
            title="Завершить звонок"
          >
            <CallEndIcon />
          </button>
        </div>
      </div>

      {/* Развернутая панель с участниками */}
      {isExpanded && (
        <div className="call-bar-expanded">
          {/* Ошибки */}
          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <button onClick={clearError}>×</button>
            </div>
          )}

          {/* Блокировка аудио */}
          {audioBlocked && (
            <div className="audio-blocked-banner">
              <div className="audio-blocked-text">
                <strong>Браузер заблокировал автовоспроизведение</strong>
                <span>Нажмите кнопку ниже, чтобы разрешить воспроизведение звука</span>
                <button className="enable-audio-btn" onClick={enableAudioPlayback}>
                  Разрешить воспроизведение
                </button>
              </div>
            </div>
          )}

          {/* Сетка участников */}
          {videoParticipants.length > 0 && (
            <div className="participants-grid">
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
              />
            </div>
          )}
        </div>
      )}

      {/* Меню шумоподавления */}
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

export default ActiveCallBar;
