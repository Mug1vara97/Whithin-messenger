import React, { useState, useEffect, useRef, useMemo, useCallback, useContext, forwardRef, useImperativeHandle } from 'react';
// import { useVoiceChannel } from './contexts/VoiceChannelContext';
// import { useTheme } from './contexts/ThemeContext';
import { createPortal } from 'react-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  AppBar,
  Toolbar,
  IconButton,
  ListItemIcon,
  Divider,
  Slider,
  Switch,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Mic,
  MicOff,
  VolumeUp,
  VolumeOff,
  Person,
  Tag,
  PhoneDisabled,
  ScreenShare,
  StopScreenShare,
  VolumeOffRounded,
  Videocam,
  VideocamOff,
  NoiseAware,
  NoiseControlOff,
  ExpandMore,
  HeadsetOff,
  Headset,
  Fullscreen,
  FullscreenExit
} from '@mui/icons-material';
import { Device } from 'mediasoup-client';
import { io } from 'socket.io-client';
import { NoiseSuppressionManager } from './utils/noiseSuppression';
import voiceDetectorWorklet from './utils/voiceDetector.worklet.js?url';
import volumeStorage from './utils/volumeStorage';
import UserAvatar from './UserAvatar';



const config = {
  server: {
    url: 'https://whithin.ru'
  },
  iceServers: [
    {
      urls: ['stun:185.119.59.23:3478']
    },
    // {
    //   urls: ['stun:stun.l.google.com:19302']
    // },
    {
      urls: ['turn:185.119.59.23:3478?transport=udp'],
      username: 'test',
      credential: 'test123'
    },
    {
      urls: ['turn:185.119.59.23:3478?transport=tcp'],
      username: 'test',
      credential: 'test123'
    },
    // {
    //   urls: ['stun:stun1.l.google.com:19302']
    // },
    // {
    //   urls: ['stun:stun2.l.google.com:19302']
    // }
  ],
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 2,
    volume: 4.0,
    latency: 0,
    suppressLocalAudioPlayback: true,
    advanced: [
      {
        echoCancellationType: 'system',
        noiseSuppression: { level: 'high' },
        autoGainControl: { level: 'high' },
        googEchoCancellation: true,
        googEchoCancellation2: true,
        googAutoGainControl: true,
        googAutoGainControl2: true,
        googNoiseSuppression: true,
        googNoiseSuppression2: true,
        googHighpassFilter: true,
        googTypingNoiseDetection: true,
        googAudioMirroring: false,
        googDucking: true,
        googNoiseReduction: true,
        googExperimentalAutoGainControl: true,
        googExperimentalNoiseSuppression: true,
        googBeamforming: true,
        googArrayGeometry: true,
        googAudioNetworkAdaptator: true,
        googDAEchoCancellation: true,
        googExperimentalEchoCancellation: true
      }
    ]
  }
};

// Add Discord-like styles with theme support
const createStyles = (colors, isPrivateCall = false) => ({
  root: {
    height: isPrivateCall ? '100%' : '100vh', // Для приватных звонков используем 100% высоты контейнера
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: colors.background,
    color: colors.textSecondary,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    '@keyframes pulse': {
      '0%': {
        boxShadow: '0 0 0 2px rgba(59, 165, 92, 0.8)'
      },
      '50%': {
        boxShadow: '0 0 0 4px rgba(59, 165, 92, 0.4)'
      },
      '100%': {
        boxShadow: '0 0 0 2px rgba(59, 165, 92, 0.8)'
      }
    }
  },
  appBar: {
    backgroundColor: colors.background,
    boxShadow: 'none',
    borderBottom: `1px solid ${colors.borderBottom}`,
    position: 'relative',
    width: '100%',
    flexShrink: 0,
    height: '52px'
  },
  toolbar: {
    height: '52px',
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    '@media (max-width: 600px)': {
      padding: '0 8px',
    }
  },
  channelName: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: colors.text,
    height: '100%',
    '& .MuiSvgIcon-root': {
      color: colors.textMuted,
      fontSize: '20px'
    },
    '& .MuiTypography-root': {
      fontSize: '16px',
      fontWeight: 500
    },
    '@media (max-width: 600px)': {
      fontSize: '0.9rem',
    }
  },
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    height: isPrivateCall ? '100%' : 'calc(100vh - 52px)', // Для приватных звонков - вся высота (нет хедера)
    width: '100%',
    margin: 0,
    position: 'relative',
    boxSizing: 'border-box'
  },
  videoGrid: {
    display: 'grid',
    gap: '16px',
    padding: '20px',
    width: '100%',
    flex: 1,
    margin: 0,
    overflow: 'auto',
    minHeight: 0,
    marginBottom: '65px',
    boxSizing: 'border-box',
    alignContent: 'center',
    alignItems: 'center',
    // Адаптивная сетка будет устанавливаться динамически
  },
  videoItem: {
    backgroundColor: colors.surface,
    borderRadius: '8px',
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'all 0.2s ease-in-out',
    padding: '0',
    width: '100%',
    aspectRatio: '16/9',
    maxHeight: 'calc((100vh - 52px - 65px - 40px) / 2)', // Учитываем header, панель управления и отступы
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
    },
    '&.speaking': {
      '&::after': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        border: `2px solid ${colors.success}`,
        borderRadius: '8px',
        animation: 'pulse 2s infinite',
        pointerEvents: 'none',
        zIndex: 1
      }
    }
  },
  '@keyframes pulse': {
    '0%': {
      boxShadow: '0 0 0 0 rgba(59, 165, 92, 0.4)'
    },
    '70%': {
      boxShadow: '0 0 0 10px rgba(59, 165, 92, 0)'
    },
    '100%': {
      boxShadow: '0 0 0 0 rgba(59, 165, 92, 0)'
    }
  },
  userAvatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: colors.border,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.text,
    fontSize: '32px',
    fontWeight: 500,
    marginBottom: '12px',
    transition: 'transform 0.2s ease',
    '&:hover': {
      transform: 'scale(1.05)'
    }
  },
  userName: {
    color: colors.text,
    fontSize: '16px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(4px)',
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: 'rgba(0, 0, 0, 0.4)'
    }
  },
  userStatus: {
    fontSize: '14px',
    color: colors.textMuted,
    marginTop: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  micIcon: {
    padding: '8px',
    position: 'absolute',
    bottom: '8px',
    right: '8px',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: '50%',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: 'rgba(0,0,0,0.7)',
      transform: 'scale(1.1)'
    },
    '&:active': {
      transform: 'scale(0.95)'
    }
  },
  mutedMicIcon: {
    backgroundColor: 'rgba(237, 66, 69, 0.1)',
    '&:hover': {
      backgroundColor: 'rgba(237, 66, 69, 0.2)',
      transform: 'scale(1.1)'
    },
    '& .MuiSvgIcon-root': {
      color: '#ed4245'
    }
  },
  speakingMicIcon: {
    '& .MuiSvgIcon-root': {
      color: '#3ba55c'
    }
  },
  silentMicIcon: {
    '& .MuiSvgIcon-root': {
      color: '#B5BAC1'
    }
  },
  paper: {
    backgroundColor: colors.surface,
    color: colors.textSecondary,
    boxShadow: 'none',
    border: `1px solid ${colors.borderBottom}`
  },
  listItem: {
    borderRadius: '4px',
    margin: '2px 0',
    '&:hover': {
      backgroundColor: colors.hover
    },
    '@media (max-width: 600px)': {
      padding: '8px',
    }
  },
  username: {
    color: colors.text,
    fontSize: '1rem',
    '@media (max-width: 600px)': {
      fontSize: '0.9rem',
    }
  },
  controls: {
    display: 'flex',
    gap: '8px'
  },
  iconButton: {
    color: colors.text,
    '&:hover': {
      backgroundColor: colors.hover
    }
  },
  joinPaper: {
    backgroundColor: colors.surface,
    color: colors.textSecondary,
    padding: '24px',
    '@media (max-width: 600px)': {
      padding: '16px',
    }
  },
  textField: {
    '& .MuiOutlinedInput-root': {
      color: colors.textSecondary,
      '& fieldset': {
        borderColor: colors.border
      },
      '&:hover fieldset': {
        borderColor: colors.textMuted
      },
      '&.Mui-focused fieldset': {
        borderColor: colors.primary
      }
    },
    '& .MuiInputLabel-root': {
      color: colors.textMuted
    }
  },
  joinButton: {
    backgroundColor: colors.primary,
    color: colors.text,
    '&:hover': {
      backgroundColor: colors.primaryHover
    }
  },
  divider: {
    backgroundColor: colors.border,
    margin: '8px 0'
  },
  bottomBar: {
    backgroundColor: colors.bottom,
    padding: '12px 60px', // Increased side padding, reduced vertical padding
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    margin: 0,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    zIndex: 2,
    height: '65px',
    boxSizing: 'border-box'
  },
  controlsGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  controlsContainer: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center'
  },
  controlGroup: {
    backgroundColor: colors.hover,
    borderRadius: '8px',
    padding: '6px', // Reduced padding
    display: 'flex',
    alignItems: 'center',
    gap: '6px', // Reduced gap
    transition: 'background-color 0.2s ease',
    '& .MuiIconButton-root': {
      padding: '6px', // Reduced button padding
      '& .MuiSvgIcon-root': {
        fontSize: '20px' // Reduced icon size
      }
    }
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '8px',
    backgroundColor: colors.hover,
    '@media (max-width: 600px)': {
      padding: '4px',
      gap: '4px',
    }
  },
  leaveButton: {
    backgroundColor: colors.danger,
    color: colors.text,
    borderRadius: '8px',
    padding: '6px 12px', // Reduced padding
    '&:hover': {
      backgroundColor: colors.dangerHover
    },
    minWidth: '100px', // Reduced min-width
    fontSize: '14px' // Reduced font size
  },
  volumeControl: {
    width: 100,
    marginLeft: 2,
    marginRight: 2,
    '@media (max-width: 600px)': {
      width: 60,
    }
  },
  screenShareContainer: {
    position: 'relative',
    width: '100%',
    height: '300px',
    backgroundColor: colors.serverListBackground,
    marginBottom: '16px',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  screenVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    backgroundColor: '#000'
  },
  screenShareGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '16px',
    padding: '16px',
    maxHeight: '400px',
    overflowY: 'auto'
  },
  volumeIcon: {
    padding: '8px',
    position: 'absolute',
    bottom: '8px',
    right: '8px',
    borderRadius: '50%',
    transition: 'all 0.2s ease',
    zIndex: 10,
    '&.muted': {
      backgroundColor: 'rgba(237, 66, 69, 0.1) !important',
      animation: 'mutePulse 2s infinite !important',
      '&:hover': {
        backgroundColor: 'rgba(237, 66, 69, 0.2) !important',
        transform: 'scale(1.1)'
      },
      '& .MuiSvgIcon-root': {
        color: '#ed4245'
      }
    },
    '&.speaking': {
      backgroundColor: 'transparent',
      animation: 'none !important',
      '& .MuiSvgIcon-root': {
        color: '#3ba55c'
      }
    },
    '&.silent': {
      backgroundColor: 'transparent',
      animation: 'none !important',
      '& .MuiSvgIcon-root': {
        color: '#B5BAC1'
      }
    }
  },
  '@keyframes mutePulse': {
    '0%': {
      boxShadow: '0 0 0 0 rgba(237, 66, 69, 0.4)'
    },
    '70%': {
      boxShadow: '0 0 0 10px rgba(237, 66, 69, 0)'
    },
    '100%': {
      boxShadow: '0 0 0 0 rgba(237, 66, 69, 0)'
    }
  },
  // Обновим стили
  screenShareItem: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16/9',
    backgroundColor: colors.serverListBackground,
    borderRadius: '8px',
    overflow: 'hidden',
    maxHeight: 'calc((100vh - 52px - 65px - 40px) / 2)', // Учитываем header, панель управления и отступы
    '& video': {
      objectFit: 'contain',
      width: '100%',
      height: '100%'
    }
  },
  screenShareUserName: {
    position: 'absolute',
    bottom: '12px',
    left: '12px',
    color: colors.text,
    fontSize: '14px',
    fontWeight: 500,
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    zIndex: 2
  },
  fullscreenOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  },
  fullscreenVideoContainer: {
    width: '100vw',
    height: '100vh',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    overflow: 'hidden'
  },
  fullscreenVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    backgroundColor: '#000'
  },
  fullscreenControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: '16px',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10000
  },
  fullscreenButton: {
    color: colors.text,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    '&:hover': {
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      transform: 'scale(1.1)'
    },
    transition: 'all 0.2s ease'
  },
  fullscreenUserName: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    color: colors.text,
    fontSize: '16px',
    fontWeight: 500,
    padding: '8px 16px',
    borderRadius: '4px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    zIndex: 10000
  },
  screenShareControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: '8px',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)',
    display: 'flex',
    justifyContent: 'flex-end',
    zIndex: 5
  }
});



// Создаем контекст для состояния мьюта
const MuteContext = React.createContext({
  muteStates: new Map(),
  setMuteState: () => {}
});

// Создаем провайдер для состояния мьюта
const MuteProvider = React.memo(({ children, socket }) => {
  const [muteStates, setMuteStates] = useState(new Map());
  
  const setMuteState = useCallback((peerId, isMuted) => {
    console.log('Setting mute state in context:', { peerId, isMuted });
    setMuteStates(prev => {
      const newStates = new Map(prev);
      newStates.set(peerId, Boolean(isMuted));
      return newStates;
    });
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handlePeerMuteStateChanged = ({ peerId, isMuted }) => {
      console.log('MuteProvider: Peer mute state changed:', { peerId, isMuted });
      setMuteState(peerId, Boolean(isMuted));

      // Если пользователь замьючен, убираем состояние speaking
      if (isMuted) {
        socket.emit('speaking', { speaking: false });
      }
    };

    const handlePeerJoined = ({ peerId, isMuted }) => {
      console.log('MuteProvider: New peer joined:', { peerId, isMuted });
      setMuteState(peerId, Boolean(isMuted));
    };

    socket.on('peerMuteStateChanged', handlePeerMuteStateChanged);
    socket.on('peerJoined', handlePeerJoined);

    return () => {
      socket.off('peerMuteStateChanged', handlePeerMuteStateChanged);
      socket.off('peerJoined', handlePeerJoined);
    };
  }, [socket, setMuteState]);

  const value = useMemo(() => ({
    muteStates,
    setMuteState
  }), [muteStates, setMuteState]);

  return (
    <MuteContext.Provider value={value}>
      {children}
    </MuteContext.Provider>
  );
});

// Создаем хук для использования состояния мьюта
const useMuteState = (peerId) => {
  const context = useContext(MuteContext);
  if (!context) {
    throw new Error('useMuteState must be used within a MuteProvider');
  }
  return [context.muteStates.get(peerId) || false, (isMuted) => context.setMuteState(peerId, isMuted)];
};

// Компонент индикатора мьюта
const MuteIndicator = React.memo(({ peerId }) => {
  const [isMuted] = useMuteState(peerId);
  
  if (!isMuted) return null;
  
  return (
    <div style={{
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: 'rgba(0,0,0,0.6)',
      padding: '4px',
      borderRadius: '50%',
      color: '#ffffff'
    }}>
      <VolumeOffRounded fontSize="small" />
    </div>
  );
});

