import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Paper,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Slider,
  Switch,
  FormControlLabel,
  Menu,
  MenuItem,
  Chip,
  Tooltip
} from '@mui/material';
import {
  Mic,
  MicOff,
  VolumeUp,
  VolumeOff,
  PhoneDisabled,
  ScreenShare,
  StopScreenShare,
  Videocam,
  VideocamOff,
  Settings,
  MoreVert,
  Headset,
  HeadsetOff
} from '@mui/icons-material';
import { useVoiceCall } from '../../../entities/voice-call';
import { noiseSuppressionManager, volumeStorage } from '../../../shared/lib/utils';

export const VoiceCallWidget = ({ 
  userId, 
  userName, 
  roomId, 
  onClose,
  isPrivateCall = false 
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [participants] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [volumeMenuAnchor, setVolumeMenuAnchor] = useState(null);
  const [inputVolume, setInputVolume] = useState(volumeStorage.getInputVolume());
  const [outputVolume, setOutputVolume] = useState(volumeStorage.getOutputVolume());
  const [noiseSuppression, setNoiseSuppression] = useState(volumeStorage.getNoiseSuppression());

  const {
    error,
    isMuted,
    isAudioEnabled,
    isScreenSharing,
    isSpeaking,
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    startAudio,
    toggleMute,
    toggleAudio,
    startScreenShare,
    stopScreenShare
  } = useVoiceCall(userId, userName);

  const localAudioRef = useRef(null);

  // Подключение при монтировании
  useEffect(() => {
    const initializeCall = async () => {
      setIsConnecting(true);
      try {
        await connect();
        if (roomId) {
          await joinRoom(roomId);
          await startAudio();
        }
      } catch (error) {
        console.error('Failed to initialize call:', error);
      } finally {
        setIsConnecting(false);
      }
    };

    initializeCall();

    return () => {
      disconnect();
    };
  }, [connect, roomId, joinRoom, startAudio, disconnect]);

  // Обработка изменения громкости
  const handleInputVolumeChange = (event, newValue) => {
    setInputVolume(newValue);
    volumeStorage.setInputVolume(newValue);
    
    if (localAudioRef.current) {
      localAudioRef.current.volume = newValue;
    }
  };

  const handleOutputVolumeChange = (event, newValue) => {
    setOutputVolume(newValue);
    volumeStorage.setOutputVolume(newValue);
  };

  // Обработка подавления шума
  const handleNoiseSuppressionChange = (mode) => {
    setNoiseSuppression(mode);
    volumeStorage.setNoiseSuppression(mode);
    noiseSuppressionManager.setMode(mode);
  };

  // Обработка переключения микрофона
  const handleToggleMute = async () => {
    try {
      await toggleMute();
    } catch (error) {
      console.error('Failed to toggle mute:', error);
    }
  };

  // Обработка переключения аудио
  const handleToggleAudio = async () => {
    try {
      await toggleAudio();
    } catch (error) {
      console.error('Failed to toggle audio:', error);
    }
  };

  // Обработка демонстрации экрана
  const handleToggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        await stopScreenShare();
      } else {
        await startScreenShare();
      }
    } catch (error) {
      console.error('Failed to toggle screen share:', error);
    }
  };

  // Обработка завершения звонка
  const handleEndCall = async () => {
    try {
      await leaveRoom();
      await disconnect();
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Failed to end call:', error);
    }
  };

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="error" variant="h6" gutterBottom>
            Connection Error
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {error}
          </Typography>
          <Button variant="contained" onClick={connect}>
            Retry Connection
          </Button>
        </Paper>
      </Container>
    );
  }

  if (isConnecting) {
    return (
      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Connecting...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Establishing voice connection
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 2 }}>
      <Paper sx={{ p: 2 }}>
        {/* Заголовок */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            {isPrivateCall ? 'Private Call' : `Voice Channel`}
          </Typography>
          <Box>
            <Tooltip title="Settings">
              <IconButton onClick={() => setSettingsOpen(true)}>
                <Settings />
              </IconButton>
            </Tooltip>
            <Tooltip title="Volume">
              <IconButton onClick={(e) => setVolumeMenuAnchor(e.currentTarget)}>
                <VolumeUp />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Участники */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Participants ({participants.length})
          </Typography>
          <List dense>
            {participants.map((participant, index) => (
              <ListItem key={index}>
                <ListItemAvatar>
                  <Avatar sx={{ 
                    bgcolor: isSpeaking ? 'success.main' : 'grey.500',
                    animation: isSpeaking ? 'pulse 1s infinite' : 'none'
                  }}>
                    {participant.name?.charAt(0) || 'U'}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={participant.name || 'Unknown User'}
                  secondary={
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                      {participant.isMuted && <Chip size="small" label="Muted" color="error" />}
                      {participant.isSpeaking && <Chip size="small" label="Speaking" color="success" />}
                      {participant.isScreenSharing && <Chip size="small" label="Screen Sharing" color="info" />}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>

        {/* Элементы управления */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: 2, 
          flexWrap: 'wrap',
          p: 2,
          bgcolor: 'grey.100',
          borderRadius: 1
        }}>
          {/* Микрофон */}
          <Tooltip title={isMuted ? "Unmute" : "Mute"}>
            <IconButton
              size="large"
              color={isMuted ? "error" : "primary"}
              onClick={handleToggleMute}
              sx={{ 
                bgcolor: isMuted ? 'error.light' : 'primary.light',
                '&:hover': {
                  bgcolor: isMuted ? 'error.main' : 'primary.main',
                  color: 'white'
                }
              }}
            >
              {isMuted ? <MicOff /> : <Mic />}
            </IconButton>
          </Tooltip>

          {/* Аудио */}
          <Tooltip title={isAudioEnabled ? "Disable Audio" : "Enable Audio"}>
            <IconButton
              size="large"
              color={isAudioEnabled ? "success" : "error"}
              onClick={handleToggleAudio}
              sx={{ 
                bgcolor: isAudioEnabled ? 'success.light' : 'error.light',
                '&:hover': {
                  bgcolor: isAudioEnabled ? 'success.main' : 'error.main',
                  color: 'white'
                }
              }}
            >
              {isAudioEnabled ? <Headset /> : <HeadsetOff />}
            </IconButton>
          </Tooltip>

          {/* Демонстрация экрана */}
          <Tooltip title={isScreenSharing ? "Stop Screen Share" : "Start Screen Share"}>
            <IconButton
              size="large"
              color={isScreenSharing ? "error" : "info"}
              onClick={handleToggleScreenShare}
              sx={{ 
                bgcolor: isScreenSharing ? 'error.light' : 'info.light',
                '&:hover': {
                  bgcolor: isScreenSharing ? 'error.main' : 'info.main',
                  color: 'white'
                }
              }}
            >
              {isScreenSharing ? <StopScreenShare /> : <ScreenShare />}
            </IconButton>
          </Tooltip>

          {/* Завершение звонка */}
          <Tooltip title="End Call">
            <IconButton
              size="large"
              color="error"
              onClick={handleEndCall}
              sx={{ 
                bgcolor: 'error.light',
                '&:hover': {
                  bgcolor: 'error.main',
                  color: 'white'
                }
              }}
            >
              <PhoneDisabled />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Меню настроек */}
        <Menu
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem>
            <FormControlLabel
              control={
                <Switch
                  checked={noiseSuppression !== 'off'}
                  onChange={(e) => handleNoiseSuppressionChange(e.target.checked ? 'medium' : 'off')}
                />
              }
              label="Noise Suppression"
            />
          </MenuItem>
        </Menu>

        {/* Меню громкости */}
        <Menu
          open={Boolean(volumeMenuAnchor)}
          onClose={() => setVolumeMenuAnchor(null)}
          anchorEl={volumeMenuAnchor}
        >
          <MenuItem>
            <Box sx={{ width: 200, p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Input Volume
              </Typography>
              <Slider
                value={inputVolume}
                onChange={handleInputVolumeChange}
                min={0}
                max={1}
                step={0.1}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
              />
            </Box>
          </MenuItem>
          <MenuItem>
            <Box sx={{ width: 200, p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Output Volume
              </Typography>
              <Slider
                value={outputVolume}
                onChange={handleOutputVolumeChange}
                min={0}
                max={1}
                step={0.1}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
              />
            </Box>
          </MenuItem>
        </Menu>
      </Paper>
    </Container>
  );
};
