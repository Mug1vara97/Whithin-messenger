import React from 'react';
import { 
  Mic, 
  MicOff, 
  VolumeUp, 
  VolumeOff, 
  Videocam, 
  VideocamOff,
  Phone,
  ExpandMore
} from '@mui/icons-material';
import useVoiceCallStore from '../../../shared/lib/stores/voiceCallStore';
import { useVoiceCall } from '../../../entities/voice-call/hooks';
import './MinimizedCallWidget.css';

const MinimizedCallWidget = ({ userId, userName }) => {
  const {
    isInCall,
    isCallMinimized,
    participants,
    restoreCall,
    leaveCall
  } = useVoiceCallStore();

  // Используем реальный голосовой API для управления
  const {
    isMuted,
    isGlobalAudioMuted,
    isVideoEnabled,
    toggleMute,
    toggleGlobalAudio,
    toggleVideo,
    disconnect
  } = useVoiceCall(userId, userName);

  if (!isInCall || !isCallMinimized) {
    return null;
  }

  const participantCount = participants.length;

  return (
    <div className="minimized-call-widget">
      <div className="minimized-call-info" onClick={restoreCall}>
        <div className="call-status">
          <div className="call-icon">
            <Phone />
          </div>
          <div className="call-details">
            <span className="call-title">Голосовой канал</span>
            <span className="participant-count">
              {participantCount} участник{participantCount !== 1 ? 'ов' : ''}
            </span>
          </div>
        </div>
        <ExpandMore className="expand-icon" />
      </div>
      
      <div className="minimized-call-controls">
        <button 
          className={`control-btn ${isMuted ? 'muted' : ''}`}
          onClick={toggleMute}
          title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
        >
          {isMuted ? <MicOff /> : <Mic />}
        </button>
        
        <button 
          className={`control-btn ${isGlobalAudioMuted ? 'muted' : ''}`}
          onClick={toggleGlobalAudio}
          title={isGlobalAudioMuted ? 'Включить звук' : 'Выключить звук'}
        >
          {isGlobalAudioMuted ? <VolumeOff /> : <VolumeUp />}
        </button>
        
        <button 
          className={`control-btn ${!isVideoEnabled ? 'muted' : ''}`}
          onClick={toggleVideo}
          title={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
        >
          {isVideoEnabled ? <Videocam /> : <VideocamOff />}
        </button>
        
        <button 
          className="control-btn leave-btn"
          onClick={() => {
            disconnect();
            leaveCall();
          }}
          title="Покинуть звонок"
        >
          <Phone />
        </button>
      </div>
    </div>
  );
};

export default MinimizedCallWidget;