// Оптимизированный компонент для видео (не перерисовывается при изменении состояния)
const VideoPlayer = React.memo(({ stream, style }) => {
  const videoRef = useRef();
  const [isHidden, setIsHidden] = useState(false);
  const [isRemoved, setIsRemoved] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const mountedRef = useRef(true);
  const cleanupTimeoutRef = useRef(null);
  const setupAttemptRef = useRef(false);
  
  useEffect(() => {
    mountedRef.current = true;
    setIsHidden(false);
    setIsRemoved(false);
    setVideoError(null);

    if (!stream) {
      console.log('No stream available, cleaning up video');
      cleanupVideo();
      return;
    }

    const setupVideo = async () => {
      if (setupAttemptRef.current) {
        console.log('Setup already in progress, skipping');
        return;
      }

      if (!mountedRef.current || !videoRef.current) {
        console.log('Component not mounted or video ref not available');
        return;
      }

      try {
        setupAttemptRef.current = true;
        console.log('Setting up video with new stream');
        
        if (videoRef.current.srcObject) {
          const oldTracks = videoRef.current.srcObject.getTracks();
          oldTracks.forEach(track => {
            track.stop();
          });
          videoRef.current.srcObject = null;
          videoRef.current.load();
        }

        videoRef.current.playsInline = true;
        videoRef.current.autoplay = true;
        videoRef.current.srcObject = stream;

        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          try {
            await playPromise;
            console.log('Video playback started successfully');
          } catch (error) {
            if (error.name === 'AbortError') {
              console.log('Playback aborted, stream might have been removed');
              cleanupVideo();
              return;
            }
            throw error;
          }
        }
      } catch (error) {
        console.error('Error setting up video:', error);
        setVideoError(error.message);
        cleanupVideo();
      } finally {
        setupAttemptRef.current = false;
      }
    };

    setupVideo();

    return () => {
      console.log('Cleaning up video component');
      mountedRef.current = false;
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
      cleanupVideo();
    };
  }, [stream]);

  const cleanupVideo = useCallback(() => {
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        
        if (videoRef.current.srcObject) {
          const tracks = videoRef.current.srcObject.getTracks();
          tracks.forEach(track => {
            track.enabled = false;
            track.stop();
          });
          videoRef.current.srcObject = null;
        }
        
        videoRef.current.load();
        setIsHidden(true);

        if (cleanupTimeoutRef.current) {
          clearTimeout(cleanupTimeoutRef.current);
        }
        
        cleanupTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setIsRemoved(true);
          }
        }, 100);

        setupAttemptRef.current = false;
      } catch (error) {
        console.error('Error cleaning up video:', error);
        setIsHidden(true);
        setIsRemoved(true);
        setupAttemptRef.current = false;
      }
    }
  }, []);

  if (isRemoved) {
    return null;
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      backgroundColor: '#202225',
      borderRadius: '8px',
      overflow: 'hidden',
      opacity: isHidden ? 0 : 1,
      transition: 'opacity 0.2s ease-out'
    }}>
      <video
        ref={videoRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          backgroundColor: '#000',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1,
          ...(style || {})
        }}
        autoPlay
        playsInline
      />
      {videoError && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: '8px 16px',
          borderRadius: '4px',
          color: '#ffffff',
          zIndex: 3
        }}>
          {videoError}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => prevProps.stream === nextProps.stream && prevProps.style === nextProps.style);

// Компонент оверлея (перерисовывается отдельно от видео)
const VideoOverlay = React.memo(({ 
  peerName, 
  isMuted, 
  isSpeaking,
  isAudioEnabled,
  isLocal,
  onVolumeClick,
  volume,
  isAudioMuted,
  showVolumeSlider,
  onVolumeSliderChange,
  onToggleVolumeSlider,
  colors,
  children
}) => {
  const [isVolumeOff, setIsVolumeOff] = useState(isAudioMuted || volume === 0);

  useEffect(() => {
    setIsVolumeOff(isAudioMuted || volume === 0);
  }, [volume, isAudioMuted]);

  const handleVolumeIconClick = (e) => {
    e.stopPropagation();
    setIsVolumeOff(prev => !prev);
    if (onVolumeClick) {
      onVolumeClick();
    }
  };

  const handleVolumeRightClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Right click on volume icon detected');
    if (onToggleVolumeSlider) {
      console.log('Calling onToggleVolumeSlider');
      onToggleVolumeSlider();
    } else {
      console.log('onToggleVolumeSlider is not defined');
    }
  };

  const handleSliderChange = (event, newValue) => {
    event.stopPropagation();
    if (onVolumeSliderChange) {
      onVolumeSliderChange(newValue);
    }
  };

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 2,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      padding: '12px',
      background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.3) 100%)'
    }}>
      {/* Основной блок с информацией */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: 500,
        padding: '4px 8px',
        borderRadius: '4px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        width: 'fit-content',
        mb: 1
      }}>
        {isMuted ? (
          <MicOff sx={{ fontSize: 16, color: '#ed4245' }} />
        ) : isSpeaking ? (
          <Mic sx={{ fontSize: 16, color: '#3ba55c' }} />
        ) : (
          <Mic sx={{ fontSize: 16, color: '#B5BAC1' }} />
        )}
        {!isAudioEnabled && (
          <HeadsetOff sx={{ fontSize: 16, color: '#ed4245' }} />
        )}
        {peerName}
      </Box>
      
      {!isLocal && (
        <>
          <IconButton
            onClick={handleVolumeIconClick}
            onContextMenu={handleVolumeRightClick}
            className={`volumeControl ${
              isVolumeOff
                ? 'muted'
                : isSpeaking
                ? 'speaking'
                : 'silent'
            }`}
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              backgroundColor: 'rgba(0,0,0,0.5)',
              borderRadius: '50%',
              transition: 'all 0.2s ease',
              zIndex: 10,
              '&:hover': {
                backgroundColor: 'rgba(0,0,0,0.7)',
                transform: 'scale(1.1)'
              },
              '&.muted': {
                backgroundColor: 'rgba(237, 66, 69, 0.1) !important',
                animation: 'mutePulse 2s infinite !important',
                '&:hover': {
                  backgroundColor: 'rgba(237, 66, 69, 0.2) !important',
                  transform: 'scale(1.1)'
                }
              },
              '&.speaking': {
                backgroundColor: 'transparent',
                '& .MuiSvgIcon-root': {
                  color: '#3ba55c'
                }
              },
              '&.silent': {
                backgroundColor: 'transparent',
                '& .MuiSvgIcon-root': {
                  color: '#B5BAC1'
                }
              }
            }}
          >
            {isVolumeOff ? (
              <VolumeOff sx={{ fontSize: 20, color: '#ed4245' }} />
            ) : (
              <VolumeUp sx={{ fontSize: 20 }} />
            )}
          </IconButton>
          
          {/* Слайдер громкости */}
          {showVolumeSlider && (
            <Box sx={{
              position: 'absolute',
              bottom: 60,
              right: 8,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              borderRadius: '20px',
              padding: '16px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              minHeight: '120px',
              zIndex: 15
            }}>
              <Slider
                value={volume}
                onChange={handleSliderChange}
                orientation="vertical"
                min={0}
                max={100}
                step={1}
                size="small"
                sx={{
                  color: colors.primary,
                  height: '80px',
                  '& .MuiSlider-track': {
                    backgroundColor: colors.primary,
                  },
                  '& .MuiSlider-thumb': {
                    backgroundColor: colors.primary,
                    '&:hover': {
                      boxShadow: `0px 0px 0px 8px rgba(${colors.primaryRgb}, 0.16)`,
                    },
                  },
                  '& .MuiSlider-rail': {
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  }
                }}
              />
              <Typography sx={{ 
                fontSize: '12px', 
                color: '#B5BAC1', 
                minWidth: '35px',
                textAlign: 'center'
              }}>
                {volume}%
              </Typography>
            </Box>
          )}
        </>
      )}
      
      {children}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.peerName === nextProps.peerName &&
    prevProps.isMuted === nextProps.isMuted &&
    prevProps.isSpeaking === nextProps.isSpeaking &&
    prevProps.isAudioEnabled === nextProps.isAudioEnabled &&
    prevProps.volume === nextProps.volume &&
    prevProps.isAudioMuted === nextProps.isAudioMuted &&
    prevProps.showVolumeSlider === nextProps.showVolumeSlider &&
    prevProps.colors === nextProps.colors &&
    prevProps.children === nextProps.children
  );
});

// Оптимизированный компонент для отображения видео
const VideoView = React.memo(({ 
  stream, 
  peerName, 
  isMuted, 
  isSpeaking,
  isAudioEnabled,
  isLocal,
  onVolumeClick,
  volume,
  isAudioMuted,
  showVolumeSlider,
  onVolumeSliderChange,
  onToggleVolumeSlider,
  colors,
  children 
}) => {
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <VideoPlayer stream={stream} />
      <VideoOverlay
        peerName={peerName}
        isMuted={isMuted}
        isSpeaking={isSpeaking}
        isAudioEnabled={isAudioEnabled}
        isLocal={isLocal}
        onVolumeClick={onVolumeClick}
        volume={volume}
        isAudioMuted={isAudioMuted}
        showVolumeSlider={showVolumeSlider}
        onVolumeSliderChange={onVolumeSliderChange}
        onToggleVolumeSlider={onToggleVolumeSlider}
        colors={colors}
      >
        {children}
      </VideoOverlay>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.stream === nextProps.stream &&
    prevProps.peerName === nextProps.peerName &&
    prevProps.isMuted === nextProps.isMuted &&
    prevProps.isSpeaking === nextProps.isSpeaking &&
    prevProps.isAudioEnabled === nextProps.isAudioEnabled &&
    prevProps.volume === nextProps.volume &&
    prevProps.isAudioMuted === nextProps.isAudioMuted &&
    prevProps.showVolumeSlider === nextProps.showVolumeSlider &&
    prevProps.colors === nextProps.colors &&
    prevProps.children === nextProps.children
  );
});

