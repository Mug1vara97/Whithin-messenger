import React from 'react';
import MicOffIcon from '@mui/icons-material/MicOff';
import MicIcon from '@mui/icons-material/Mic';
import HeadsetOffIcon from '@mui/icons-material/HeadsetOff';
import GavelIcon from '@mui/icons-material/Gavel';
import './VoiceParticipantStatusIcons.css';

const MOD_COLOR = '#f0b232';
const SELF_MUTE_COLOR = '#ed4245';
const SPEAKING_COLOR = '#3ba55c';
const IDLE_COLOR = '#b5bac1';

export function VoiceParticipantStatusIcons({
  isMuted = false,
  isDeafened = false,
  isServerMuted = false,
  isServerDeafened = false,
  isSpeaking = false,
  variant = 'inline',
  className = '',
}) {
  const iconSize = variant === 'tile' ? 18 : 14;
  const micModerated = Boolean(isMuted && isServerMuted);
  const micSelf = Boolean(isMuted && !isServerMuted);
  const deafModerated = Boolean(isDeafened && isServerDeafened);
  const deafSelf = Boolean(isDeafened && !isServerDeafened);

  return (
    <div className={`voice-participant-status-icons-root ${variant} ${className}`.trim()}>
      {micModerated && (
        <span
          className="voice-status-icon server-moderated"
          title="Микрофон отключён модератором"
        >
          <MicOffIcon sx={{ fontSize: iconSize, color: MOD_COLOR }} />
          <GavelIcon className="voice-status-mod-badge" sx={{ fontSize: variant === 'tile' ? 10 : 9 }} />
        </span>
      )}
      {micSelf && (
        <span className="voice-status-icon self-muted" title="Микрофон выключен">
          <MicOffIcon sx={{ fontSize: iconSize, color: SELF_MUTE_COLOR }} />
        </span>
      )}
      {!isMuted && isSpeaking && (
        <span className="voice-status-icon speaking" title="Говорит">
          <MicIcon sx={{ fontSize: iconSize, color: SPEAKING_COLOR }} />
        </span>
      )}
      {!isMuted && !isSpeaking && variant === 'tile' && (
        <span className="voice-status-icon idle" title="Микрофон включён">
          <MicIcon sx={{ fontSize: iconSize, color: IDLE_COLOR }} />
        </span>
      )}
      {deafModerated && (
        <span
          className="voice-status-icon server-moderated"
          title="Звук отключён модератором"
        >
          <HeadsetOffIcon sx={{ fontSize: iconSize, color: MOD_COLOR }} />
          <GavelIcon className="voice-status-mod-badge" sx={{ fontSize: variant === 'tile' ? 10 : 9 }} />
        </span>
      )}
      {deafSelf && (
        <span className="voice-status-icon self-muted" title="Звук выключен">
          <HeadsetOffIcon sx={{ fontSize: iconSize, color: SELF_MUTE_COLOR }} />
        </span>
      )}
    </div>
  );
}
