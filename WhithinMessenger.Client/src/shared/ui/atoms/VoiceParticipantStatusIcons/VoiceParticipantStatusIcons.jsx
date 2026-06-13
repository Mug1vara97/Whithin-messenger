import React from 'react';

import MicOffIcon from '@mui/icons-material/MicOff';

import MicIcon from '@mui/icons-material/Mic';

import HeadsetOffIcon from '@mui/icons-material/HeadsetOff';

import HeadsetIcon from '@mui/icons-material/Headset';

import GavelIcon from '@mui/icons-material/Gavel';

import './VoiceParticipantStatusIcons.css';



const MOD_COLOR = '#f0b232';

const SELF_MUTE_COLOR = '#ed4245';

const IDLE_COLOR = '#b5bac1';



function InlineStatusPill({ className = '', title, children }) {

  return (

    <span className={`voice-status-icon inline-pill ${className}`.trim()} title={title}>

      {children}

    </span>

  );

}



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



  if (variant === 'pills') {

    return (

      <div className={`voice-participant-status-icons-root pills ${className}`.trim()}>

        {micModerated ? (

          <InlineStatusPill className="off moderated" title="Микрофон отключён модератором">

            <MicOffIcon sx={{ fontSize: iconSize, color: MOD_COLOR }} />

            <GavelIcon className="voice-status-mod-badge" sx={{ fontSize: 9 }} />

          </InlineStatusPill>

        ) : micSelf ? (

          <InlineStatusPill className="off" title="Микрофон выключен">

            <MicOffIcon sx={{ fontSize: iconSize }} />

          </InlineStatusPill>

        ) : isSpeaking ? (

          <InlineStatusPill className="on speaking" title="Говорит">

            <MicIcon className="voice-status-icon-speaking-glyph" sx={{ fontSize: iconSize }} />

          </InlineStatusPill>

        ) : (

          <InlineStatusPill className="on" title="Микрофон включён">

            <MicIcon sx={{ fontSize: iconSize }} />

          </InlineStatusPill>

        )}



        {deafModerated ? (

          <InlineStatusPill className="off moderated" title="Звук отключён модератором">

            <HeadsetOffIcon sx={{ fontSize: iconSize, color: MOD_COLOR }} />

            <GavelIcon className="voice-status-mod-badge" sx={{ fontSize: 9 }} />

          </InlineStatusPill>

        ) : deafSelf ? (

          <InlineStatusPill className="off" title="Звук выключен">

            <HeadsetOffIcon sx={{ fontSize: iconSize }} />

          </InlineStatusPill>

        ) : (

          <InlineStatusPill className="on" title="Звук включён">

            <HeadsetIcon sx={{ fontSize: iconSize }} />

          </InlineStatusPill>

        )}

      </div>

    );

  }



  if (variant === 'inline') {

    return (

      <div className={`voice-participant-status-icons-root inline ${className}`.trim()}>

        {micModerated && (

          <span

            className="voice-status-icon server-moderated voice-participant-muted-icon"

            title="Микрофон отключён модератором"

          >

            <MicOffIcon sx={{ fontSize: iconSize, color: MOD_COLOR }} />

            <GavelIcon className="voice-status-mod-badge" sx={{ fontSize: 9 }} />

          </span>

        )}

        {micSelf && (

          <span className="voice-participant-muted-icon" title="Микрофон выключен">

            <MicOffIcon sx={{ fontSize: iconSize }} />

          </span>

        )}

        {!isMuted && isSpeaking && (

          <span className="voice-status-icon speaking" title="Говорит">

            <MicIcon className="voice-status-icon-speaking-glyph" sx={{ fontSize: iconSize }} />

          </span>

        )}

        {deafModerated && (

          <span

            className="voice-status-icon server-moderated voice-participant-deafened-icon"

            title="Звук отключён модератором"

          >

            <HeadsetOffIcon sx={{ fontSize: iconSize, color: MOD_COLOR }} />

            <GavelIcon className="voice-status-mod-badge" sx={{ fontSize: 9 }} />

          </span>

        )}

        {deafSelf && (

          <span className="voice-participant-deafened-icon" title="Звук выключен">

            <HeadsetOffIcon sx={{ fontSize: iconSize }} />

          </span>

        )}

      </div>

    );

  }



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

          <MicIcon className="voice-status-icon-speaking-glyph" sx={{ fontSize: iconSize }} />

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