const VoiceChat = forwardRef(({ roomId, roomName, userName, userId, serverId, autoJoin = true, showUI = false, isVisible = true, onLeave, onManualLeave, onMuteStateChange, onAudioStateChange, initialMuted = false, initialAudioEnabled = true, isPrivateCall = false }, ref) => {
  const { 
    removeVoiceChannelParticipant, 
    updateVoiceChannelParticipant,
    joinVoiceChannel,
    leaveVoiceChannel,
    updateUserMuteState,
    updateUserAudioState
  } = useVoiceChannel();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors, isPrivateCall), [colors, isPrivateCall]);
  const [isJoined, setIsJoined] = useState(false);

  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isAudioEnabled, setIsAudioEnabled] = useState(initialAudioEnabled);

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [peers, setPeers] = useState(new Map());
  const [error, setError] = useState('');
      const [volumes, setVolumes] = useState(new Map());
    const [speakingStates, setSpeakingStates] = useState(new Map());
    const [audioStates, setAudioStates] = useState(new Map());
    const [showVolumeSliders, setShowVolumeSliders] = useState(new Map()); // Состояние для отображения слайдеров
  const [userProfiles, setUserProfiles] = useState(new Map()); // Профили пользователей с аватарами

  const prevRoomIdRef = useRef(roomId);

  // Функция для получения профиля пользователя с C# сервера
  const fetchUserProfile = useCallback(async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`https://whithin.ru/api/profile/${userId}/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const profile = await response.json();
        console.log('Loaded user profile:', { userId, profile });
        const avatarData = {
          avatarUrl: profile.avatar ? `https://whithin.ru${profile.avatar}` : null,
          avatarColor: profile.avatarColor || '#5865F2'
        };
        console.log('Setting avatar data:', avatarData);
        setUserProfiles(prev => new Map(prev).set(userId, avatarData));
        return profile;
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
    return null;
  }, []);

  // Use userId and serverId in socket connection
  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.emit('setUserInfo', { userId, serverId });
    }
  }, [userId, serverId]);

  // Загружаем профиль текущего пользователя
  useEffect(() => {
    if (userId) {
      fetchUserProfile(userId);
    }
  }, [userId, fetchUserProfile]);



  // Обработка изменения roomId
  useEffect(() => {
    if (prevRoomIdRef.current && prevRoomIdRef.current !== roomId) {
      console.log('Room ID changed, reconnecting to new room:', roomId);
      handleLeaveCall();
      // Небольшая задержка перед подключением к новому каналу
      setTimeout(() => {
        if (autoJoin) {
          handleJoin();
        }
      }, 100);
    }
    prevRoomIdRef.current = roomId;
  }, [roomId, autoJoin]);

  const [screenProducer, setScreenProducer] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [remoteScreens, setRemoteScreens] = useState(new Map());
  const [videoProducer, setVideoProducer] = useState(null);
  const [videoStream, setVideoStream] = useState(null);
  const [remoteVideos, setRemoteVideos] = useState(new Map());
  const [isNoiseSuppressed, setIsNoiseSuppressed] = useState(() => {
    const saved = localStorage.getItem('noiseSuppression');
    return saved ? JSON.parse(saved) : false;
  });
  
  // Маппинг между producerSocketId и реальным userId
  const userIdMappingRef = useRef(new Map());
  const [noiseSuppressionMode, setNoiseSuppressionMode] = useState('rnnoise');
  const [noiseSuppressMenuAnchor, setNoiseSuppressMenuAnchor] = useState(null);
  const noiseSuppressionRef = useRef(null);
  const isAudioEnabledRef = useRef(isAudioEnabled);
  const individualMutedPeersRef = useRef(new Map());
  const previousVolumesRef = useRef(new Map()); // Хранит предыдущие уровни громкости для восстановления
  const volumesRef = useRef(new Map());
  const speakingStatesRef = useRef(new Map());

  // Sync states with refs
  useEffect(() => {
    isAudioEnabledRef.current = isAudioEnabled;
  }, [isAudioEnabled]);

  useEffect(() => {
    volumesRef.current = volumes;
  }, [volumes]);

  useEffect(() => {
    speakingStatesRef.current = speakingStates;
  }, [speakingStates]);

  const socketRef = useRef();
  const deviceRef = useRef();
  const producerTransportRef = useRef();
  const consumerTransportsRef = useRef(new Map());
  const producersRef = useRef(new Map());
  const consumersRef = useRef(new Map());
  const localStreamRef = useRef();
  const audioRef = useRef(new Map());
  const audioContextRef = useRef();
  const gainNodesRef = useRef(new Map());
  const analyserNodesRef = useRef(new Map());
  const animationFramesRef = useRef(new Map());

  // Добавляем новый ref для хранения состояний mute
  const mutedPeersRef = useRef(new Map());

  const [fullscreenShare, setFullscreenShare] = useState(null);

  // Обработчик для уведомления о выходе при закрытии вкладки
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (roomId && userId && socketRef.current) {
        socketRef.current.emit('userLeftVoiceChannel', {
          channelId: roomId,
          userId: userId
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [roomId, userId]);

  // Обработчик изменения настроек шумоподавления
  useEffect(() => {
    const handleNoiseSuppressionChanged = (event) => {
      const { enabled } = event.detail;
      setIsNoiseSuppressed(enabled);
      
      // Если шумоподавление включено и у нас есть поток, включаем его
      if (enabled && localStreamRef.current && noiseSuppressionRef.current) {
        noiseSuppressionRef.current.enable(noiseSuppressionMode);
      } else if (!enabled && noiseSuppressionRef.current) {
        noiseSuppressionRef.current.disable();
      }
    };

    window.addEventListener('noiseSuppressionChanged', handleNoiseSuppressionChanged);
    return () => {
      window.removeEventListener('noiseSuppressionChanged', handleNoiseSuppressionChanged);
    };
  }, [noiseSuppressionMode]);

  useEffect(() => {
    const resumeAudioContext = async () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        try {
          await audioContextRef.current.resume();
          console.log('AudioContext resumed successfully');
        } catch (error) {
          console.error('Failed to resume AudioContext:', error);
        }
      }
    };

    const handleInteraction = async () => {
      console.log('User interaction detected, resuming audio...');
      await resumeAudioContext();
      
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };

    if (socketRef.current) {
      socketRef.current.on('speakingStateChanged', ({ peerId, speaking }) => {
        setSpeakingStates(prev => {
          const newStates = new Map(prev);
          newStates.set(peerId, speaking);
          return newStates;
        });
      });

      socketRef.current.on('peerMuteStateChanged', ({ peerId, isMuted }) => {
        // НЕ изменяем громкость при изменении состояния мьюта другого пользователя
        // Громкость должна сохраняться индивидуально для каждого пользователя
        
        if (isMuted) {
          setSpeakingStates(prev => {
            const newStates = new Map(prev);
            newStates.set(peerId, false);
            return newStates;
          });
        }
      });
    }

    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);
    document.addEventListener('keydown', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    // Глобальный логгер всех событий сокета
    socket.onAny((event, ...args) => {
      console.log('Socket event received:', event, args);
    });

    // Обработчик закрытия producer
    socket.on('producerClosed', ({ producerId, producerSocketId, mediaType }) => {
      console.log('Producer closed event received:', { producerId, producerSocketId, mediaType });
      
      if (mediaType === 'screen') {
        console.log('Processing screen sharing producer closure');
        setRemoteScreens(prev => {
          const newScreens = new Map(prev);
          const screenEntry = [...newScreens.entries()].find(
            ([, data]) => data.producerId === producerId
          );
          
          if (screenEntry) {
            const [peerId] = screenEntry;
            if (peerId === producerSocketId) {
              console.log('Removing screen from remoteScreens:', peerId);
              // Останавливаем треки перед удалением
              const stream = screenEntry[1].stream;
              if (stream) {
                stream.getTracks().forEach(track => {
                  track.stop();
                });
              }
              newScreens.delete(peerId);
            }
          }
          return newScreens;
        });
      } else if (mediaType === 'webcam') {
        console.log('Processing webcam producer closure');
        setRemoteVideos(prev => {
          const newVideos = new Map(prev);
          const videoEntry = [...newVideos.entries()].find(
            ([, data]) => data.producerId === producerId
          );
          
          if (videoEntry) {
            const [peerId] = videoEntry;
            if (peerId === producerSocketId) {
              console.log('Removing video from remoteVideos:', peerId);
              // Останавливаем треки перед удалением
              const stream = videoEntry[1].stream;
              if (stream) {
                stream.getTracks().forEach(track => {
                  track.stop();
                });
              }
              newVideos.delete(peerId);

              // Находим и закрываем соответствующий consumer
              const consumer = Array.from(consumersRef.current.entries()).find(
                ([, consumer]) => consumer.producerId === producerId
              );
              if (consumer) {
                console.log('Found and closing associated consumer:', consumer[0]);
                consumer[1].close();
                consumersRef.current.delete(consumer[0]);
              }
            }
          }
          return newVideos;
        });
      }
    });

    // Обработчики состояния говорения и отключения звука
    socket.on('speakingStateChanged', ({ peerId, speaking }) => {
      // Update voice channel context
      updateVoiceChannelParticipant(roomId, peerId, { isSpeaking: Boolean(speaking) });

      // Уведомляем сервер об изменении состояния участника
      socket.emit('voiceChannelParticipantStateChanged', {
        channelId: roomId,
        userId: peerId,
        isMuted: false, // Получаем из текущего состояния
        isSpeaking: Boolean(speaking)
      });
      
      setSpeakingStates(prev => {
        const newStates = new Map(prev);
        newStates.set(peerId, speaking);
        return newStates;
      });
    });

    socket.on('peerMuteStateChanged', ({ peerId, isMuted }) => {
      // Update voice channel context
      updateVoiceChannelParticipant(roomId, peerId, { isMuted: Boolean(isMuted) });

      // Уведомляем сервер об изменении состояния участника
      socket.emit('voiceChannelParticipantStateChanged', {
        channelId: roomId,
        userId: peerId,
        isMuted: Boolean(isMuted),
        isSpeaking: false // Получаем из текущего состояния
      });
      
      // НЕ изменяем громкость при изменении состояния мьюта другого пользователя
      // Громкость должна сохраняться индивидуально для каждого пользователя
      
      if (isMuted) {
        setSpeakingStates(prev => {
          const newStates = new Map(prev);
          newStates.set(peerId, false);
          return newStates;
        });
      }
    });

    // Очистка при размонтировании
    return () => {
      socket.offAny();
      socket.off('producerClosed');
      socket.off('speakingStateChanged');
      socket.off('peerMuteStateChanged');
    };
  }, [socketRef.current]); // Зависим только от socketRef.current

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    // Add audio state change handler
    socket.on('peerAudioStateChanged', ({ peerId, isEnabled }) => {
      setAudioStates(prev => {
        const newStates = new Map(prev);
        newStates.set(peerId, isEnabled);
        return newStates;
      });
    });

    return () => {
      socket.off('peerAudioStateChanged');
    };
  }, [socketRef.current]);

  const cleanup = () => {
    // Reset states to initial values
    setIsAudioEnabled(initialAudioEnabled);
    isAudioEnabledRef.current = initialAudioEnabled;
    setIsMuted(initialMuted); // Reset to initial mute state
    
    // Clear voice channel participants - удаляем только текущего пользователя
    if (roomId) {
      // Remove only current user from voice channel context
      removeVoiceChannelParticipant(roomId, userId);

      // Уведомляем сервер о выходе текущего пользователя из голосового канала
      if (socketRef.current) {
        socketRef.current.emit('userLeftVoiceChannel', {
          channelId: roomId,
          userId: userId
        });
        
        // Запрашиваем обновленные данные о участниках несколько раз с интервалом
        setTimeout(() => {
          socketRef.current.emit('getVoiceChannelParticipants');
        }, 500);
        
        setTimeout(() => {
          socketRef.current.emit('getVoiceChannelParticipants');
        }, 1500);
        
        setTimeout(() => {
          socketRef.current.emit('getVoiceChannelParticipants');
        }, 3000);
      }
    }
    
    // Reset all UI states
    setPeers(new Map());
    setVolumes(new Map());
    setSpeakingStates(new Map());
    setAudioStates(new Map());
    setRemoteVideos(new Map());
    setRemoteScreens(new Map());

    setIsJoined(false);
    setError('');
    
    // Clear all refs
    individualMutedPeersRef.current.clear();
    previousVolumesRef.current.clear();
    volumesRef.current.clear();
    speakingStatesRef.current.clear();
    mutedPeersRef.current.clear();
    
    // Close all media streams
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    try {
      // Stop screen sharing if active
      if (screenProducer) {
        screenProducer.close();
        setScreenProducer(null);
      }
      
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        setScreenStream(null);
      }

      setIsScreenSharing(false);
      setRemoteScreens(new Map());

      // Cleanup voice detection workers
      audioRef.current.forEach((peerAudio) => {
        if (peerAudio instanceof Map && peerAudio.has('voiceDetector')) {
          const voiceDetector = peerAudio.get('voiceDetector');
          if (voiceDetector) {
            voiceDetector.port.close();
            voiceDetector.disconnect();
          }
        }
      });

      // Cleanup analyzers
      analyserNodesRef.current.forEach(analyser => {
        if (analyser) {
          analyser.disconnect();
        }
      });
      analyserNodesRef.current.clear();

      // Cancel all animation frames
      animationFramesRef.current.forEach((frameId) => {
        cancelAnimationFrame(frameId);
      });
      animationFramesRef.current.clear();

      // Close socket and transports
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }

      // Close producer transport
      if (producerTransportRef.current) {
        producerTransportRef.current.close();
        producerTransportRef.current = null;
      }

      // Close consumer transports
      consumerTransportsRef.current.forEach(transport => {
        if (transport) {
          transport.close();
        }
      });
      consumerTransportsRef.current.clear();
      
      // Close producers
      producersRef.current.forEach(producer => {
        if (producer) {
          producer.close();
        }
      });
      producersRef.current.clear();
      
      // Close consumers
      consumersRef.current.forEach(consumer => {
        if (consumer) {
          consumer.close();
        }
      });
      consumersRef.current.clear();

      // Cleanup local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }

      // Cleanup voice detectors and intervals
      audioRef.current.forEach((audio) => {
        if (audio instanceof Map) {
          if (audio.has('voiceDetector')) {
            // Очищаем voice detector если есть
            const voiceDetector = audio.get('voiceDetector');
            if (voiceDetector) {
              voiceDetector.port.close();
              voiceDetector.disconnect();
            }
          }
          if (audio.has('gainCheckInterval')) {
            const interval = audio.get('gainCheckInterval');
            if (interval) {
              clearInterval(interval);
            }
          }
          if (audio.has('audioCheckInterval')) {
            const interval = audio.get('audioCheckInterval');
            if (interval) {
              clearInterval(interval);
            }
          }
          if (audio.has('statsInterval')) {
            const interval = audio.get('statsInterval');
            if (interval) {
              clearInterval(interval);
            }
          }
          if (audio.has('audioElement')) {
            // Очищаем HTML Audio элемент
            const audioElement = audio.get('audioElement');
            if (audioElement) {
              audioElement.pause();
              audioElement.srcObject = null;
              if (audioElement.parentNode) {
                audioElement.parentNode.removeChild(audioElement);
              }
            }
          }
        }
      });
      audioRef.current.clear();

      // Cleanup gain nodes
      gainNodesRef.current.forEach(node => {
        if (node) {
          node.disconnect();
        }
      });
      gainNodesRef.current.clear();

      // Close audio context
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;

      deviceRef.current = null;
      
      // Cleanup noise suppression
      if (noiseSuppressionRef.current) {
        noiseSuppressionRef.current.cleanup();
        noiseSuppressionRef.current = null;
      }

    } catch (error) {
      console.error('Cleanup error:', error);
    }
  };

  const handleJoin = async () => {
    if (!roomId || !userName) {
      setError('Please enter room ID and username');
      return;
    }

    try {
      // Set states to initial values when joining
      setIsAudioEnabled(initialAudioEnabled);
      isAudioEnabledRef.current = initialAudioEnabled;
      setIsMuted(initialMuted); // Use initial mute state

      // Clean up old socket if exists
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      socketRef.current = io(config.socketUrl, {
        transports: ['websocket'],
        query: { roomId }
      });

      console.log('Connecting to server...');
      const socket = io(config.server.url, {
        transports: ['websocket'],
        upgrade: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        secure: true,
        rejectUnauthorized: false
      });

      // Сразу добавляем временный логгер для отладки
      socket.onAny((event, ...args) => {
        console.log('IMMEDIATE SOCKET EVENT:', event, args);
      });
      
      // Сразу присваиваем сокет в ref
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('Socket connected successfully');

        // Set initial states
        socket.emit('muteState', { isMuted: initialMuted });
        socket.emit('audioState', { isEnabled: initialAudioEnabled });
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setError('Failed to connect to server: ' + error.message);
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected');

        // Уведомляем сервер о выходе пользователя из голосового канала при отключении
        if (roomId && userId) {
          socket.emit('userLeftVoiceChannel', {
            channelId: roomId,
            userId: userId
          });
        }

        setIsJoined(false);
        setPeers(new Map());
        cleanup();
      });

      // Add handlers for peer events
      socket.on('peerJoined', ({ peerId, name, isMuted, isAudioEnabled, userId: peerUserId }) => {
        console.log('New peer joined:', { peerId, name, isMuted, isAudioEnabled, peerUserId });
        
        // Участник будет добавлен автоматически через voiceChannelParticipantsUpdate от сервера
        console.log('New peer will be added via server update:', {
          roomId,
          peerId,
          name,
          isMuted: Boolean(isMuted)
        });

        // Уведомляем сервер о присоединении пользователя к голосовому каналу
        socket.emit('userJoinedVoiceChannel', {
          channelId: roomId,
          userId: peerId,
          userName: name,
          isMuted: Boolean(isMuted)
        });
        
        // Update peers state
        setPeers(prev => {
          const newPeers = new Map(prev);
          // Only add if peer doesn't exist
          if (!newPeers.has(peerId)) {
            newPeers.set(peerId, { 
              id: peerId, 
              name, 
              isMuted: Boolean(isMuted),
              userId: peerUserId // Добавляем userId для связи с профилем
            });
            console.log('Added new peer to peers map:', { peerId, name });
          }
          return newPeers;
        });

        // Update audio states
        setAudioStates(prev => {
          const newStates = new Map(prev);
          newStates.set(peerId, Boolean(isAudioEnabled));
          return newStates;
        });

        // Загружаем профиль нового участника
        if (peerUserId) {
          fetchUserProfile(peerUserId);
        }

        // Initialize volumes for the new peer
        setVolumes(prev => {
          const newVolumes = new Map(prev);
          newVolumes.set(peerId, isMuted ? 0 : 100); // Set volume based on mute state
          return newVolumes;
        });

        // Initialize speaking state for the new peer
        setSpeakingStates(prev => {
          const newStates = new Map(prev);
          newStates.set(peerId, false); // Initially not speaking
          return newStates;
        });

        // Initialize individual mute state - NOT muted by default (isMuted is for microphone, not for hearing this peer)
        individualMutedPeersRef.current.set(peerId, false);
      });

      socket.on('peerLeft', ({ peerId }) => {
        console.log('Peer left:', peerId);
        
        // Remove participant from voice channel context
        removeVoiceChannelParticipant(roomId, peerId);

        // Уведомляем сервер о выходе пользователя из голосового канала
        socket.emit('userLeftVoiceChannel', {
          channelId: roomId,
          userId: peerId
        });
        
        setPeers(prev => {
          const newPeers = new Map(prev);
          newPeers.delete(peerId);
          return newPeers;
        });
        setAudioStates(prev => {
          const newStates = new Map(prev);
          newStates.delete(peerId);
          return newStates;
        });
      });

      socket.on('newProducer', async ({ producerId, producerSocketId, kind }) => {
        console.log('New producer:', { producerId, producerSocketId, kind });
        await handleExistingProducer({ producerId, producerSocketId, kind });
      });

      // Initialize device first
      console.log('Initializing device...');
      const device = new Device();
      deviceRef.current = device;

      socket.emit('createRoom', { roomId }, async ({ error: createError }) => {
        console.log('Create room response:', createError ? `Error: ${createError}` : 'Success');
        
        socket.emit('join', { roomId, name: userName, userId, initialMuted, initialAudioEnabled }, async ({ error: joinError, routerRtpCapabilities, existingPeers, existingProducers }) => {
          if (joinError) {
            console.error('Join error:', joinError);
            setError(joinError);
            return;
          }

          try {
            console.log('Joined room, initializing connection...');
            
            // Обновляем глобальное состояние пользователя на сервере (сервер сам добавит в участники)
            joinVoiceChannel(roomId, userId, userName);
            
            // Сразу отправляем текущее состояние микрофона и наушников
            updateUserMuteState(userId, initialMuted);
            updateUserAudioState(userId, !initialAudioEnabled);

            // Уведомляем сервер о присоединении пользователя к голосовому каналу
            socket.emit('userJoinedVoiceChannel', {
              channelId: roomId,
              userId: userId,
              userName: userName,
              isMuted: initialMuted
            });

            // Запрашиваем актуальные данные о участниках
            socket.emit('getVoiceChannelParticipants');
            
            // Update peers state with existing peers
            if (existingPeers && existingPeers.length > 0) {
              console.log('Setting existing peers:', existingPeers);
              const peersMap = new Map();
              const audioStatesMap = new Map();
              const volumesMap = new Map();
              
              existingPeers.forEach(peer => {
                // Существующие участники будут добавлены через voiceChannelParticipantsUpdate от сервера
                
                peersMap.set(peer.id, { 
                  id: peer.id, 
                  name: peer.name, 
                  isMuted: peer.isMuted || false,
                  userId: peer.userId // Добавляем userId для связи с профилем
                });
                audioStatesMap.set(peer.id, peer.isAudioEnabled);
                
                // Загружаем профиль существующего участника
                if (peer.userId) {
                  fetchUserProfile(peer.userId);
                }
                
                // Initialize individual mute state for existing peers - NOT muted by default
                individualMutedPeersRef.current.set(peer.id, false);
                
                // Initialize previous volumes for existing peers
                previousVolumesRef.current.set(peer.id, 100);
                
                // Initialize volumes for existing peers - full volume by default
                volumesMap.set(peer.id, 100);
              });
              
              setPeers(peersMap);
              setAudioStates(audioStatesMap);
              setVolumes(volumesMap);
            }

            // Initialize Web Audio API context
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
              console.log('Creating new AudioContext...');
              audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 48000,
                latencyHint: 'interactive'
              });
              console.log('AudioContext created, state:', audioContextRef.current.state);
            }
            
            console.log('AudioContext state before resume:', audioContextRef.current.state);
            await audioContextRef.current.resume();
            console.log('AudioContext state after resume:', audioContextRef.current.state);
            
            // Проверяем политику автовоспроизведения
            if (navigator.getAutoplayPolicy) {
              const policy = navigator.getAutoplayPolicy('mediaelement');
              console.log('Autoplay policy:', policy);
              if (policy === 'disallowed') {
                console.warn('Autoplay is disallowed - user interaction required for audio');
              }
            }

            // Load device with router capabilities
            console.log('Loading device with router capabilities...');
            await device.load({ routerRtpCapabilities });
            console.log('Device loaded successfully');

            // Create send transport
            console.log('Creating send transport...');
            await createSendTransport();
            console.log('Send transport created successfully');

            // Create local stream
            console.log('Creating local stream...');
            await createLocalStream();
            console.log('Local stream created successfully');

            // Send initial states to server based on props
            socket.emit('audioState', { isEnabled: initialAudioEnabled });
            socket.emit('muteState', { isMuted: initialMuted });

            // Synchronize internal states with initial props after stream creation
            setIsMuted(initialMuted);
            setIsAudioEnabled(initialAudioEnabled);

            // Handle existing producers
            if (existingProducers && existingProducers.length > 0) {
              console.log('Processing existing producers:', existingProducers);
              for (const producer of existingProducers) {
                await handleExistingProducer(producer);
              }
            }

            console.log('Setting joined state to true');
            setIsJoined(true);

          } catch (err) {
            console.error('Failed to initialize:', err);
            setError('Failed to initialize connection: ' + err.message);
            cleanup();
          }
        });
      });

    } catch (err) {
      console.error('Connection error:', err);
      setError('Failed to connect to server: ' + err.message);
      cleanup();
    }
  };

  const handleExistingProducer = async (producer) => {
    try {
      console.log('Handling existing producer:', producer);
      
      // Skip if this is our own producer
      if (producer.producerSocketId === socketRef.current.id) {
        console.log('Skipping own producer');
        return;
      }
      
      // Create consumer transport if not exists
      const transport = await createConsumerTransport();
      console.log('Consumer transport created:', transport.id);
      
      const { rtpCapabilities } = deviceRef.current;
      
      // Simplified consume request with better error handling
      console.log('Requesting consume for producer:', producer.producerId);
      
      const consumeResponse = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error('Consume request timeout for producer:', producer.producerId);
          reject(new Error('Consume request timeout'));
        }, 10000); // 10 second timeout
        
        socketRef.current.emit('consume', {
          rtpCapabilities,
          remoteProducerId: producer.producerId,
          transportId: transport.id
        }, (response) => {
          clearTimeout(timeout);
          console.log('Consume response received:', response);
          
          if (response.error) {
            console.error('Consume request failed:', response.error);
            reject(new Error(response.error));
            return;
          }
          resolve(response);
        });
      });
      
      const { id, producerId, kind, rtpParameters, appData, error } = consumeResponse;

      if (error) {
        throw new Error(error);
      }

      if (!id || !producerId || !kind || !rtpParameters) {
        throw new Error('Invalid consumer data received from server');
      }

      // Create consumer
      const consumer = await transport.consume({
        id,
        producerId,
        kind,
        rtpParameters,
        appData
      });

      console.log('Consumer created:', consumer.id);
      consumersRef.current.set(consumer.id, consumer);

      // Create MediaStream from consumer's track
      const stream = new MediaStream([consumer.track]);

      // Handle based on kind and appData
      if (appData?.mediaType === 'screen') {
        console.log('Processing screen sharing stream:', { kind, appData });
        
        if (kind === 'video') {
          console.log('Setting up screen sharing video');
          setRemoteScreens(prev => {
            const newScreens = new Map(prev);
            newScreens.set(producer.producerSocketId, { 
              producerId,
              consumerId: consumer.id,
              stream
            });
            return newScreens;
          });
        }
      } else if (appData?.mediaType === 'webcam') {
        console.log('Processing webcam stream:', { kind, appData });
        
        if (kind === 'video') {
          console.log('Setting up webcam stream');
          setRemoteVideos(prev => {
            const newVideos = new Map(prev);
            newVideos.set(producer.producerSocketId, {
              producerId,
              consumerId: consumer.id,
              stream
            });
            return newVideos;
          });
        }
      } else if (kind === 'audio') {
        // Handle regular audio streams
        try {
          // Create audio context and nodes for Web Audio API processing
          const audioContext = audioContextRef.current;
          console.log('AudioContext state:', audioContext.state);
          
          // Resume audio context if suspended
          if (audioContext.state === 'suspended') {
            console.log('Resuming suspended AudioContext...');
            await audioContext.resume();
            console.log('AudioContext resumed, new state:', audioContext.state);
          }
          
          // Проверяем, что поток содержит активные треки
          const audioTracks = stream.getAudioTracks();
          console.log('Stream audio tracks:', audioTracks.length);
          audioTracks.forEach((track, index) => {
            console.log(`Track ${index}:`, {
              enabled: track.enabled,
              muted: track.muted,
              readyState: track.readyState,
              label: track.label,
              settings: track.getSettings()
            });
          });
          
          // Create HTML Audio element as fallback
          const audioElement = document.createElement('audio');
          audioElement.srcObject = stream;
          audioElement.autoplay = true;
          audioElement.playsInline = true;
          // Initialize volume based on individual mute state and global audio state
          const isIndividuallyMutedForAudio = individualMutedPeersRef.current.get(producer.producerSocketId) ?? false;
          const individualVolume = volumes.get(producer.producerSocketId) || 100;
          audioElement.volume = (isAudioEnabledRef.current && !isIndividuallyMutedForAudio) ? (individualVolume / 100.0) : 0.0;
          audioElement.style.display = 'none';
          document.body.appendChild(audioElement);
          
          console.log('Created HTML Audio fallback element');
          
          // Store audio element for cleanup and volume control
          if (!audioRef.current.has(producer.producerSocketId)) {
            audioRef.current.set(producer.producerSocketId, new Map());
          }
          audioRef.current.get(producer.producerSocketId).set('audioElement', audioElement);
          
          // Try to play the audio element
          const playPromise = audioElement.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              console.log('HTML Audio element playing successfully');
            }).catch(error => {
              console.error('HTML Audio element play failed:', error);
            });
          }
          
          const source = audioContext.createMediaStreamSource(stream);
          console.log('Created MediaStreamSource from stream');
          
          // Debug: Check if MediaStreamSource is receiving audio data
          const debugAnalyser = audioContext.createAnalyser();
          debugAnalyser.fftSize = 256;
          source.connect(debugAnalyser);
          
          const checkAudioData = () => {
            const dataArray = new Uint8Array(debugAnalyser.frequencyBinCount);
            debugAnalyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            console.log(`Audio data for peer ${producer.producerSocketId}: average=${average}, max=${Math.max(...dataArray)}`);
            
            // If Web Audio API shows no data but we have a track, the HTML audio might still work
            if (average === 0 && audioTracks.length > 0 && audioTracks[0].readyState === 'live') {
              console.log('Web Audio API shows no data, but HTML Audio fallback should be working');
            }
          };
          
          // Check audio data every 2 seconds
          const audioCheckInterval = setInterval(checkAudioData, 2000);
          
          // Store interval for cleanup
          audioRef.current.get(producer.producerSocketId).set('audioCheckInterval', audioCheckInterval);
          
          // Add analyzer for voice activity detection
          const analyser = createAudioAnalyser(audioContext);
          
          // Create gain node для регулировки громкости
          const gainNode = audioContext.createGain();
          
          // Получаем реальный ID пользователя
          console.log('About to get realUserId for producer:', producer.producerSocketId);
          const realUserId = getRealUserId(producer, appData);
          

          
          // Сохраняем маппинг между producerSocketId и реальным userId
          userIdMappingRef.current.set(producer.producerSocketId, realUserId);
          console.log('Updated userIdMapping:', {
            producerSocketId: producer.producerSocketId,
            realUserId: realUserId,
            userIdMapping: Array.from(userIdMappingRef.current.entries())
          });
          
          // Получаем сохраненную громкость для этого пользователя
          let savedVolume = 100; // Значение по умолчанию
          try {
            savedVolume = await volumeStorage.getUserVolume(realUserId);
          } catch (error) {
            console.error('Failed to load saved volume for user:', realUserId, error);
          }
          
          // Начальная громкость из сохраненных настроек
          const isIndividuallyMuted = individualMutedPeersRef.current.get(producer.producerSocketId) ?? false;
          const initialVolume = isIndividuallyMuted ? 0 : savedVolume;
          const initialGain = isAudioEnabledRef.current && !isIndividuallyMuted ? (initialVolume / 100.0) * 4.0 : 0;
          gainNode.gain.value = initialGain;
          
          // Обновляем предыдущий уровень громкости
          previousVolumesRef.current.set(producer.producerSocketId, savedVolume);
          
          console.log('handleConsume: Created gain node for peer:', producer.producerSocketId, {
            isAudioEnabled: isAudioEnabledRef.current,
            isIndividuallyMuted,
            savedVolume,
            initialVolume,
            initialGain
          });

          // Подключаем цепочку аудио узлов
          source.connect(analyser);
          analyser.connect(gainNode);
          gainNode.connect(audioContext.destination);
          console.log('handleConsume: Connected audio nodes: source -> analyser -> gainNode -> destination');
          
          // Debug: Also connect debugAnalyser to the main chain for monitoring
          debugAnalyser.connect(analyser);
          
          // Добавляем периодическую проверку gain node
          const checkGainInterval = setInterval(() => {
            console.log(`handleConsume: Gain check for peer ${producer.producerSocketId}:`, {
              gainValue: gainNode.gain.value,
              isAudioEnabled: isAudioEnabledRef.current,
              individualVolume: volumes.get(producer.producerSocketId) || 100
            });
          }, 5000);
          
          // Сохраняем интервал для очистки
          if (!audioRef.current.has(producer.producerSocketId)) {
            audioRef.current.set(producer.producerSocketId, new Map());
          }
          audioRef.current.get(producer.producerSocketId).set('gainCheckInterval', checkGainInterval);

          analyserNodesRef.current.set(producer.producerSocketId, analyser);
          gainNodesRef.current.set(producer.producerSocketId, gainNode);
          setVolumes(prev => new Map(prev).set(producer.producerSocketId, savedVolume));

          // Start voice detection with producerId
          detectSpeaking(analyser, producer.producerSocketId, producer.producerId);
          console.log('handleConsume: Audio setup completed for peer:', producer.producerSocketId);
        } catch (error) {
          console.error('Error setting up audio:', error);
        }
      }

      // Resume the consumer
      console.log('Resuming consumer:', consumer.id, 'current state:', consumer.paused);
      
      // First resume on client side
      await consumer.resume();
      console.log('Consumer resumed on client, new state:', consumer.paused);
      
      // Then request server to resume consumer AND producer
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('Resume consumer timeout, continuing anyway');
          resolve(); // Don't fail on timeout
        }, 5000);
        
        socketRef.current.emit('resumeConsumer', { consumerId: consumer.id }, async (error) => {
          clearTimeout(timeout);
          if (error) {
            console.error('Server resume consumer failed:', error);
          } else {
            console.log('Server consumer resumed successfully');
            
            // Also try to resume the producer if it exists
            try {
              await new Promise((resolveProducer) => {
                const producerTimeout = setTimeout(() => {
                  console.warn('Resume producer timeout');
                  resolveProducer();
                }, 3000);
                
                socketRef.current.emit('resumeProducer', { producerId: consumer.producerId }, (producerError) => {
                  clearTimeout(producerTimeout);
                  if (producerError) {
                    console.error('Server resume producer failed:', producerError);
                  } else {
                    console.log('Server producer resumed successfully');
                  }
                  resolveProducer();
                });
              });
            } catch (producerError) {
              console.error('Error resuming producer:', producerError);
            }
          }
          resolve();
        });
      });
      
      // Check track state
      const track = consumer.track;
      console.log('Consumer track after resume:', {
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        id: track.id
      });

      // Monitor consumer state
      consumer.on('transportclose', () => {
        console.log('Consumer transport closed:', consumer.id);
        removeConsumer(consumer.id);
      });

      consumer.on('producerclose', () => {
        console.log('Consumer producer closed:', consumer.id);
        removeConsumer(consumer.id);
      });

      consumer.on('producerpause', () => {
        console.log('Consumer producer paused:', consumer.id);
        // Очищаем видео при паузе producer'а
        if (appData?.mediaType === 'webcam') {
          setRemoteVideos(prev => {
            const newVideos = new Map(prev);
            for (const [peerId, videoData] of newVideos.entries()) {
              if (videoData.consumerId === consumer.id) {
                if (videoData.stream) {
                  videoData.stream.getTracks().forEach(track => {
                    track.stop();
                  });
                }
                newVideos.delete(peerId);
                break;
              }
            }
            return newVideos;
          });
        }
      });

      consumer.on('producerresume', () => {
        console.log('Consumer producer resumed:', consumer.id);
      });

      // Monitor track state
      consumer.track.onended = () => {
        console.log('Consumer track ended:', consumer.id);
        removeConsumer(consumer.id);
      };

      // Add detailed WebRTC stats monitoring for audio consumers
      if (kind === 'audio') {
        const startStatsMonitoring = () => {
          const checkStats = async () => {
            try {
              const stats = await consumer.getStats();
              let audioReport = null;
              
              stats.forEach((report) => {
                if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                  audioReport = report;
                }
              });
              
              if (audioReport) {
                console.log(`WebRTC Audio Stats for ${producer.producerSocketId}:`, {
                  packetsReceived: audioReport.packetsReceived,
                  packetsLost: audioReport.packetsLost,
                  bytesReceived: audioReport.bytesReceived,
                  audioLevel: audioReport.audioLevel,
                  totalAudioEnergy: audioReport.totalAudioEnergy,
                  jitter: audioReport.jitter,
                  fractionLost: audioReport.fractionLost,
                  timestamp: audioReport.timestamp
                });
                
                // Check if we're actually receiving audio data
                if (audioReport.bytesReceived === 0 || audioReport.packetsReceived === 0) {
                  console.warn(`No audio data received for peer ${producer.producerSocketId}!`);
                  
                  // Try to restart the consumer
                  try {
                    console.log('Attempting to restart consumer due to no audio data...');
                    await consumer.pause();
                    await new Promise(resolve => setTimeout(resolve, 100));
                    await consumer.resume();
                    
                    // Also request server restart
                    socketRef.current.emit('restartConsumer', { 
                      consumerId: consumer.id,
                      producerId: consumer.producerId 
                    }, (error) => {
                      if (error) {
                        console.error('Server restart consumer failed:', error);
                      } else {
                        console.log('Server consumer restarted successfully');
                      }
                    });
                  } catch (error) {
                    console.error('Failed to restart consumer:', error);
                  }
                }
              }
            } catch (error) {
              console.error('Failed to get consumer stats:', error);
            }
          };
          
          // Check stats every 5 seconds
          const statsInterval = setInterval(checkStats, 5000);
          
          // Store interval for cleanup
          if (!audioRef.current.has(producer.producerSocketId)) {
            audioRef.current.set(producer.producerSocketId, new Map());
          }
          audioRef.current.get(producer.producerSocketId).set('statsInterval', statsInterval);
          
          // Initial check
          checkStats();
        };
        
        // Start monitoring after a short delay
        setTimeout(startStatsMonitoring, 1000);
      }

    } catch (error) {
      console.error('Error handling existing producer:', error);
    }
  };

  // Получаем контекст мьюта на уровне компонента
  const { setMuteState } = useContext(MuteContext);

  // Обновляем handleMute
  const handleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const newMuteState = !isMuted;
        audioTrack.enabled = !newMuteState; // Инвертируем состояние трека
        setIsMuted(newMuteState);
        
        // Если есть обработанный поток, обновляем его трек тоже
        if (noiseSuppressionRef.current) {
          const processedTrack = noiseSuppressionRef.current.getProcessedStream().getAudioTracks()[0];
          if (processedTrack) {
            processedTrack.enabled = !newMuteState;
          }
        }
        
        console.log('Sending mute state to server:', newMuteState);
        if (socketRef.current) {
          socketRef.current.emit('muteState', { isMuted: newMuteState });
          
          // Отправляем событие для обновления VoiceChannelContext
          socketRef.current.emit('peerMuteStateChanged', { 
            peerId: userId, 
            isMuted: newMuteState 
          });
          
          // Обновляем глобальное состояние пользователя на сервере
          updateUserMuteState(userId, newMuteState);
          
          // Локально обновляем состояние для самого пользователя в VoiceChannelContext
          // Эмитим событие локально, чтобы обновить свое состояние
          const localEvent = new CustomEvent('peerMuteStateChanged', {
            detail: { peerId: socketRef.current.id, isMuted: newMuteState }
          });
          window.dispatchEvent(localEvent);
          
          if (setMuteState) {
            setMuteState(socketRef.current.id, newMuteState);
          }
          
          if (newMuteState) {
            socketRef.current.emit('speaking', { speaking: false });
            setSpeakingStates(prev => {
              const newStates = new Map(prev);
              newStates.set(socketRef.current.id, false);
              return newStates;
            });
          } else {
            // Когда микрофон включается, перезапускаем детекцию голоса
            const analyser = analyserNodesRef.current.get(socketRef.current.id);
            if (analyser) {
              console.log('Restarting voice detection after unmute');
              detectSpeaking(analyser, socketRef.current.id);
            }
          }
        }

        // Вызываем коллбек для уведомления внешних компонентов
        if (onMuteStateChange) {
          onMuteStateChange(newMuteState);
        }
      }
    }
  }, [isMuted, setMuteState, onMuteStateChange, userId, updateUserMuteState]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    // Обработчик изменения состояния микрофона других пользователей
    const handlePeerMuteStateChanged = ({ peerId, isMuted }) => {
      console.log('Received peer mute state change:', { peerId, isMuted });
      
      // Обновляем состояние в peers
      setPeers(prev => {
        const newPeers = new Map(prev);
        const peer = newPeers.get(peerId);
        if (peer) {
          newPeers.set(peerId, { ...peer, isMuted: Boolean(isMuted) });
        }
        return newPeers;
      });

      // Если пользователь замьючен, убираем состояние speaking
      if (isMuted) {
        setSpeakingStates(prev => {
          const newStates = new Map(prev);
          newStates.set(peerId, false);
          return newStates;
        });
      }
    };

    socket.on('peerMuteStateChanged', handlePeerMuteStateChanged);

    return () => {
      socket.off('peerMuteStateChanged', handlePeerMuteStateChanged);
    };
  }, [socketRef.current]);

  // Эффект для глобального управления звуком
  useEffect(() => {
    isAudioEnabledRef.current = isAudioEnabled;
    
    // Управляем gain nodes для регулировки громкости
    gainNodesRef.current.forEach((gainNode, peerId) => {
      if (gainNode) {
        if (!isAudioEnabled) {
          gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime);
        } else {
          const isIndividuallyMuted = individualMutedPeersRef.current.get(peerId) ?? false;
          if (!isIndividuallyMuted) {
            const individualVolume = volumes.get(peerId) || 100;
            const gainValue = (individualVolume / 100.0) * 4.0;
            gainNode.gain.setValueAtTime(gainValue, audioContextRef.current.currentTime);
          } else {
            gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime);
          }
        }
      }
    });
    
    // Также управляем HTML Audio элементами
    audioRef.current.forEach((peerAudio, peerId) => {
      if (peerAudio instanceof Map && peerAudio.has('audioElement')) {
        const audioElement = peerAudio.get('audioElement');
        if (audioElement) {
          if (!isAudioEnabled) {
            audioElement.volume = 0;
          } else {
            const isIndividuallyMuted = individualMutedPeersRef.current.get(peerId) ?? false;
            if (!isIndividuallyMuted) {
              const individualVolume = volumes.get(peerId) || 100;
              audioElement.volume = individualVolume / 100.0;
            } else {
              audioElement.volume = 0;
            }
          }
        }
      }
    });
  }, [isAudioEnabled, volumes]);

    const handleVolumeChange = async (peerId) => {
    console.log('Volume change requested for peer:', peerId);
    const gainNode = gainNodesRef.current.get(peerId);
    
    // Даже если глобально звук выключен, мы все равно меняем индивидуальное состояние
    const isIndividuallyMuted = individualMutedPeersRef.current.get(peerId) ?? false;
    const newIsIndividuallyMuted = !isIndividuallyMuted;
    
    let newVolume;
    if (newIsIndividuallyMuted) {
      // Мутим - устанавливаем 0, но сначала сохраняем текущий уровень если он больше 0
      const currentVolume = volumes.get(peerId) || 100;
      if (currentVolume > 0) {
        previousVolumesRef.current.set(peerId, currentVolume);
      }
      newVolume = 0;
    } else {
      // Размутиваем - восстанавливаем предыдущий уровень или используем 100% по умолчанию
      newVolume = previousVolumesRef.current.get(peerId) || 100;
    }
    
    console.log('Peer:', peerId, 'Current individual mute:', isIndividuallyMuted, 'New individual mute:', newIsIndividuallyMuted, 'New volume:', newVolume);
    console.log('GainNode exists:', !!gainNode);
    
    if (gainNode) {
      if (!newIsIndividuallyMuted) {
        // Восстанавливаем предыдущий уровень громкости
        const gainValue = (newVolume / 100.0) * 4.0;
        gainNode.gain.setValueAtTime(gainValue, audioContextRef.current.currentTime);
        console.log('Set gain to', gainValue, 'and unmuted peer:', peerId);
      } else {
        gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime);
        console.log('Set gain to 0 and muted peer:', peerId);
      }

      // Сохраняем новое индивидуальное состояние
      individualMutedPeersRef.current.set(peerId, newIsIndividuallyMuted);
      
      // Обновляем UI состояние
      setVolumes(prev => {
        const newVolumes = new Map(prev);
        newVolumes.set(peerId, newVolume);
        return newVolumes;
      });
      
      // Также обновляем HTML Audio элемент
      const peerAudio = audioRef.current.get(peerId);
      if (peerAudio instanceof Map && peerAudio.has('audioElement')) {
        const audioElement = peerAudio.get('audioElement');
        if (audioElement) {
          audioElement.volume = newVolume / 100.0;
          console.log('Set HTML Audio volume to', newVolume / 100.0, 'for peer:', peerId);
        }
      }
      
      // Сохраняем громкость в IndexedDB
      try {
        // Получаем реальный ID пользователя из маппинга
        const realUserId = userIdMappingRef.current.get(peerId) || peerId;

        await volumeStorage.saveUserVolume(realUserId, newVolume);
      } catch (error) {
        console.error('Failed to save volume for user:', peerId, error);
      }
    }
  };

   // Функция для изменения громкости слайдером (Web Audio API gain nodes и HTML Audio)
   const handleVolumeSliderChange = useCallback(async (peerId, newVolume) => {
     console.log('Volume slider change for peer:', peerId, 'New volume:', newVolume);
     
     const gainNode = gainNodesRef.current.get(peerId);
     
     if (gainNode) {
       // Слайдер 0-100% соответствует 0-400% усиления (0.0-4.0 gain)
       const gainValue = (newVolume / 100.0) * 4.0;
       gainNode.gain.setValueAtTime(gainValue, audioContextRef.current.currentTime);
       
       console.log('Set gain node value to', gainValue, 'for peer:', peerId);
     } else {
       console.error('Gain node not found for peer:', peerId);
     }
     
     // Также обновляем HTML Audio элемент
     const peerAudio = audioRef.current.get(peerId);
     if (peerAudio instanceof Map && peerAudio.has('audioElement')) {
       const audioElement = peerAudio.get('audioElement');
       if (audioElement) {
         audioElement.volume = newVolume / 100.0;
         console.log('Set HTML Audio volume to', newVolume / 100.0, 'for peer:', peerId);
       }
     }
     
     // Сохраняем предыдущий уровень громкости если он не 0
     if (newVolume > 0) {
       previousVolumesRef.current.set(peerId, newVolume);
     }
     
     // Обновляем состояние индивидуального мьюта на основе громкости
     const isIndividuallyMuted = newVolume === 0;
     individualMutedPeersRef.current.set(peerId, isIndividuallyMuted);
     
     // Обновляем UI состояние
     setVolumes(prev => {
       const newVolumes = new Map(prev);
       newVolumes.set(peerId, newVolume);
       return newVolumes;
     });

     // Сохраняем громкость в IndexedDB только если это реальное изменение пользователем
     // (не при инициализации из сохраненных настроек)
     const currentSavedVolume = volumes.get(peerId);
     if (currentSavedVolume !== newVolume) {
       try {
         // Получаем реальный ID пользователя из маппинга
         const realUserId = userIdMappingRef.current.get(peerId) || peerId;
         
         await volumeStorage.saveUserVolume(realUserId, newVolume);
       } catch (error) {
         console.error('Failed to save volume for user:', peerId, error);
       }
     }
   }, [volumes]);

   // Функция для переключения отображения слайдера громкости
   const toggleVolumeSlider = useCallback((peerId) => {
     console.log('toggleVolumeSlider called for peer:', peerId);
     setShowVolumeSliders(prev => {
       const newState = new Map(prev);
       const currentState = newState.get(peerId) || false;
       console.log('Current slider state for peer', peerId, ':', currentState);
       if (currentState) {
         console.log('Hiding volume slider for peer:', peerId);
         newState.set(peerId, false);
       } else {
         console.log('Showing volume slider for peer:', peerId);
         newState.set(peerId, true);
       }
       console.log('New slider state for peer', peerId, ':', newState.get(peerId));
       return newState;
     });
   }, []);

  // Функция для получения реального ID пользователя из producer
  const getRealUserId = (producer, appData) => {
    return appData?.userId || producer.appData?.userId || producer.producerSocketId;
  };

  // Обновляем обработчик подключения пира
  const handlePeerJoined = useCallback(({ peerId }) => {
    // Инициализируем состояние - не замучен индивидуально
    individualMutedPeersRef.current.set(peerId, false);
    
    // Инициализируем предыдущий уровень громкости (будет загружен в _handleConsume)
    previousVolumesRef.current.set(peerId, 100);
    
    setVolumes(prev => {
      const newVolumes = new Map(prev);
      newVolumes.set(peerId, 100); // Временное значение, будет обновлено в _handleConsume
      return newVolumes;
    });
    
    setShowVolumeSliders(prev => {
      const newState = new Map(prev);
      newState.set(peerId, false);
      return newState;
    });
    
    console.log(`Peer joined: ${peerId}, volume will be loaded when audio stream is created`);
  }, []);

  // Обновляем обработчик отключения пира
  const handlePeerLeft = useCallback(({ peerId }) => {
    individualMutedPeersRef.current.delete(peerId);
    previousVolumesRef.current.delete(peerId);
         setVolumes(prev => {
       const newVolumes = new Map(prev);
       newVolumes.delete(peerId);
       return newVolumes;
     });
     setShowVolumeSliders(prev => {
       const newState = new Map(prev);
       newState.delete(peerId);
       return newState;
     });
   }, []);

  const _initializeDevice = async (routerRtpCapabilities) => {
    try {
      if (!deviceRef.current) {
        const device = new Device();
        if (routerRtpCapabilities) {
          await device.load({ routerRtpCapabilities });
        }
        deviceRef.current = device;
        console.log('Device initialized', routerRtpCapabilities ? 'with capabilities' : 'without capabilities');
      } else if (routerRtpCapabilities) {
        await deviceRef.current.load({ routerRtpCapabilities });
        console.log('Device reinitialized with capabilities');
      }
    } catch (error) {
      console.error('Failed to initialize device:', error);
      throw error;
    }
  };

  const createSendTransport = async () => {
    return new Promise((resolve, reject) => {
      console.log('Creating send transport...');
      socketRef.current.emit('createWebRtcTransport', async ({ error, ...params }) => {
        if (error) {
          console.error('Create send transport error:', error);
          setError(`Failed to create transport: ${error}`);
          reject(error);
          return;
        }

        try {
          console.log('Send transport parameters:', params);
          const transport = deviceRef.current.createSendTransport({
            ...params,
            iceServers: config.iceServers,
            iceTransportPolicy: 'all',
            iceCandidatePoolSize: 10
          });

          transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            try {
              console.log('Send transport connect event');
              socketRef.current.emit('connectTransport', {
                transportId: transport.id,
                dtlsParameters,
              }, (response) => {
                if (response?.error) {
                  console.error('Connect transport error:', response.error);
                  errback(new Error(response.error));
                  return;
                }
                console.log('Send transport connected successfully');
                callback();
              });
            } catch (error) {
              console.error('Transport connect error:', error);
              errback(error);
            }
          });

          transport.on('connectionstatechange', async (state) => {
            console.log('Send transport connection state changed:', state);
            if (state === 'connected') {
              console.log('Send transport connected');
            } else if (state === 'failed' || state === 'disconnected') {
              console.error('Send transport failed or disconnected, attempting reconnection...');
              try {
                const { iceParameters, error } = await new Promise((resolve) => {
                  socketRef.current.emit('restartIce', { transportId: transport.id }, resolve);
                });

                if (error) {
                  throw new Error(error);
                }

                if (iceParameters) {
                  await transport.restartIce({ iceParameters });
                  console.log('Send transport ICE restarted successfully');
                }
              } catch (error) {
                console.error('Failed to restart send transport ICE:', error);
                setError('Connection failed. Please try rejoining the room.');
              }
            }
          });

          transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
            try {
              console.log('Send transport produce event:', { kind });
              socketRef.current.emit('produce', {
                transportId: transport.id,
                kind,
                rtpParameters,
                appData
              }, (response) => {
                if (response?.error) {
                  console.error('Produce error:', response.error);
                  errback(new Error(response.error));
                  return;
                }
                console.log('Producer created successfully:', response.id);
                callback({ id: response.id });
              });
            } catch (error) {
              console.error('Transport produce error:', error);
              errback(error);
            }
          });

          producerTransportRef.current = transport;
          resolve(transport);
        } catch (error) {
          console.error('Failed to create send transport:', error);
          setError(`Failed to create transport: ${error.message}`);
          reject(error);
        }
      });
    });
  };

  const createLocalStream = async () => {
    try {
      console.log('Creating local stream...');
      
      // Always start with audio enabled
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
          sampleSize: 16,
          latency: 0,
          volume: 1.0,
          enabled: true // Ensure audio starts enabled
        },
        video: false
      });

      localStreamRef.current = stream;
      
      // Initialize audio context and noise suppression
      noiseSuppressionRef.current = new NoiseSuppressionManager();
      
      // Initialize noise suppression with the stream
      await noiseSuppressionRef.current.initialize(stream, audioContextRef.current);
      
      // Get the processed stream for the producer
      const processedStream = noiseSuppressionRef.current.getProcessedStream();
      const track = processedStream.getAudioTracks()[0];
      
      if (!track) {
        throw new Error('No audio track in processed stream');
      }
      
      // Ensure track settings are applied
      const settings = track.getSettings();
      console.log('Final audio track settings:', settings);

      // Set track enabled state based on initial mute state
      track.enabled = !initialMuted; // Track enabled opposite of mute state
      
      // Also set the original stream track to the same state
      const originalTrack = localStreamRef.current.getAudioTracks()[0];
      if (originalTrack) {
        originalTrack.enabled = !initialMuted;
      }
      
      if (isNoiseSuppressed) {
        const enableResult = await noiseSuppressionRef.current.enable(noiseSuppressionMode);
        if (!enableResult) {
          console.warn('Failed to enable noise suppression, continuing without it');
        }
      }

      if (!producerTransportRef.current) {
        throw new Error('Producer transport not initialized');
      }

      // Add analyzer for voice activity detection
      const source = audioContextRef.current.createMediaStreamSource(processedStream);
      const analyser = createAudioAnalyser(audioContextRef.current);
      source.connect(analyser);

      // Store analyser reference
      analyserNodesRef.current.set(socketRef.current.id, analyser);

      // Start voice detection
      detectSpeaking(analyser, socketRef.current.id);
      
      console.log('Creating audio producer...');
      const producer = await producerTransportRef.current.produce({ 
        track,
        codecOptions: {
          opusStereo: true,
          opusDtx: true,
          opusFec: true,
          opusNack: true
        },
        appData: {
          streamId: processedStream.id
        }
      });
      
      console.log('Audio producer created:', producer.id);
      producersRef.current.set(producer.id, producer);

      // Set producer in noise suppression manager
      if (noiseSuppressionRef.current) {
        noiseSuppressionRef.current.setProducer(producer);
      }

      // Monitor producer state
      producer.on('transportclose', () => {
        console.log('Producer transport closed');
        producer.close();
        producersRef.current.delete(producer.id);
      });

      producer.on('trackended', () => {
        console.log('Local track ended');
        producer.close();
        producersRef.current.delete(producer.id);
      });

      return producer;
    } catch (error) {
      console.error('Failed to create local stream:', error);
      throw error;
    }
  };

  const createConsumerTransport = async () => {
    console.log('Creating consumer transport...');
    const { error, ...params } = await new Promise((resolve) => {
      socketRef.current.emit('createWebRtcTransport', resolve);
    });

    if (error) {
      console.error('Failed to create consumer transport:', error);
      throw new Error('Failed to create consumer transport');
    }

    console.log('Consumer transport parameters:', params);

    const transport = deviceRef.current.createRecvTransport({
      ...params,
      iceServers: config.iceServers,
      iceTransportPolicy: 'all',
      iceCandidatePoolSize: 10
    });

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      console.log('Consumer transport connect event');
      socketRef.current.emit('connectTransport', {
        transportId: transport.id,
        dtlsParameters,
      }, (error) => {
        if (error) {
          console.error('Consumer transport connect error:', error);
          errback(error);
          return;
        }
        console.log('Consumer transport connected successfully');
        callback();
      });
    });

    transport.on('connectionstatechange', async (state) => {
      console.log('Consumer transport connection state changed:', state);
      if (state === 'connected') {
        console.log('Consumer transport connected');
      } else if (state === 'failed' || state === 'disconnected') {
        console.error('Consumer transport failed or disconnected, attempting reconnection...');
        try {
          const { iceParameters, error } = await new Promise((resolve) => {
            socketRef.current.emit('restartIce', { transportId: transport.id }, resolve);
          });

          if (error) {
            throw new Error(error);
          }

          if (iceParameters) {
            await transport.restartIce({ iceParameters });
            console.log('Consumer transport ICE restarted successfully');
          }
        } catch (error) {
          console.error('Failed to restart consumer transport ICE:', error);
          setError('Connection failed. Please try rejoining the room.');
        }
      }
    });

    consumerTransportsRef.current.set(transport.id, transport);
    return transport;
  };

  const removeConsumer = (consumerId) => {
    try {
      console.log('Removing consumer:', consumerId);
      const consumer = consumersRef.current.get(consumerId);
      if (consumer) {
        // Закрываем consumer
        consumer.close();
        consumersRef.current.delete(consumerId);
        
        // Находим и удаляем соответствующее видео
        setRemoteVideos(prev => {
          const newVideos = new Map(prev);
          for (const [peerId, videoData] of newVideos.entries()) {
            if (videoData.consumerId === consumerId) {
              console.log('Found and removing video for consumer:', consumerId);
              // Останавливаем треки
              if (videoData.stream) {
                videoData.stream.getTracks().forEach(track => {
                  track.stop();
                });
              }
              newVideos.delete(peerId);
              break;
            }
          }
          return newVideos;
        });

        // Очищаем аудио узлы
        // Находим producerSocketId по consumer
        let producerSocketId = null;
        for (const [, cons] of consumersRef.current.entries()) {
          if (cons === consumer) {
            // Ищем соответствующий peerId в gainNodes
            for (const [socketId, gainNode] of gainNodesRef.current.entries()) {
              if (gainNode) {
                producerSocketId = socketId;
                break;
              }
            }
            break;
          }
        }
        
        if (producerSocketId) {
          const gainNode = gainNodesRef.current.get(producerSocketId);
          if (gainNode) {
            gainNode.disconnect();
            gainNodesRef.current.delete(producerSocketId);
          }

          const analyser = analyserNodesRef.current.get(producerSocketId);
          if (analyser) {
            analyser.disconnect();
            analyserNodesRef.current.delete(producerSocketId);
          }

          // Очищаем voice detector и интервалы если есть
          const peerAudio = audioRef.current.get(producerSocketId);
          if (peerAudio instanceof Map) {
            if (peerAudio.has('voiceDetector')) {
              const voiceDetector = peerAudio.get('voiceDetector');
              if (voiceDetector) {
                voiceDetector.port.close();
                voiceDetector.disconnect();
              }
            }
                      if (peerAudio.has('gainCheckInterval')) {
            const interval = peerAudio.get('gainCheckInterval');
            if (interval) {
              clearInterval(interval);
            }
          }
          if (peerAudio.has('audioCheckInterval')) {
            const interval = peerAudio.get('audioCheckInterval');
            if (interval) {
              clearInterval(interval);
            }
          }
            if (peerAudio.has('audioCheckInterval')) {
              const interval = peerAudio.get('audioCheckInterval');
              if (interval) {
                clearInterval(interval);
              }
            }
          }
          audioRef.current.delete(producerSocketId);

          setVolumes(prev => {
            const newVolumes = new Map(prev);
            newVolumes.delete(producerSocketId);
            return newVolumes;
          });
        }
      }
    } catch (error) {
      console.error('Error removing consumer:', error);
    }
  };

  const handleLeaveCall = () => {
    console.log('Leaving voice call...');
    
    // Уведомляем сервер о выходе пользователя из голосового канала
    if (roomId && socketRef.current) {
      socketRef.current.emit('userLeftVoiceChannel', {
        channelId: roomId,
        userId: userId
      });

      // Обновляем глобальное состояние пользователя на сервере
      leaveVoiceChannel(userId);
      
      // Запрашиваем обновленные данные о участниках несколько раз с интервалом
      setTimeout(() => {
        socketRef.current.emit('getVoiceChannelParticipants');
      }, 500);
      
      setTimeout(() => {
        socketRef.current.emit('getVoiceChannelParticipants');
      }, 1500);
      
      setTimeout(() => {
        socketRef.current.emit('getVoiceChannelParticipants');
      }, 3000);
      
      // Дополнительно запрашиваем обновление сразу после отправки уведомления
      socketRef.current.emit('getVoiceChannelParticipants');
    }
    
    // Очищаем локальное состояние
    cleanup();
    setIsJoined(false);
    setPeers(new Map());
    setVolumes(new Map());
    setError('');
    // Отключаем сокет
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    // Вызываем callback если есть
    if (onManualLeave) {
      onManualLeave();
    }
    // Вызываем callback если есть
    if (onLeave) {
      onLeave();
    }
    console.log('Voice call left successfully');
  };

  const startScreenSharing = async () => {
    try {
      if (!producerTransportRef.current) {
        throw new Error('Transport not ready');
      }

      // Stop any existing screen sharing first
      if (isScreenSharing) {
        await stopScreenSharing();
      }

      console.log('Requesting screen sharing access...');
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          frameRate: { ideal: 60, max: 60 },
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          aspectRatio: 16/9,
          displaySurface: 'monitor',
          resizeMode: 'crop-and-scale'
        },
        audio: false
      });

      console.log('Screen sharing access granted');

      // Handle stream stop
      screenStream.getVideoTracks()[0].onended = () => {
        console.log('Screen sharing stopped by user');
        stopScreenSharing();
      };

      // Set stream first
      setScreenStream(screenStream);

      const videoTrack = screenStream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('No video track available');
      }

      console.log('Creating screen sharing producer...');
      const videoProducer = await producerTransportRef.current.produce({
        track: videoTrack,
        encodings: [
          {
            // Используем полное разрешение 1080p
            scaleResolutionDownBy: 1,
            maxBitrate: 5000000, // 5 Mbps для Full HD
            maxFramerate: 60
          }
        ],
        codecOptions: {
          videoGoogleStartBitrate: 3000, // Начальный битрейт 3 Mbps
          videoGoogleMaxBitrate: 5000 // Максимальный битрейт 5 Mbps
        },
        appData: {
          mediaType: 'screen',
          width: videoTrack.getSettings().width,
          height: videoTrack.getSettings().height,
          frameRate: videoTrack.getSettings().frameRate
        }
      });

      console.log('Screen sharing producer created:', videoProducer.id);

      // Set producer after successful creation
      setScreenProducer(videoProducer);
      setIsScreenSharing(true);

      // Handle producer events
      videoProducer.on('transportclose', () => {
        console.log('Screen sharing transport closed');
        stopScreenSharing();
      });

      videoProducer.on('trackended', () => {
        console.log('Screen sharing track ended');
        stopScreenSharing();
      });

    } catch (error) {
      console.error('Error starting screen share:', error);
      // Make sure to clean up if there's an error
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }
      setScreenStream(null);
      setScreenProducer(null);
      setIsScreenSharing(false);
      setError('Failed to start screen sharing: ' + error.message);
    }
  };

  const stopScreenSharing = async () => {
    console.log('Stopping screen sharing...');

    try {
      // Сначала уведомляем сервер для обработки удаления на удаленной стороне
      if (screenProducer && socketRef.current) {
        socketRef.current.emit('stopScreenSharing', {
          producerId: screenProducer.id
        });
      }

      // Удаляем только свой локальный экран
      setRemoteScreens(prev => {
        const newScreens = new Map(prev);
        if (socketRef.current) {
          newScreens.delete(socketRef.current.id);
        }
        return newScreens;
      });

      // Закрываем producer
      if (screenProducer) {
        screenProducer.close();
        setScreenProducer(null);
      }

      // Останавливаем все треки в потоке экрана
      if (screenStream) {
        const tracks = screenStream.getTracks();
        tracks.forEach(track => {
          track.stop();
          screenStream.removeTrack(track);
        });
        setScreenStream(null);
      }

      setIsScreenSharing(false);
    } catch (error) {
      console.error('Error stopping screen share:', error);
      // Принудительная очистка даже при ошибке
      setScreenProducer(null);
      setScreenStream(null);
      setIsScreenSharing(false);
    }
  };

  const startVideo = async () => {
    try {
      if (!producerTransportRef.current) {
        throw new Error('Transport not ready');
      }

      // Остановить текущее видео если есть
      if (isVideoEnabled) {
        await stopVideo();
      }

      console.log('Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
          frameRate: { ideal: 60, max: 60 },
          facingMode: 'user',
          aspectRatio: { ideal: 16/9 }
        }
      });

      console.log('Camera access granted');

      // Обработка остановки трека
      stream.getVideoTracks()[0].onended = () => {
        console.log('Camera track ended');
        stopVideo();
      };

      // Сохраняем поток
      setVideoStream(stream);

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('No video track available');
      }

      console.log('Creating video producer...');
      const producer = await producerTransportRef.current.produce({
        track: videoTrack,
        encodings: [
          { maxBitrate: 1500000, scaleResolutionDownBy: 1, maxFramerate: 60 }
        ],
        codecOptions: {
          videoGoogleStartBitrate: 1500,
          videoGoogleMaxBitrate: 3000
        },
        appData: {
          mediaType: 'webcam'
        }
      });

      console.log('Video producer created:', producer.id);

      // Сохраняем producer
      setVideoProducer(producer);
      setIsVideoEnabled(true);

      // Обработчики событий producer
      producer.on('transportclose', () => {
        console.log('Video transport closed');
        stopVideo();
      });

      producer.on('trackended', () => {
        console.log('Video track ended');
        stopVideo();
      });

    } catch (error) {
      console.error('Error starting video:', error);
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
      setVideoStream(null);
      setVideoProducer(null);
      setIsVideoEnabled(false);
      setError('Failed to start video: ' + error.message);
    }
  };

  const stopVideo = async () => {
    console.log('Stopping video...');

    try {
      // Сначала закрываем producer
      if (videoProducer) {
        console.log('Closing video producer:', videoProducer.id);
        videoProducer.close();
        
        // Уведомляем сервер о закрытии producer'а
        if (socketRef.current) {
          console.log('Notifying server about video producer closure');
          socketRef.current.emit('producerClosed', {
            producerId: videoProducer.id,
            producerSocketId: socketRef.current.id,
            mediaType: 'webcam'
          });
        }
        setVideoProducer(null);
      }

      // Останавливаем треки
      if (videoStream) {
        console.log('Stopping video tracks');
        videoStream.getTracks().forEach(track => {
          track.stop();
        });
        setVideoStream(null);
      }

      setIsVideoEnabled(false);
    } catch (error) {
      console.error('Error stopping video:', error);
      setVideoProducer(null);
      setVideoStream(null);
      setIsVideoEnabled(false);
    }
  };

  const detectSpeaking = async (analyser, peerId, producerId = null) => {
    try {
      console.log('Initializing voice detection for peer:', peerId, 'producerId:', producerId);
      
      if (!audioContextRef.current) {
        console.error('AudioContext not initialized');
        return;
      }

      if (!audioContextRef.current.audioWorklet) {
        console.error('AudioWorklet not supported');
        return;
      }

      // Очищаем старый voice detector если существует
      const existingPeerAudio = audioRef.current.get(peerId);
      if (existingPeerAudio instanceof Map && existingPeerAudio.has('voiceDetector')) {
        const oldVoiceDetector = existingPeerAudio.get('voiceDetector');
        if (oldVoiceDetector) {
          console.log('Cleaning up old voice detector for peer:', peerId);
          oldVoiceDetector.port.close();
          oldVoiceDetector.disconnect();
          existingPeerAudio.delete('voiceDetector');
        }
      }

      // Загружаем воркер если еще не загружен
      try {
        await audioContextRef.current.audioWorklet.addModule(voiceDetectorWorklet);
        console.log('Voice detector worklet loaded successfully');
      } catch (error) {
        console.error('Failed to load voice detector worklet:', error);
        return;
      }

      // Создаем узел воркера
      const voiceDetectorNode = new AudioWorkletNode(audioContextRef.current, 'voice-detector', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1
      });
      
      console.log('Voice detector node created');

      // Получаем поток для обработки
      let stream;
      if (peerId === socketRef.current?.id) {
        stream = noiseSuppressionRef.current?.getProcessedStream() || localStreamRef.current;
        console.log('Using local stream for voice detection');
      } else {
        // Добавляем механизм повторных попыток для получения consumer'а
        let retries = 0;
        const maxRetries = 5;
        const retryDelay = 1000; // 1 секунда между попытками

        while (retries < maxRetries) {
          // Сначала пытаемся найти по producerId если он есть
          let consumer;
          if (producerId) {
            consumer = [...consumersRef.current.values()].find(c => c.producerId === producerId);
            console.log('Searching consumer by producerId:', producerId, 'found:', !!consumer);
          }
          
          // Если не нашли по producerId, пробуем по peerId
          if (!consumer) {
            consumer = [...consumersRef.current.values()].find(c => 
              c.appData?.peerId === peerId && c.kind === 'audio'
            );
            console.log('Searching consumer by peerId:', peerId, 'found:', !!consumer);
          }
          
          if (consumer) {
            stream = new MediaStream([consumer.track]);
            console.log('Found consumer and created stream for peer:', peerId);
            break;
          }

          console.log(`Attempt ${retries + 1}/${maxRetries} to get consumer for peer:`, peerId);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retries++;
        }

        if (!stream) {
          console.error(`Failed to get consumer for peer ${peerId} after ${maxRetries} attempts`);
          return;
        }
      }

      if (!stream) {
        console.error('No stream available for voice detection');
        return;
      }

      // Отключаем старые соединения
      analyser.disconnect();
      console.log('Disconnected old analyzer');

      // Создаем новый источник из потока
      const source = audioContextRef.current.createMediaStreamSource(stream);
      console.log('Created media stream source');

      // Подключаем узлы
      source.connect(voiceDetectorNode);
      console.log('Connected source to voice detector');

      // Обработчик сообщений от воркера
      voiceDetectorNode.port.onmessage = (event) => {
        const { speaking } = event.data;
        console.log('Voice detection event:', { peerId, speaking });
        
        // Проверяем реальное состояние мьюта через трек, а не только через состояние
        let actuallyMuted = false;
        if (peerId === socketRef.current?.id) {
          // Для локального пользователя проверяем трек
          const processedStream = noiseSuppressionRef.current?.getProcessedStream();
          const localStream = localStreamRef.current;
          const track = processedStream?.getAudioTracks()[0] || localStream?.getAudioTracks()[0];
          actuallyMuted = !track || !track.enabled;
                 } else {
           // Для удаленных пользователей проверяем volume через ref
           actuallyMuted = (volumesRef.current.get(peerId) || 100) === 0;
         }
         
         if (actuallyMuted) {
           if (speakingStatesRef.current.get(peerId)) {
            setSpeakingStates(prev => {
              const newStates = new Map(prev);
              newStates.set(peerId, false);
              return newStates;
            });
            if (socketRef.current && peerId === socketRef.current.id) {
              socketRef.current.emit('speaking', { speaking: false });
            }
          }
          return;
        }

        // Обновляем состояние говорения
        setSpeakingStates(prev => {
          const newStates = new Map(prev);
          newStates.set(peerId, speaking);
          return newStates;
        });
        
        // Отправляем состояние на сервер только для локального пользователя
        if (socketRef.current && peerId === socketRef.current.id) {
          socketRef.current.emit('speaking', { speaking });
        }
      };

      // Сохраняем ссылку на узел для очистки
      if (!audioRef.current.has(peerId)) {
        audioRef.current.set(peerId, new Map());
      }
      audioRef.current.get(peerId).set('voiceDetector', voiceDetectorNode);

      console.log('Voice detection setup completed for peer:', peerId);
    } catch (error) {
      console.error('Error in voice detection setup:', error);
    }
  };

  // Update analyzer settings when creating audio nodes
  const createAudioAnalyser = (audioContext) => {
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;  // Higher FFT size for better frequency resolution
    analyser.smoothingTimeConstant = 0.2;  // Reduced for faster response
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    return analyser;
  };

  // Обновляем renderScreenShares - теперь только для полноэкранного режима
  const renderScreenShares = useMemo(() => {
    // Only render fullscreen mode
    if (fullscreenShare !== null) {
      const screenData = fullscreenShare === socketRef.current?.id ? 
        { stream: screenStream, name: userName } : 
        { 
          stream: remoteScreens.get(fullscreenShare)?.stream,
          name: peers.get(fullscreenShare)?.name
        };

      if (!screenData.stream) {
        setFullscreenShare(null);
        return null;
      }

      return (
        <Box sx={styles.fullscreenOverlay}>
          <Box sx={styles.fullscreenVideoContainer}>
            <VideoPlayer 
              stream={screenData.stream}
              style={styles.fullscreenVideo}
            />
            <Box sx={styles.fullscreenControls}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ScreenShare sx={{ color: '#fff', fontSize: 24 }} />
                <Typography sx={{ color: '#fff', fontWeight: 500 }}>
                  {screenData.name}
                </Typography>
              </Box>
              <IconButton
                onClick={() => handleFullscreenToggle(fullscreenShare)}
                sx={styles.fullscreenButton}
              >
                <FullscreenExit sx={{ fontSize: 28 }} />
              </IconButton>
            </Box>
          </Box>
        </Box>
      );
    }

    // If not in fullscreen mode, don't render anything
    return null;
  }, [isScreenSharing, screenStream, remoteScreens, peers, userName, fullscreenShare, socketRef.current?.id]);







  // Add function to list all peers (accessible via console)
  window.listPeers = () => {
    console.log('Available peers:');
    const peerList = Array.from(peers.entries()).map(([id, peer]) => ({
      id,
      name: peer.name,
      hasGainNode: gainNodesRef.current.has(id),
      gainValue: gainNodesRef.current.get(id)?.gain?.value || 'N/A'
    }));
    console.table(peerList);
    return peerList;
  };
  
  // Add function to check track details
  window.checkTrackDetails = (peerId) => {
    console.log('Checking track details for peer:', peerId);
    const consumer = [...consumersRef.current.values()].find(c => 
      c.appData?.peerId === peerId || 
      [...peers.keys()].includes(peerId)
    );
    
    if (consumer) {
      const track = consumer.track;
      console.log('Track details:', {
        id: track.id,
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        settings: track.getSettings(),
        constraints: track.getConstraints(),
        capabilities: track.getCapabilities()
      });
      
      // Check consumer stats
      const checkStats = async () => {
        try {
          const stats = await consumer.getStats();
          console.log('Consumer WebRTC stats:');
          stats.forEach((report) => {
            if (report.type === 'inbound-rtp' && report.kind === 'audio') {
              console.log('Audio RTP report:', {
                packetsReceived: report.packetsReceived,
                packetsLost: report.packetsLost,
                bytesReceived: report.bytesReceived,
                audioLevel: report.audioLevel,
                totalAudioEnergy: report.totalAudioEnergy,
                jitter: report.jitter,
                fractionLost: report.fractionLost
              });
            }
          });
        } catch (error) {
          console.error('Failed to get consumer stats:', error);
        }
      };
      
      // Check stats immediately and then every 2 seconds
      checkStats();
      const statsInterval = setInterval(checkStats, 2000);
      
      // Check if track is producing audio
      const stream = new MediaStream([track]);
      const audioContext = audioContextRef.current;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const checkAudio = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const max = Math.max(...dataArray);
        console.log(`Real-time audio check: average=${average}, max=${max}`);
      };
      
      console.log('Starting 10-second audio and stats monitoring...');
      const audioInterval = setInterval(checkAudio, 500);
      setTimeout(() => {
        clearInterval(audioInterval);
        clearInterval(statsInterval);
        source.disconnect();
        analyser.disconnect();
        console.log('Audio and stats monitoring completed');
      }, 10000);
    } else {
      console.log('Consumer not found for peer:', peerId);
    }
  };

  // Make refs available for debugging
  window.consumersRef = consumersRef;
  window.gainNodesRef = gainNodesRef;
  window.audioContextRef = audioContextRef;
  
  // Add function to force consumer refresh
  window.forceConsumerRefresh = async (peerId) => {
    console.log('Forcing consumer refresh for peer:', peerId);
    const consumer = [...consumersRef.current.values()].find(c => 
      c.appData?.peerId === peerId || 
      [...peers.keys()].includes(peerId)
    );
    
    if (consumer) {
      try {
        console.log('Pausing consumer...');
        await consumer.pause();
        console.log('Consumer paused');
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('Resuming consumer...');
        await consumer.resume();
        console.log('Consumer resumed');
        
        // Request server to resume as well
        socketRef.current.emit('resumeConsumer', { consumerId: consumer.id }, (error) => {
          if (error) {
            console.error('Server resume failed:', error);
          } else {
            console.log('Server consumer resumed');
          }
        });
        
      } catch (error) {
        console.error('Failed to refresh consumer:', error);
      }
    } else {
      console.log('Consumer not found for peer:', peerId);
    }
  };
  




  // Add noise suppression toggle handler
  const handleNoiseSuppressionToggle = async () => {
    try {
      if (!noiseSuppressionRef.current || !localStreamRef.current) {
        console.error('Noise suppression or stream not initialized');
        return;
      }

      const newState = !isNoiseSuppressed;
      let success = false;

      if (newState) {
        success = await noiseSuppressionRef.current.enable(noiseSuppressionMode);
      } else {
        success = await noiseSuppressionRef.current.disable();
      }

      if (success) {
        setIsNoiseSuppressed(newState);
        localStorage.setItem('noiseSuppression', JSON.stringify(newState));
        console.log('Noise suppression ' + (newState ? 'enabled' : 'disabled'));
      } else {
        console.error('Failed to toggle noise suppression');
      }
    } catch (error) {
      console.error('Error toggling noise suppression:', error);
    }
  };

  // Add noise suppression menu handlers
  const handleNoiseSuppressionMenuOpen = (event) => {
    setNoiseSuppressMenuAnchor(event.currentTarget);
  };

  const handleNoiseSuppressionMenuClose = () => {
    setNoiseSuppressMenuAnchor(null);
  };

  const handleNoiseSuppressionModeSelect = async (mode) => {
    try {
      if (!noiseSuppressionRef.current || !localStreamRef.current) {
        console.error('Noise suppression or stream not initialized');
        return;
      }

      let success = false;

      if (!isNoiseSuppressed) {
        success = await noiseSuppressionRef.current.enable(mode);
      } else if (mode !== noiseSuppressionMode) {
        // Если меняем режим при включенном шумоподавлении
        success = await noiseSuppressionRef.current.enable(mode);
      }

      if (success) {
        setNoiseSuppressionMode(mode);
        setIsNoiseSuppressed(true);
        localStorage.setItem('noiseSuppression', JSON.stringify(true));
        console.log('Noise suppression mode changed to:', mode);
      }
    } catch (error) {
      console.error('Error changing noise suppression mode:', error);
    }
    handleNoiseSuppressionMenuClose();
  };

  const _handleConsume = async (producer) => {
    try {
      
      if (producer.producerSocketId === socketRef.current.id) {
        console.log('Skipping own producer');
        return;
      }
      
      const transport = await createConsumerTransport();
      console.log('Consumer transport created:', transport.id);
      
      const { rtpCapabilities } = deviceRef.current;
      
      const { id, producerId, kind, rtpParameters, appData } = await new Promise((resolve, reject) => {
        socketRef.current.emit('consume', {
          rtpCapabilities,
          remoteProducerId: producer.producerId,
          transportId: transport.id
        }, (response) => {
          if (response.error) {
            console.error('Consume request failed:', response.error);
            reject(new Error(response.error));
            return;
          }
          resolve(response);
        });
      });

      if (!id || !producerId || !kind || !rtpParameters) {
        throw new Error('Invalid consumer data received from server');
      }

      const consumer = await transport.consume({
        id,
        producerId,
        kind,
        rtpParameters,
        appData
      });

      console.log('Consumer created:', consumer.id);
      consumersRef.current.set(consumer.id, consumer);

      const stream = new MediaStream([consumer.track]);

      if (appData?.mediaType === 'screen') {
        console.log('Processing screen sharing stream:', { kind, appData });
        
        if (kind === 'video') {
          console.log('Setting up screen sharing video');
          setRemoteScreens(prev => {
            const newScreens = new Map(prev);
            newScreens.set(producer.producerSocketId, { 
              producerId,
              consumerId: consumer.id,
              stream
            });
            return newScreens;
          });
        }
      } else if (appData?.mediaType === 'webcam') {
        console.log('Processing webcam stream:', { kind, appData });
        
        if (kind === 'video') {
          console.log('Setting up webcam stream');
          setRemoteVideos(prev => {
            const newVideos = new Map(prev);
            newVideos.set(producer.producerSocketId, {
              producerId,
              consumerId: consumer.id,
              stream
            });
            return newVideos;
          });
        }
      } else if (kind === 'audio') {
        try {
          // Create audio context and nodes for Web Audio API processing
          const audioContext = audioContextRef.current;
          console.log('handleConsume: AudioContext state:', audioContext.state);
          
          // Resume audio context if suspended
          if (audioContext.state === 'suspended') {
            console.log('handleConsume: Resuming suspended AudioContext...');
            await audioContext.resume();
            console.log('handleConsume: AudioContext resumed, new state:', audioContext.state);
          }
          
          // Проверяем, что поток содержит активные треки
          const audioTracks = stream.getAudioTracks();
          console.log('handleConsume: Stream audio tracks:', audioTracks.length);
          audioTracks.forEach((track, index) => {
            console.log(`handleConsume: Track ${index}:`, {
              enabled: track.enabled,
              muted: track.muted,
              readyState: track.readyState,
              label: track.label,
              settings: track.getSettings()
            });
          });
          
          const source = audioContext.createMediaStreamSource(stream);
          console.log('handleConsume: Created MediaStreamSource from stream');
          
          // Debug: Check if MediaStreamSource is receiving audio data
          const debugAnalyser = audioContext.createAnalyser();
          debugAnalyser.fftSize = 256;
          source.connect(debugAnalyser);
          
          const checkAudioData = () => {
            const dataArray = new Uint8Array(debugAnalyser.frequencyBinCount);
            debugAnalyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            console.log(`handleConsume: Audio data for peer ${producer.producerSocketId}: average=${average}, max=${Math.max(...dataArray)}`);
          };
          
          // Check audio data every 2 seconds
          const audioCheckInterval = setInterval(checkAudioData, 2000);
          
          // Store interval for cleanup
          if (!audioRef.current.has(producer.producerSocketId)) {
            audioRef.current.set(producer.producerSocketId, new Map());
          }
          audioRef.current.get(producer.producerSocketId).set('audioCheckInterval', audioCheckInterval);
          
          const analyser = createAudioAnalyser(audioContext);
          
          // Create gain node для регулировки громкости
          const gainNode = audioContext.createGain();
          
                            // Получаем реальный ID пользователя
          console.log('About to get realUserId for producer:', producer.producerSocketId);
          const realUserId = getRealUserId(producer, appData);
        
        console.log('Consumer appData and realUserId:', {
          producerSocketId: producer.producerSocketId,
          appData: appData,
          producerAppData: producer.appData,
          realUserId: realUserId,
          appDataUserId: appData?.userId,
          producerAppDataUserId: producer.appData?.userId
        });
          
          // Сохраняем маппинг между producerSocketId и реальным userId
          userIdMappingRef.current.set(producer.producerSocketId, realUserId);
          console.log('Updated userIdMapping:', {
            producerSocketId: producer.producerSocketId,
            realUserId: realUserId,
            userIdMapping: Array.from(userIdMappingRef.current.entries())
          });
          
          // Получаем сохраненную громкость для этого пользователя
          let savedVolume = 100; // Значение по умолчанию
          try {
            savedVolume = await volumeStorage.getUserVolume(realUserId);
          } catch (error) {
            console.error('Failed to load saved volume for user:', realUserId, error);
          }
          
          // Начальная громкость из сохраненных настроек
          const isIndividuallyMuted = individualMutedPeersRef.current.get(producer.producerSocketId) ?? false;
          const initialVolume = isIndividuallyMuted ? 0 : savedVolume;
          const initialGain = isAudioEnabledRef.current && !isIndividuallyMuted ? (initialVolume / 100.0) * 4.0 : 0;
          gainNode.gain.value = initialGain;
          
          // Обновляем предыдущий уровень громкости
          previousVolumesRef.current.set(producer.producerSocketId, savedVolume);
          
          console.log('handleConsume: Created gain node for peer:', producer.producerSocketId, {
            isAudioEnabled: isAudioEnabledRef.current,
            isIndividuallyMuted,
            savedVolume,
            initialVolume,
            initialGain
          });

          // Подключаем цепочку аудио узлов
          source.connect(analyser);
          analyser.connect(gainNode);
          gainNode.connect(audioContext.destination);
          console.log('handleConsume: Connected audio nodes: source -> analyser -> gainNode -> destination');
          
          // Debug: Also connect debugAnalyser to the main chain for monitoring
          debugAnalyser.connect(analyser);
          
          // Добавляем периодическую проверку gain node
          const checkGainInterval = setInterval(() => {
            console.log(`handleConsume: Gain check for peer ${producer.producerSocketId}:`, {
              gainValue: gainNode.gain.value,
              isAudioEnabled: isAudioEnabledRef.current,
              individualVolume: volumes.get(producer.producerSocketId) || 100
            });
          }, 5000);
          
          // Сохраняем интервал для очистки
          if (!audioRef.current.has(producer.producerSocketId)) {
            audioRef.current.set(producer.producerSocketId, new Map());
          }
          audioRef.current.get(producer.producerSocketId).set('gainCheckInterval', checkGainInterval);

          analyserNodesRef.current.set(producer.producerSocketId, analyser);
          gainNodesRef.current.set(producer.producerSocketId, gainNode);
          setVolumes(prev => new Map(prev).set(producer.producerSocketId, savedVolume));

          // Start voice detection with producerId
          detectSpeaking(analyser, producer.producerSocketId, producer.producerId);
          console.log('handleConsume: Audio setup completed for peer:', producer.producerSocketId);
        } catch (error) {
          console.error('Error setting up audio:', error);
        }
      }

      consumer.on('transportclose', () => {
        console.log('Consumer transport closed');
        consumer.close();
        consumersRef.current.delete(consumer.id);
      });

      consumer.on('producerclose', () => {
        console.log('Producer closed');
        consumer.close();
        consumersRef.current.delete(consumer.id);
      });

      consumer.on('trackended', () => {
        console.log('Track ended');
        consumer.close();
        consumersRef.current.delete(consumer.id);
      });

      return consumer;
    } catch (error) {
      console.error('Error consuming producer:', error);
      throw error;
    }
  };

  // Update toggleAudio function
  const toggleAudio = useCallback(() => {
    const newState = !isAudioEnabled;
    setIsAudioEnabled(newState);
    isAudioEnabledRef.current = newState; // Update ref immediately

    // Emit audio state change
    if (socketRef.current) {
      socketRef.current.emit('audioState', { isEnabled: newState });
      
      // Update voice channel context for current user
      updateVoiceChannelParticipant(roomId, socketRef.current.id, { isAudioDisabled: !newState });

      // Обновляем глобальное состояние пользователя на сервере
      updateUserAudioState(userId, !newState);

      // Уведомляем сервер об изменении состояния участника
      socketRef.current.emit('voiceChannelParticipantStateChanged', {
        channelId: roomId,
        userId: socketRef.current.id,
        isAudioDisabled: !newState
      });
    }

    // Mute/unmute all gain nodes with individual volume levels
    gainNodesRef.current.forEach((gainNode, peerId) => {
      if (gainNode) {
        if (newState) {
          // При включении восстанавливаем индивидуальный уровень громкости
          const individualVolume = volumes.get(peerId) || 100;
          const gainValue = (individualVolume / 100.0) * 4.0; // 0-100% слайдера -> 0.0-4.0 gain
          gainNode.gain.value = gainValue;
        } else {
          // При выключении мутим всех
          gainNode.gain.value = 0.0;
        }
      }
    });

    // Вызываем коллбек для уведомления внешних компонентов
    if (onAudioStateChange) {
      onAudioStateChange(newState);
    }
  }, [isAudioEnabled, onAudioStateChange, volumes, userId, updateUserAudioState]);



  // Предоставляем внешним компонентам доступ к функциям управления
  useImperativeHandle(ref, () => ({
    handleMute,
    toggleAudio
  }), [handleMute, toggleAudio]);

  // Горячие клавиши обрабатываются глобально в Home.jsx

  // Add initial audio state when joining
  useEffect(() => {
    if (isJoined && socketRef.current) {
      socketRef.current.emit('audioState', { isEnabled: isAudioEnabled });
    }
  }, [isJoined, isAudioEnabled]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    // Add audio state change handler
    socket.on('peerAudioStateChanged', ({ peerId, isEnabled }) => {
      // Update voice channel context
      updateVoiceChannelParticipant(roomId, peerId, { isAudioDisabled: !isEnabled });

      // Уведомляем сервер об изменении состояния участника
      socket.emit('voiceChannelParticipantStateChanged', {
        channelId: roomId,
        userId: peerId,
        isAudioDisabled: !isEnabled
      });

      setAudioStates(prev => {
        const newStates = new Map(prev);
        newStates.set(peerId, isEnabled);
        return newStates;
      });
    });

    return () => {
      socket.off('peerAudioStateChanged');
    };
  }, [socketRef.current, roomId, updateVoiceChannelParticipant]);

  // Add effect to update isAudioEnabledRef
  useEffect(() => {
    isAudioEnabledRef.current = isAudioEnabled;
  }, [isAudioEnabled]);

  useEffect(() => {
    const socket = socketRef.current;
    if (socket) {
      socket.on('peerJoined', handlePeerJoined);
      socket.on('peerLeft', handlePeerLeft);
    }
    return () => {
      if (socket) {
        socket.off('peerJoined', handlePeerJoined);
        socket.off('peerLeft', handlePeerLeft);
      }
    };
  }, [handlePeerJoined, handlePeerLeft]);

  // Add fullscreen handlers
  const handleFullscreenToggle = (peerId) => {
    if (fullscreenShare === peerId) {
      setFullscreenShare(null);
    } else {
      setFullscreenShare(peerId);
    }
  };

  useEffect(() => {
    if (autoJoin && roomId && userName && !isJoined) {
      handleJoin();
    }
  }, [autoJoin, roomId, userName]);

  // Автоматический выход при размонтировании компонента
  useEffect(() => {
    return () => {
      console.log('VoiceChat component unmounting, cleaning up...');
      if (isJoined) {
        handleLeaveCall();
      }
    };
  }, [isJoined]);

  // Функция для вычисления адаптивной сетки
  const getAdaptiveGridStyle = useCallback((totalItems) => {
    if (totalItems <= 2) {
      return {
        gridTemplateColumns: 'repeat(2, 1fr)',
        gridTemplateRows: 'repeat(1, 1fr)',
        aspectRatio: '2/1'
      };
    } else if (totalItems <= 4) {
      return {
        gridTemplateColumns: 'repeat(2, 1fr)',
        gridTemplateRows: 'repeat(2, 1fr)',
        aspectRatio: '1/1'
      };
    } else if (totalItems <= 6) {
      return {
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(2, 1fr)',
        aspectRatio: '3/2'
      };
    } else {
      return {
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(3, 1fr)',
        aspectRatio: '1/1'
      };
    }
  }, []);

  // Функция для вычисления адаптивного размера аватара
  const getAdaptiveAvatarSize = useCallback((totalItems) => {
    if (totalItems <= 2) {
      return '120px'; // Большие аватары для 1-2 участников
    } else if (totalItems <= 4) {
      return '100px'; // Средние аватары для 3-4 участников
    } else if (totalItems <= 6) {
      return '80px';  // Меньшие аватары для 5-6 участников
    } else {
      return '60px';  // Маленькие аватары для 7+ участников
    }
  }, []);

  // Подсчет общего количества элементов в сетке
  const totalGridItems = useMemo(() => {
    let count = 1; // Локальный пользователь
    
    // Добавляем удаленных пользователей
    count += peers.size;
    
    // Добавляем локальную демонстрацию экрана
    if (isScreenSharing && screenStream) {
      count += 1;
    }
    
    // Добавляем удаленные демонстрации экрана
    count += remoteScreens.size;
    
    return count;
  }, [peers.size, isScreenSharing, screenStream, remoteScreens.size]);

  // Получаем стили для адаптивной сетки
  const adaptiveGridStyle = useMemo(() => {
    return getAdaptiveGridStyle(totalGridItems);
  }, [totalGridItems, getAdaptiveGridStyle]);

  // Получаем адаптивный размер аватара
  const adaptiveAvatarSize = useMemo(() => {
    return getAdaptiveAvatarSize(totalGridItems);
  }, [totalGridItems, getAdaptiveAvatarSize]);

  // Подготовка всех нужных пропсов для UI
  const ui = (
    <MuteProvider socket={socketRef.current}>
      <Box sx={{ 
      ...styles.root, 
      ...(showUI ? { 
        display: 'flex', 
        width: '100%', 
        height: '100%',
        ...(isVisible || isPrivateCall ? {
          position: 'relative',
          zIndex: 1
        } : {
          position: 'absolute',
          top: '-10000px',
          left: '-10000px',
          visibility: 'hidden',
          pointerEvents: 'none'
        })
      } : { 
        display: 'none' 
      }) 
    }}>
        {!isPrivateCall && (
          <AppBar position="static" sx={styles.appBar}>
            <Toolbar sx={styles.toolbar}>
              <Box sx={styles.channelName}>
                <Tag />
                <Typography variant="subtitle1">
                  {roomName || roomId}
                </Typography>
              </Box>
            </Toolbar>
          </AppBar>
        )}
        {error && (
          <Typography color="error" sx={{ p: 2 }}>
            {error}
          </Typography>
        )}
        <Box sx={styles.container}>
          <Box sx={{
            ...styles.videoGrid,
            ...adaptiveGridStyle
          }}>
            {/* Only render video grid when not in fullscreen mode */}
            {fullscreenShare === null && (
              <>
                {/* Local user */}
                <Box sx={styles.videoItem} className={speakingStates.get(socketRef.current?.id) ? 'speaking' : ''}>
                  {isVideoEnabled && videoStream ? (
                    <VideoView 
                      stream={videoStream} 
                      peerName={userName}
                      isMuted={isMuted}
                      isSpeaking={speakingStates.get(socketRef.current?.id)}
                      isAudioEnabled={isAudioEnabled}
                      isLocal={true}
                      isAudioMuted={isMuted}
                      colors={colors}
                    />
                  ) : (
                    <div style={{ 
                      position: 'relative', 
                      width: '100%', 
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}>
{(() => {
                        const avatarData = userProfiles.get(userId);
                        console.log('Rendering local user avatar:', { userId, userName, avatarData });
                        return (
                          <UserAvatar
                            username={userName}
                            avatarUrl={avatarData?.avatarUrl}
                            avatarColor={avatarData?.avatarColor}
                            size={adaptiveAvatarSize}
                            showStatus={false}
                          />
                        );
                      })()}
                      <VideoOverlay
                        peerName={userName}
                        isMuted={isMuted}
                        isSpeaking={speakingStates.get(socketRef.current?.id)}
                        isAudioEnabled={isAudioEnabled}
                        isLocal={true}
                        isAudioMuted={isMuted}
                        colors={colors}
                      />
                    </div>
                  )}
                </Box>

                {/* Local screen sharing */}
                {isScreenSharing && screenStream && (
                  <Box sx={styles.videoItem}>
                    <Box sx={styles.screenShareItem}>
                      <VideoPlayer stream={screenStream} />
                      <Box sx={styles.screenShareControls}>
                        <IconButton
                          onClick={() => handleFullscreenToggle(socketRef.current?.id)}
                          sx={styles.fullscreenButton}
                        >
                          <Fullscreen />
                        </IconButton>
                      </Box>
                      <Box sx={styles.screenShareUserName}>
                        <ScreenShare sx={{ fontSize: 16 }} />
                        {userName}
                      </Box>
                    </Box>
                  </Box>
                )}

                {/* Remote users */}
                {Array.from(peers.values()).map((peer) => (
                  <Box key={peer.id} sx={styles.videoItem} className={speakingStates.get(peer.id) ? 'speaking' : ''}>
                    {remoteVideos.get(peer.id)?.stream ? (
                      <VideoView
                        stream={remoteVideos.get(peer.id).stream}
                        peerName={peer.name}
                        isMuted={peer.isMuted}
                        isSpeaking={speakingStates.get(peer.id)}
                        isAudioEnabled={audioStates.get(peer.id)}
                        isLocal={false}
                        onVolumeClick={() => handleVolumeChange(peer.id)}
                        volume={volumes.get(peer.id) || 100}
                        isAudioMuted={individualMutedPeersRef.current.get(peer.id) || false}
                        showVolumeSlider={showVolumeSliders.get(peer.id) || false}
                        onVolumeSliderChange={(newVolume) => handleVolumeSliderChange(peer.id, newVolume)}
                        onToggleVolumeSlider={() => toggleVolumeSlider(peer.id)}
                        colors={colors}
                      />
                    ) : (
                      <div style={{ 
                        position: 'relative', 
                        width: '100%', 
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center'
                      }}>
{(() => {
                          const avatarData = userProfiles.get(peer.userId);
                          console.log('Rendering remote user avatar:', { peerId: peer.id, userId: peer.userId, name: peer.name, avatarData });
                          return (
                            <UserAvatar
                              username={peer.name}
                              avatarUrl={avatarData?.avatarUrl}
                              avatarColor={avatarData?.avatarColor}
                              size={adaptiveAvatarSize}
                              showStatus={false}
                            />
                          );
                        })()}
                        <VideoOverlay
                          peerName={peer.name}
                          isMuted={peer.isMuted}
                          isSpeaking={speakingStates.get(peer.id)}
                          isAudioEnabled={audioStates.get(peer.id)}
                          isLocal={false}
                          onVolumeClick={() => handleVolumeChange(peer.id)}
                          volume={volumes.get(peer.id) || 100}
                          isAudioMuted={individualMutedPeersRef.current.get(peer.id) || false}
                          showVolumeSlider={showVolumeSliders.get(peer.id) || false}
                          onVolumeSliderChange={(newVolume) => handleVolumeSliderChange(peer.id, newVolume)}
                          onToggleVolumeSlider={() => toggleVolumeSlider(peer.id)}
                          colors={colors}
                        />
                      </div>
                    )}
                  </Box>
                ))}

                {/* Remote screen sharing */}
                {Array.from(remoteScreens.entries()).map(([peerId, screenData]) => {
                  const peer = peers.get(peerId);
                  if (!peer) return null;

                  return (
                    <Box key={peerId} sx={styles.videoItem}>
                      <Box sx={styles.screenShareItem}>
                        <VideoPlayer stream={screenData?.stream || null} />
                        <Box sx={styles.screenShareControls}>
                          <IconButton
                            onClick={() => handleFullscreenToggle(peerId)}
                            sx={styles.fullscreenButton}
                          >
                            <Fullscreen />
                          </IconButton>
                        </Box>
                        <Box sx={styles.screenShareUserName}>
                          <ScreenShare sx={{ fontSize: 16 }} />
                          {peer.name}
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </>
            )}

            {/* Fullscreen screen sharing */}
            {fullscreenShare !== null && renderScreenShares}
          </Box>
          <Box sx={styles.bottomBar}>
            <Box sx={styles.controlsContainer}>
              <Box sx={styles.controlGroup}>
                <IconButton
                  sx={styles.iconButton}
                  onClick={handleMute}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <MicOff /> : <Mic />}
                </IconButton>
                <IconButton
                  sx={styles.iconButton}
                  onClick={toggleAudio}
                  title={isAudioEnabled ? "Disable audio output" : "Enable audio output"}
                >
                  {isAudioEnabled ? <Headset /> : <HeadsetOff />}
                </IconButton>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <IconButton
                    sx={styles.iconButton}
                    onClick={handleNoiseSuppressionToggle}
                    title={isNoiseSuppressed ? "Disable noise suppression" : "Enable noise suppression"}
                    disabled={!noiseSuppressionRef.current?.isInitialized()}
                  >
                    {isNoiseSuppressed ? <NoiseAware /> : <NoiseControlOff />}
                  </IconButton>
                  <IconButton
                    size="small"
                    sx={styles.iconButton}
                    onClick={handleNoiseSuppressionMenuOpen}
                    disabled={!noiseSuppressionRef.current?.isInitialized()}
                  >
                    <ExpandMore />
                  </IconButton>
                  <Menu
                    anchorEl={noiseSuppressMenuAnchor}
                    open={Boolean(noiseSuppressMenuAnchor)}
                    onClose={handleNoiseSuppressionMenuClose}
                  >
                    <MenuItem 
                      onClick={() => handleNoiseSuppressionModeSelect('rnnoise')}
                      selected={noiseSuppressionMode === 'rnnoise'}
                    >
                      RNNoise (AI-based)
                    </MenuItem>
                    <MenuItem 
                      onClick={() => handleNoiseSuppressionModeSelect('speex')}
                      selected={noiseSuppressionMode === 'speex'}
                    >
                      Speex (Classic)
                    </MenuItem>
                    <MenuItem 
                      onClick={() => handleNoiseSuppressionModeSelect('noisegate')}
                      selected={noiseSuppressionMode === 'noisegate'}
                    >
                      Noise Gate
                    </MenuItem>
                  </Menu>
                </Box>
              </Box>
              <Box sx={styles.controlGroup}>
                <IconButton
                  sx={styles.iconButton}
                  onClick={isVideoEnabled ? stopVideo : startVideo}
                  title={isVideoEnabled ? "Stop camera" : "Start camera"}
                >
                  {isVideoEnabled ? <VideocamOff /> : <Videocam />}
                </IconButton>
                <IconButton
                  sx={styles.iconButton}
                  onClick={isScreenSharing ? stopScreenSharing : startScreenSharing}
                  title={isScreenSharing ? "Stop sharing" : "Share screen"}
                >
                  {isScreenSharing ? <StopScreenShare /> : <ScreenShare />}
                </IconButton>

              </Box>
            </Box>
            <Button
              variant="contained"
              sx={styles.leaveButton}
              onClick={handleLeaveCall}
              startIcon={<PhoneDisabled />}
            >
              Leave
            </Button>
          </Box>
        </Box>
      </Box>
    </MuteProvider>
  );

  // Определяем целевой контейнер для портала
  const getTargetContainer = () => {
    // Для серверных голосовых каналов проверяем isVisible
    if (serverId) {
      if (!isVisible) return null;
      return document.getElementById('voice-chat-container-server');
    }
    
    // Для личных звонков (1 на 1) всегда ищем контейнер в GroupChat, независимо от isVisible
    if (isPrivateCall) {
      const privateContainer = document.getElementById('voice-chat-container-private');
      if (privateContainer) {
        return privateContainer;
      }
      // Если контейнера нет, значит пользователь не в том чате - не показываем
      return null;
    }
    
    // Для других случаев проверяем isVisible
    if (!isVisible) return null;
    
    // Для других случаев не создаем портал (работаем в фоне)
    return null;
  };

  const targetContainer = getTargetContainer();
  
  // Для приватных звонков: если есть контейнер, используем портал
  if (isPrivateCall && targetContainer) {
    return createPortal(ui, targetContainer);
  }
  
  // Для других случаев: если видимый и есть контейнер, используем портал
  if (isVisible && targetContainer) {
    return createPortal(ui, targetContainer);
  }
  
  // Если не видимый или нет контейнера, возвращаем ui напрямую со скрытием
  return (
    <div style={{ display: isVisible ? 'block' : 'none' }}>
      {ui}
    </div>
  );
});



export default VoiceChat;