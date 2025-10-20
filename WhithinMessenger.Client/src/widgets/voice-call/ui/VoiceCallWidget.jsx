import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Button,
  Typography,
  Box,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Slider
} from '@mui/material';
import {
  Mic,
  MicOff,
  VolumeUp,
  VolumeOff,
  PhoneDisabled,
  Headset
} from '@mui/icons-material';
import { useVoiceCall } from '../../../entities/voice-call/hooks';

const VoiceCallWidget = ({
  channelId,
  channelName,
  userId,
  userName,
  onClose
}) => {
  const {
    isConnected,
    isMuted,
    isAudioEnabled,
    participants,
    volume,
    audioBlocked,
    error,
    connect,
    disconnect,
    joinRoom,
    toggleMute,
    toggleAudio,
    handleVolumeChange
  } = useVoiceCall(userId, userName);

  // Автоматическое подключение при монтировании
  useEffect(() => {
    if (channelId && userId && userName) {
      connect().then(() => {
        joinRoom(channelId);
      });
    }
  }, [channelId, userId, userName, connect, joinRoom]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const handleClose = () => {
    disconnect();
    if (onClose) {
      onClose();
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 2 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            {channelName} - Голосовой канал
          </Typography>
          <IconButton onClick={handleClose} color="error">
            <PhoneDisabled />
          </IconButton>
        </Box>

        <Box mb={2}>
          <Typography variant="body2" color="text.secondary">
            Статус: {isConnected ? 'Подключен' : 'Отключен'}
          </Typography>
          {error && (
            <Typography variant="body2" color="error">
              Ошибка: {error}
            </Typography>
          )}
        </Box>

        {/* Предупреждение о блокировке аудио */}
        {audioBlocked && (
          <Box sx={{ mb: 2, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
            <Typography variant="body2" color="warning.contrastText" sx={{ mb: 1 }}>
              Браузер заблокировал автовоспроизведение аудио
            </Typography>
            <Button 
              variant="contained" 
              color="warning" 
              size="small"
              onClick={async () => {
                const audioElements = document.querySelectorAll('audio');
                for (const audio of audioElements) {
                  try {
                    await audio.play();
                  } catch (e) {
                    console.log('Failed to play audio:', e);
                  }
                }
              }}
            >
              Разрешить воспроизведение
            </Button>
          </Box>
        )}

        {/* Участники */}
        <Box mb={3}>
          <Typography variant="subtitle1" gutterBottom>
            Участники ({participants.length})
          </Typography>
          <List dense>
            {participants.map((participant, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  <Headset />
                </ListItemIcon>
                <ListItemText 
                  primary={participant.userName || participant.name}
                  secondary={participant.isMuted ? 'Заглушен' : 'Говорит'}
                />
              </ListItem>
            ))}
          </List>
        </Box>

        {/* Управление */}
        <Box display="flex" flexDirection="column" gap={2}>
          <Box display="flex" gap={2} justifyContent="center">
            <IconButton
              onClick={toggleMute}
              color={isMuted ? 'error' : 'primary'}
              size="large"
            >
              {isMuted ? <MicOff /> : <Mic />}
            </IconButton>
            
            <IconButton
              onClick={toggleAudio}
              color={isAudioEnabled ? 'primary' : 'error'}
              size="large"
            >
              {isAudioEnabled ? <VolumeUp /> : <VolumeOff />}
            </IconButton>
          </Box>

          {/* Громкость */}
          <Box>
            <Typography gutterBottom>
              Громкость: {Math.round(volume * 100)}%
            </Typography>
            <Slider
              value={volume}
              onChange={(event, newValue) => handleVolumeChange(newValue)}
              min={0}
              max={1}
              step={0.1}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
            />
          </Box>

        </Box>
      </Paper>
    </Container>
  );
};

export default VoiceCallWidget;