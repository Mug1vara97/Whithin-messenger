import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Device } from 'mediasoup-client';
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
  Slider,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Mic,
  MicOff,
  VolumeUp,
  VolumeOff,
  PhoneDisabled,
  Headset,
  HeadsetOff
} from '@mui/icons-material';

const SimpleVoiceChat = ({ 
  channelId, 
  channelName, 
  userId, 
  userName, 
  onClose 
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  // const [isSpeaking, setIsSpeaking] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [volume, setVolume] = useState(1.0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [maxParticipants] = useState(10); // Ограничение на количество участников
  
  const socketRef = useRef(null);
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producersRef = useRef(new Map());
  const consumersRef = useRef(new Map());
  const localStreamRef = useRef(null);
  // const audioContextRef = useRef(null);

  // ICE серверы для WebRTC (пока не используются)
  // const iceServers = [
  //   { urls: ['stun:185.119.59.23:3478'] },
  //   {
  //     urls: ['turn:185.119.59.23:3478?transport=udp'],
  //     username: 'test',
  //     credential: 'test123'
  //   },
  //   {
  //     urls: ['turn:185.119.59.23:3478?transport=tcp'],
  //     username: 'test',
  //     credential: 'test123'
  //   }
  // ];

  // Подключение к серверу
  const connectToServer = async () => {
    try {
      console.log('Connecting to voice server...');
      
      const socket = io('https://whithin.ru', {
        transports: ['websocket'],
        upgrade: false,
        rememberUpgrade: false
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('Connected to voice server');
        setIsConnected(true);
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from voice server');
        setIsConnected(false);
      });

      socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
      });

      // Обработчики mediasoup событий
      socket.on('routerRtpCapabilities', async (routerRtpCapabilities) => {
        console.log('Received router RTP capabilities');
        await initializeDevice(routerRtpCapabilities);
      });

      socket.on('peerJoined', (peerData) => {
        console.log('Peer joined:', peerData);
        setParticipants(prev => {
          const newParticipants = [...prev, {
            userId: peerData.userId,
            name: peerData.name,
            isMuted: peerData.isMuted,
            isSpeaking: false
          }];
          
          // Проверяем лимит участников
          if (newParticipants.length > maxParticipants) {
            console.warn(`Too many participants (${newParticipants.length}), limiting to ${maxParticipants}`);
            return newParticipants.slice(0, maxParticipants);
          }
          
          return newParticipants;
        });
      });

      socket.on('peerLeft', (peerData) => {
        console.log('Peer left:', peerData);
        setParticipants(prev => prev.filter(p => p.userId !== peerData.userId));
        // Удаляем все consumer'ы для этого peer'а
        removeConsumerForPeer(peerData.userId);
      });

      socket.on('newProducer', async (producerData) => {
        console.log('New producer:', producerData);
        await handleNewProducer(producerData);
      });

      socket.on('producerClosed', (producerId) => {
        console.log('Producer closed:', producerId);
        removeConsumer(producerId);
      });

      socket.on('peerLeft', (peerData) => {
        console.log('Peer left:', peerData);
        setParticipants(prev => prev.filter(p => p.userId !== peerData.userId));
        // Удаляем все consumer'ы для этого peer'а
        removeConsumerForPeer(peerData.userId);
      });

    } catch (error) {
      console.error('Failed to connect to voice server:', error);
    }
  };

  // Инициализация mediasoup устройства
  const initializeDevice = async (routerRtpCapabilities) => {
    try {
      if (!deviceRef.current) {
        deviceRef.current = new Device();
      }

      if (!deviceRef.current.loaded) {
        await deviceRef.current.load({ routerRtpCapabilities });
      }

      console.log('Device initialized');
      await createTransports();
    } catch (error) {
      console.error('Failed to initialize device:', error);
    }
  };

  // Создание транспортов
  const createTransports = async () => {
    try {
      // Создание send transport
      const sendTransportData = await socketEmit('createWebRtcTransport', {});

      sendTransportRef.current = deviceRef.current.createSendTransport({
        id: sendTransportData.id,
        iceParameters: sendTransportData.iceParameters,
        iceCandidates: sendTransportData.iceCandidates,
        dtlsParameters: sendTransportData.dtlsParameters,
         iceServers: [
           { urls: ['stun:185.119.59.23:3478'] },
           { urls: ['stun:stun.l.google.com:19302'] },
           { urls: ['stun:stun1.l.google.com:19302'] },
           {
             urls: ['turn:185.119.59.23:3478?transport=udp'],
             username: 'test',
             credential: 'test123'
           },
           {
             urls: ['turn:185.119.59.23:3478?transport=tcp'],
             username: 'test',
             credential: 'test123'
           }
         ]
      });

      sendTransportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await socketEmit('connectTransport', {
            transportId: sendTransportData.id,
            dtlsParameters
          });
          callback();
        } catch (error) {
          errback(error);
        }
      });

      sendTransportRef.current.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
        try {
          const { id } = await socketEmit('produce', {
            transportId: sendTransportData.id,
            kind,
            rtpParameters,
            appData
          });
          callback({ id });
        } catch (error) {
          errback(error);
        }
      });

      // Создание recv transport
      const recvTransportData = await socketEmit('createWebRtcTransport', {});

      recvTransportRef.current = deviceRef.current.createRecvTransport({
        id: recvTransportData.id,
        iceParameters: recvTransportData.iceParameters,
        iceCandidates: recvTransportData.iceCandidates,
        dtlsParameters: recvTransportData.dtlsParameters,
         iceServers: [
           { urls: ['stun:185.119.59.23:3478'] },
           { urls: ['stun:stun.l.google.com:19302'] },
           { urls: ['stun:stun1.l.google.com:19302'] },
           {
             urls: ['turn:185.119.59.23:3478?transport=udp'],
             username: 'test',
             credential: 'test123'
           },
           {
             urls: ['turn:185.119.59.23:3478?transport=tcp'],
             username: 'test',
             credential: 'test123'
           }
         ]
      });

      recvTransportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await socketEmit('connectTransport', {
            transportId: recvTransportData.id,
            dtlsParameters
          });
          callback();
        } catch (error) {
          errback(error);
        }
      });

      console.log('Transports created');
    } catch (error) {
      console.error('Failed to create transports:', error);
    }
  };

  // Присоединение к комнате
  const joinRoom = async () => {
    try {
      const response = await socketEmit('join', {
        roomId: channelId,
        name: userName,
        userId: userId,
        initialMuted: false,
        initialAudioEnabled: true
      });
      
      console.log('Joined room:', channelId, response);
      
      // Инициализация устройства с полученными RTP capabilities
      if (response.routerRtpCapabilities) {
        await initializeDevice(response.routerRtpCapabilities);
      }
      
      // Обработка существующих участников
      if (response.existingPeers) {
        setParticipants(response.existingPeers.map(peer => ({
          userId: peer.userId,
          name: peer.name,
          isMuted: peer.isMuted,
          isSpeaking: false
        })));
      }
      
      // Обработка существующих producer'ов
      if (response.existingProducers) {
        console.log('Processing existing producers:', response.existingProducers);
        for (const producer of response.existingProducers) {
          await handleNewProducer(producer);
        }
      }
      
      // Создание аудио потока
      await createAudioStream();
      
    } catch (error) {
      console.error('Failed to join room:', error);
    }
  };

  // Создание аудио потока
  const createAudioStream = async () => {
    try {
       const stream = await navigator.mediaDevices.getUserMedia({
         audio: {
           echoCancellation: true,
           noiseSuppression: true,
           autoGainControl: true,
           sampleRate: 48000,
           channelCount: 2,
           latency: 0,
           suppressLocalAudioPlayback: true
         }
       });

      localStreamRef.current = stream;
      
      // Создание producer
      const audioTrack = stream.getAudioTracks()[0];
      const producer = await sendTransportRef.current.produce({
        track: audioTrack,
        appData: { userId, userName }
      });

      producersRef.current.set(producer.id, producer);
      
      // Обработка изменения состояния микрофона
      audioTrack.onended = () => {
        console.log('Audio track ended');
      };

      console.log('Audio stream created');
      return producer;
    } catch (error) {
      console.error('Failed to create audio stream:', error);
    }
  };

  // Обработка нового producer
  const handleNewProducer = async (producerData) => {
    try {
      console.log('Handling new producer:', producerData);
      
      // Запрашиваем данные consumer у сервера
      const consumerData = await socketEmit('consume', {
        rtpCapabilities: deviceRef.current.rtpCapabilities,
        remoteProducerId: producerData.producerId,
        transportId: recvTransportRef.current.id
      });

      console.log('Consumer data received:', consumerData);

      // Создаем consumer
      const consumer = await recvTransportRef.current.consume({
        id: consumerData.id,
        producerId: producerData.producerId,
        kind: producerData.kind,
        rtpParameters: consumerData.rtpParameters
      });

      consumersRef.current.set(consumerData.id, consumer);
      
      // Создание аудио элемента
      const audioElement = document.createElement('audio');
      audioElement.srcObject = new MediaStream([consumer.track]);
      audioElement.volume = volume;
      audioElement.autoplay = true;
      audioElement.playsInline = true;
      audioElement.controls = false;
      audioElement.style.display = 'none';
      document.body.appendChild(audioElement);

      // Принудительно запускаем воспроизведение
      try {
        await audioElement.play();
        console.log('Audio playback started for consumer:', consumerData.id);
      } catch (error) {
        console.log('Auto-play blocked, user interaction required:', error);
        setAudioBlocked(true);
        // Попробуем запустить после небольшой задержки
        setTimeout(async () => {
          try {
            await audioElement.play();
            console.log('Audio playback started after delay');
            setAudioBlocked(false);
          } catch (e) {
            console.log('Audio playback still blocked');
          }
        }, 1000);
      }

      // Обработчики событий для аудио элемента
      audioElement.addEventListener('loadedmetadata', () => {
        console.log('Audio metadata loaded for consumer:', consumerData.id);
      });

      audioElement.addEventListener('canplay', () => {
        console.log('Audio can play for consumer:', consumerData.id);
        audioElement.play().catch(e => console.log('Play failed:', e));
      });

      audioElement.addEventListener('error', (e) => {
        console.error('Audio element error:', e);
      });

      // Resume consumer
      await socketEmit('resumeConsumer', { consumerId: consumerData.id });

      console.log('New consumer created:', consumerData.id);
    } catch (error) {
      console.error('Failed to handle new producer:', error);
    }
  };

  // Удаление consumer
  const removeConsumer = (producerId) => {
    const consumer = consumersRef.current.get(producerId);
    if (consumer) {
      consumer.close();
      consumersRef.current.delete(producerId);
    }
  };

  // Удаление всех consumer'ов для конкретного peer'а
  const removeConsumerForPeer = (userId) => {
    const consumersToRemove = [];
    consumersRef.current.forEach((consumer, consumerId) => {
      if (consumer.appData && consumer.appData.userId === userId) {
        consumersToRemove.push(consumerId);
      }
    });
    
    consumersToRemove.forEach(consumerId => {
      removeConsumer(consumerId);
    });
  };

  // Вспомогательная функция для отправки событий
  const socketEmit = (event, data) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error('Socket not connected'));
        return;
      }

      socketRef.current.emit(event, data, (response) => {
        if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  };

  // Переключение микрофона
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Переключение аудио
  const toggleAudio = () => {
    setIsAudioEnabled(!isAudioEnabled);
    // Здесь можно добавить логику для отключения/включения аудио
  };

  // Изменение громкости
  const handleVolumeChange = (event, newValue) => {
    setVolume(newValue);
    // Обновить громкость всех аудио элементов
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      audio.volume = newValue;
    });
  };

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Автоматическое подключение при монтировании
  useEffect(() => {
    connectToServer();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Присоединение к комнате после подключения
  useEffect(() => {
    if (isConnected) {
      joinRoom();
    }
  }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Container maxWidth="sm" sx={{ mt: 2 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            {channelName} - Голосовой канал
          </Typography>
          <IconButton onClick={onClose} color="error">
            <PhoneDisabled />
          </IconButton>
        </Box>

        <Box mb={2}>
          <Typography variant="body2" color="text.secondary">
            Статус: {isConnected ? 'Подключен' : 'Отключен'}
          </Typography>
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
                // Попробуем запустить все аудио элементы
                const audioElements = document.querySelectorAll('audio');
                for (const audio of audioElements) {
                  try {
                    await audio.play();
                  } catch (e) {
                    console.log('Failed to play audio:', e);
                  }
                }
                setAudioBlocked(false);
              }}
            >
              Разрешить воспроизведение
            </Button>
          </Box>
        )}

         {/* Участники */}
         <Box mb={3}>
           <Typography variant="subtitle1" gutterBottom>
             Участники ({participants.length}/{maxParticipants})
           </Typography>
           {participants.length >= maxParticipants && (
             <Typography variant="caption" color="warning.main">
               Достигнут лимит участников ({maxParticipants})
             </Typography>
           )}
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
              onChange={handleVolumeChange}
              min={0}
              max={1}
              step={0.1}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
            />
          </Box>

          {/* Кнопка подключения */}
          {!isConnected && (
            <Button
              variant="contained"
              onClick={connectToServer}
              fullWidth
              startIcon={<Headset />}
            >
              Подключиться
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default SimpleVoiceChat;
