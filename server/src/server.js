const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { AccessToken } = require('livekit-server-sdk');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { Server } = require('socket.io');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// SSL certificates
const options = {
  key: fs.readFileSync('/app/ssl/private.key'),
  cert: fs.readFileSync('/app/ssl/certificate.crt')
};

const server = https.createServer(options, app);
const io = new Server(server, {
    cors: {
        origin: ["https://whithin.ru", "http://voice-server:3000"],
        methods: ["GET", "POST"],
        credentials: true
    },
    allowEIO3: true
});

// Configure CORS for Express
app.use(cors({
    origin: ["https://whithin.ru"],
    credentials: true
}));
app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

// LiveKit configuration
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://host.docker.internal:7880';
const LIVEKIT_EXTERNAL_URL = process.env.LIVEKIT_EXTERNAL_URL || 'wss://whithin.ru';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'this_is_a_very_long_secret_key_for_livekit_server_at_least_32_chars';

// Store active rooms and peers (simplified - no mediasoup)
const rooms = new Map(); // roomId -> { id, peers: Map<socketId, peer> }
const peers = new Map(); // socketId -> { id, socket, roomId, name, userId, muted, audioEnabled, speaking }

// Глобальное хранилище состояния пользователей (независимо от WebRTC соединений)
const userVoiceStates = new Map(); // userId -> { isMuted, isAudioDisabled, channelId, userName }

// Дебаунс для обновлений участников канала
const channelUpdateTimeouts = new Map();

// Функция для дебаунса обновлений канала
function scheduleChannelUpdate(channelId, delay = 100) {
    // Отменяем предыдущее обновление
    if (channelUpdateTimeouts.has(channelId)) {
        clearTimeout(channelUpdateTimeouts.get(channelId));
    }
    
    // Планируем новое обновление
    const timeout = setTimeout(() => {
        const participants = getChannelParticipants(channelId);
        io.emit('voiceChannelParticipantsUpdate', {
            channelId: channelId,
            participants: participants
        });
        channelUpdateTimeouts.delete(channelId);
    }, delay);
    
    channelUpdateTimeouts.set(channelId, timeout);
}

// Функции для управления состоянием пользователей
function updateUserVoiceState(userId, updates) {
    const currentState = userVoiceStates.get(userId) || {
        isMuted: false,
        isAudioDisabled: false,
        channelId: null,
        userName: 'Unknown'
    };
    
    const newState = { ...currentState, ...updates };
    userVoiceStates.set(userId, newState);
    console.log(`[USER_VOICE_STATE] Updated user ${userId}:`, newState);
    return newState;
}

function getUserVoiceState(userId) {
    return userVoiceStates.get(userId) || {
        isMuted: false,
        isAudioDisabled: false,
        channelId: null,
        userName: 'Unknown'
    };
}

function removeUserVoiceState(userId) {
    const state = userVoiceStates.get(userId);
    if (state) {
        // Обновляем состояние, но не удаляем полностью - сохраняем настройки микрофона/наушников
        updateUserVoiceState(userId, { channelId: null });
    }
}

function getChannelParticipants(channelId) {
    const participants = [];
    
    // Добавляем активных участников из комнаты
    const room = rooms.get(channelId);
    if (room) {
        room.peers.forEach((peer) => {
            // Используем настоящий userId, а не socket ID
            const realUserId = peer.userId || peer.id;
            // Получаем сохраненное состояние пользователя (приоритет для isMuted и isAudioDisabled)
            const userState = userVoiceStates.get(realUserId) || {};
            
            const participant = {
                userId: realUserId, // Используем настоящий userId
                name: peer.name,
                // Приоритизируем сохраненное состояние микрофона и наушников
                isMuted: userState.isMuted !== undefined ? userState.isMuted : peer.muted,
                isSpeaking: peer.speaking || false, // Состояние говорения
                isAudioDisabled: userState.isAudioDisabled !== undefined ? userState.isAudioDisabled : !peer.audioEnabled,
                isActive: true, // Активно в соединении
                avatar: peer.avatar || userState.avatar || null,
                avatarColor: peer.avatarColor || userState.avatarColor || '#5865f2'
            };
            participants.push(participant);
        });
    }
    
    // Добавляем пользователей, которые в канале, но не в активном соединении
    for (const [userId, state] of userVoiceStates.entries()) {
        if (state.channelId === channelId) {
            // Проверяем, не добавили ли мы уже этого пользователя
            const alreadyAdded = participants.some(p => p.userId === userId);
            if (!alreadyAdded) {
                const participant = {
                    userId: userId,
                    name: state.userName,
                    isMuted: state.isMuted,
                    isSpeaking: false, // Не в активном соединении
                    isAudioDisabled: state.isAudioDisabled,
                    isActive: false, // Не в активном соединении
                    avatar: state.avatar || null,
                    avatarColor: state.avatarColor || '#5865f2'
                };
                participants.push(participant);
            }
        }
    }
    
    return participants;
}

// Generate LiveKit access token
async function generateToken(roomName, participantName, identity) {
    try {
        // Validate API key and secret
        if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
            throw new Error('LiveKit API key or secret is missing');
        }
        
        const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
            identity: identity || participantName,
            name: participantName,
        });

        at.addGrant({
            room: roomName,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
        });

        // toJwt() returns a Promise in SDK v2.x+
        const jwt = await at.toJwt();
        
        if (!jwt || typeof jwt !== 'string') {
            throw new Error('Failed to generate JWT token');
        }
        
        return jwt;
    } catch (error) {
        console.error('Error generating LiveKit token:', error);
        throw error;
    }
}

io.on('connection', async (socket) => {
    console.log('Client connected:', socket.id);

    // Handle voice activity
    socket.on('speaking', ({ speaking }) => {
        const peer = peers.get(socket.id);
        if (!peer || !socket.data?.roomId) return;

        const room = rooms.get(socket.data.roomId);
        if (!room) return;

        // Only update speaking state if the peer is not muted
        if (!peer.muted) {
            peer.speaking = speaking;
            // Broadcast speaking state to all peers in the room
            socket.to(room.id).emit('speakingStateChanged', {
                peerId: socket.id,
                userId: peer.userId, // Добавляем userId для правильного сопоставления
                speaking: speaking && !peer.muted
            });
        }
    });

    socket.on('muteState', ({ isMuted }) => {
        const peer = peers.get(socket.id);
        if (!peer || !socket.data?.roomId) return;

        const room = rooms.get(socket.data.roomId);
        if (!room) return;

        peer.muted = isMuted;
        
        // Update global user voice state
        if (peer.userId) {
            updateUserVoiceState(peer.userId, { isMuted });
        }
        
        // If muted, ensure speaking state is false
        if (isMuted) {
            peer.speaking = false;
        }

        // Broadcast mute state to all peers in the room
        socket.to(room.id).emit('peerMuteStateChanged', {
            peerId: socket.id,
            isMuted,
            userId: peer.userId
        });

        // Also broadcast speaking state update if needed
        if (isMuted) {
            socket.to(room.id).emit('speakingStateChanged', {
                peerId: socket.id,
                userId: peer.userId, // Добавляем userId для правильного сопоставления
                speaking: false
            });
        }

        // Update channel participants list
        if (peer.userId && room.id) {
            scheduleChannelUpdate(room.id, 100);
        }
    });

    // Handle direct peerMuteStateChanged events from client for VoiceChannelContext
    socket.on('peerMuteStateChanged', ({ peerId, isMuted }) => {
        if (!socket.data?.roomId) return;

        const room = rooms.get(socket.data.roomId);
        if (!room) return;

        // Broadcast to all peers in the room (including sender for consistency)
        socket.to(room.id).emit('peerMuteStateChanged', {
            peerId,
            isMuted
        });
    });

    socket.on('createRoom', async ({ roomId }, callback) => {
        if (!callback || typeof callback !== 'function') {
            console.error('Callback is not a function for createRoom event');
            return;
        }

        try {
            if (rooms.has(roomId)) {
                callback({ error: 'room already exists' });
                return;
            }

            // Create simple room structure
            const room = {
                id: roomId,
                peers: new Map(),
                createdAt: Date.now()
            };
            rooms.set(roomId, room);
            callback({ roomId });
        } catch (error) {
            console.error('Error in createRoom:', error);
            callback({ error: error.message });
        }
    });

    socket.on('join', async ({ roomId, name, userId, initialMuted = false, initialAudioEnabled = true, avatar = null, avatarColor = '#5865f2' }, callback) => {
        try {
            // Create room if it doesn't exist
            let room = rooms.get(roomId);
            if (!room) {
                room = {
                    id: roomId,
                    peers: new Map(),
                    createdAt: Date.now()
                };
                rooms.set(roomId, room);
            }

            // Create peer with initial states
            const peer = {
                id: socket.id,
                socket: socket,
                roomId: roomId,
                name: name,
                userId: userId,
                muted: initialMuted,
                audioEnabled: initialAudioEnabled,
                speaking: false,
                avatar: avatar,
                avatarColor: avatarColor
            };
            
            // Обновляем глобальное состояние пользователя при подключении к комнате
            updateUserVoiceState(userId, { 
                channelId: roomId, 
                userName: name, 
                isMuted: initialMuted, 
                isAudioDisabled: !initialAudioEnabled,
                avatar: avatar,
                avatarColor: avatarColor
            });
            
            console.log('Peer created with userId:', {
                socketId: socket.id,
                peerId: peer.id,
                peerUserId: peer.userId,
                name: peer.name
            });
            peers.set(socket.id, peer);
            room.peers.set(socket.id, peer);

            // Store room ID in socket data
            socket.data.roomId = roomId;
            socket.join(roomId);

            // Get existing peers
            const existingPeers = [];
            room.peers.forEach((existingPeer) => {
                if (existingPeer.id !== socket.id) {
                    // Получаем реальное состояние пользователя из глобального хранилища
                    const userState = getUserVoiceState(existingPeer.userId);
                    
                    existingPeers.push({
                        id: existingPeer.id,
                        name: existingPeer.name,
                        isMuted: existingPeer.muted,
                        isAudioEnabled: existingPeer.audioEnabled,
                        isGlobalAudioMuted: userState.isAudioDisabled || false,
                        userId: existingPeer.userId
                    });
                }
            });

            // Получаем реальное состояние пользователя из глобального хранилища
            const userState = getUserVoiceState(peer.userId);
            
            // Notify other peers about the new peer BEFORE sending callback
            socket.to(roomId).emit('peerJoined', {
                peerId: peer.id,
                name: peer.name,
                isMuted: peer.muted,
                isAudioEnabled: peer.audioEnabled,
                isGlobalAudioMuted: userState.isAudioDisabled || false,
                userId: peer.userId
            });

            // Отправляем глобальное событие о присоединении к голосовому каналу
            // (для всех клиентов, даже тех кто не в звонке)
            io.emit('userJoinedVoiceChannel', {
                channelId: roomId,
                userId: peer.userId,
                userName: peer.name,
                isMuted: peer.muted,
                isAudioDisabled: !peer.audioEnabled,
                avatar: peer.avatar,
                avatarColor: peer.avatarColor
            });

            // Также отправляем обновленный список участников канала
            scheduleChannelUpdate(roomId, 100);

            console.log(`Peer ${name} (${socket.id}) joined room ${roomId}`);
            console.log('Existing peers:', existingPeers);

            // Generate LiveKit token
            const token = await generateToken(roomId, name, userId || socket.id);
            
            // Debug: log token info
            console.log(`Generated token for ${name} in room ${roomId}:`, {
                tokenType: typeof token,
                tokenLength: token?.length,
                tokenPreview: token ? token.substring(0, 20) + '...' : 'null'
            });

            // Send LiveKit token and existing peers
            callback({
                token: token,
                url: LIVEKIT_EXTERNAL_URL,
                existingPeers: existingPeers
            });

        } catch (error) {
            console.error('Error in join:', error);
            callback({ error: error.message });
        }
    });

    // Add audio disabled state handling
    socket.on('audioDisabledStateChanged', ({ isAudioDisabled }) => {
        if (!socket.data?.roomId) {
            console.error('Room ID not found for socket:', socket.id);
            return;
        }

        const peer = peers.get(socket.id);
        if (peer && peer.userId) {
            updateUserVoiceState(peer.userId, { isAudioDisabled });
        }

        // Broadcast to all peers in the room except the sender
        socket.to(socket.data.roomId).emit('peerAudioDisabledStateChanged', {
            peerId: socket.id,
            isAudioDisabled
        });
    });

    // Add audio state handling
    socket.on('audioState', ({ isEnabled, isGlobalAudioMuted, userId }) => {
        const peer = peers.get(socket.id);
        if (!peer || !socket.data?.roomId) return;

        const room = rooms.get(peer.roomId);
        if (!room) return;

        // Update peer's audio state
        peer.audioEnabled = isEnabled;
        
        // Update global user voice state if provided
        const realUserId = userId || peer.userId;
        if (realUserId && isGlobalAudioMuted !== undefined) {
            updateUserVoiceState(realUserId, { isAudioDisabled: isGlobalAudioMuted });
        }
        
        // Broadcast to all peers in the room (including sender for consistency)
        io.to(room.id).emit('peerAudioStateChanged', {
            peerId: socket.id,
            isEnabled,
            isGlobalAudioMuted,
            userId: realUserId
        });
        
        // Also emit global event for all clients (even those not in the call)
        io.emit('globalAudioState', {
            userId: realUserId,
            isGlobalAudioMuted: isGlobalAudioMuted || false
        });

        // Update channel participants list (like muteState does)
        if (realUserId && room.id) {
            scheduleChannelUpdate(room.id, 100);
        }
    });

    socket.on('getPeers', (_, callback) => {
        try {
            const room = rooms.get(socket.data?.roomId);
            if (!room) {
                callback([]);
                return;
            }

            const peersArray = Array.from(room.peers.values()).map((peer) => ({
                peerId: peer.id,
                userName: peer.name,
                isMuted: peer.muted || false
            }));

            callback(peersArray);
        } catch (error) {
            console.error('Error in getPeers:', error);
            callback([]);
        }
    });

    // Обработчик для получения информации о участниках голосовых каналов
    socket.on('getVoiceChannelParticipants', (data) => {
        try {
            const requestedChannelId = data?.channelId;
            
            // Если запрошен конкретный канал - отправляем только его
            if (requestedChannelId) {
                const participants = getChannelParticipants(requestedChannelId);
                socket.emit('voiceChannelParticipantsUpdate', {
                    channelId: requestedChannelId,
                    participants: participants
                });
                return;
            }
            
            // Иначе отправляем информацию о всех каналах
            
            // Очищаем пустые комнаты
            const emptyRooms = [];
            for (const [roomId, room] of rooms.entries()) {
                if (room.peers.size === 0) {
                    console.log('Removing empty room:', roomId);
                    emptyRooms.push(roomId);
                    rooms.delete(roomId);
                }
            }

            // Уведомляем всех клиентов о пустых комнатах
            emptyRooms.forEach(roomId => {
                io.emit('voiceChannelParticipantsUpdate', {
                    channelId: roomId,
                    participants: []
                });
            });

            // Отправляем информацию о всех голосовых каналах (активных и неактивных)
            const allChannelIds = new Set();
            
            // Собираем ID всех активных комнат
            rooms.forEach((room, roomId) => {
                allChannelIds.add(roomId);
            });
            
            // Собираем ID всех каналов, где есть пользователи (даже не в активном соединении)
            for (const [userId, state] of userVoiceStates.entries()) {
                if (state.channelId) {
                    allChannelIds.add(state.channelId);
                }
            }
            
            // Отправляем информацию о каждом канале
            allChannelIds.forEach(channelId => {
                const participants = getChannelParticipants(channelId);
                
                // Отправляем информацию всем подключенным клиентам
                io.emit('voiceChannelParticipantsUpdate', {
                    channelId: channelId,
                    participants: participants
                });
            });
        } catch (error) {
            console.error('Error in getVoiceChannelParticipants:', error);
        }
    });

    // Обработчик для уведомления о присоединении пользователя к голосовому каналу
    socket.on('userJoinedVoiceChannel', ({ channelId, userId, userName, isMuted }) => {
        try {
            // Отправляем уведомление всем клиентам
            io.emit('userJoinedVoiceChannel', {
                channelId,
                userId,
                userName,
                isMuted
            });
        } catch (error) {
            console.error('Error in userJoinedVoiceChannel:', error);
        }
    });

    // Обработчик для уведомления о выходе пользователя из голосового канала
    socket.on('userLeftVoiceChannel', ({ channelId, userId }) => {
        try {
            // Проверяем, есть ли еще участники в комнате
            const room = rooms.get(channelId);
            if (room) {
                // Удаляем пользователя из комнаты
                const peerToRemove = Array.from(room.peers.values()).find(p => p.userId === userId);
                if (peerToRemove) {
                    room.peers.delete(peerToRemove.id);
                    peers.delete(peerToRemove.id);
                    console.log(`User ${userId} removed from room ${channelId}`);
                } else {
                    console.log(`User ${userId} not found in room ${channelId}, but room exists`);
                }
                
                // Если комната стала пустой, удаляем её и уведомляем всех клиентов
                if (room.peers.size === 0) {
                    rooms.delete(channelId);
                    console.log(`Empty room ${channelId} removed via userLeftVoiceChannel`);
                    
                    // Уведомляем всех клиентов о том, что комната стала пустой
                    io.emit('voiceChannelParticipantsUpdate', {
                        channelId: channelId,
                        participants: []
                    });
                } else {
                    // Отправляем уведомление всем клиентам о выходе конкретного пользователя
                    io.emit('userLeftVoiceChannel', {
                        channelId,
                        userId
                    });
                }
            } else {
                console.log(`Room ${channelId} not found for user ${userId}`);
                // Даже если комната не найдена, отправляем обновление с пустым списком участников
                io.emit('voiceChannelParticipantsUpdate', {
                    channelId: channelId,
                    participants: []
                });
            }
        } catch (error) {
            console.error('Error in userLeftVoiceChannel:', error);
        }
    });

    // Обработчик для уведомления об изменении состояния участника
    socket.on('voiceChannelParticipantStateChanged', ({ channelId, userId, isMuted, isSpeaking }) => {
        try {
            // Отправляем уведомление всем клиентам
            io.emit('voiceChannelParticipantStateChanged', {
                channelId,
                userId,
                isMuted,
                isSpeaking
            });
        } catch (error) {
            console.error('Error in voiceChannelParticipantStateChanged:', error);
        }
    });

    // Новые обработчики для управления глобальным состоянием пользователей
    socket.on('updateUserVoiceState', ({ userId, userName, channelId, isMuted, isAudioDisabled }) => {
        try {
            const updates = {};
            if (userName !== undefined) updates.userName = userName;
            if (channelId !== undefined) updates.channelId = channelId;
            if (isMuted !== undefined) updates.isMuted = isMuted;
            if (isAudioDisabled !== undefined) updates.isAudioDisabled = isAudioDisabled;
            
            updateUserVoiceState(userId, updates);
            
            // Если пользователь присоединился/покинул канал, обновляем информацию о канале
            if (channelId !== undefined) {
                // Мгновенное обновление для смены канала
                const participants = getChannelParticipants(channelId);
                console.log(`[INSTANT_UPDATE] Channel ${channelId}: ${participants.length} participants`);
                io.emit('voiceChannelParticipantsUpdate', {
                    channelId: channelId,
                    participants: participants
                });
                
                // Если пользователь покинул канал, также обновляем предыдущий канал
                const currentState = getUserVoiceState(userId);
                if (currentState.channelId && currentState.channelId !== channelId) {
                    const oldParticipants = getChannelParticipants(currentState.channelId);
                    io.emit('voiceChannelParticipantsUpdate', {
                        channelId: currentState.channelId,
                        participants: oldParticipants
                    });
                }
            } else {
                // Для изменений состояния (микрофон/наушники) - тоже мгновенно
                const userState = getUserVoiceState(userId);
                if (userState.channelId) {
                    const participants = getChannelParticipants(userState.channelId);
                    console.log(`[INSTANT_UPDATE] State change for channel ${userState.channelId}: ${participants.length} participants`);
                    io.emit('voiceChannelParticipantsUpdate', {
                        channelId: userState.channelId,
                        participants: participants
                    });
                }
            }
        } catch (error) {
            console.error('Error in updateUserVoiceState:', error);
        }
    });

    socket.on('getUserVoiceState', ({ userId }, callback) => {
        try {
            const state = getUserVoiceState(userId);
            callback(state);
        } catch (error) {
            console.error('Error in getUserVoiceState:', error);
            callback(null);
        }
    });

    // Обработчик переключения пользователя в другой канал
    socket.on('switchUserToChannel', ({ userId, targetChannelId }, callback) => {
        console.log('switchUserToChannel: Switching user', userId, 'to channel', targetChannelId);
        
        if (!userId || !targetChannelId) {
            if (callback) callback({ error: 'userId and targetChannelId are required' });
            return;
        }
        
        // Находим текущий канал пользователя
        const userState = getUserVoiceState(userId);
        const sourceChannelId = userState.channelId;
        
        if (!sourceChannelId) {
            console.log(`User ${userId} is not in any channel`);
            if (callback) callback({ error: 'User is not in any channel' });
            return;
        }
        
        if (sourceChannelId === targetChannelId) {
            console.log(`User ${userId} is already in channel ${targetChannelId}`);
            if (callback) callback({ success: true, message: 'User already in target channel' });
            return;
        }
        
        // Находим peer пользователя в исходном канале
        const sourceRoom = rooms.get(sourceChannelId);
        if (!sourceRoom) {
            console.log(`Source room ${sourceChannelId} not found`);
            if (callback) callback({ error: 'Source room not found' });
            return;
        }
        
        const peerToMove = Array.from(sourceRoom.peers.values()).find(p => p.userId === userId);
        if (!peerToMove) {
            console.log(`Peer for user ${userId} not found in room ${sourceChannelId}`);
            if (callback) callback({ error: 'User not found in source room' });
            return;
        }
        
        // Находим socket пользователя ДО удаления peer (чтобы не потерять ссылку)
        const userSocket = Array.from(io.sockets.sockets.values()).find(s => s.id === peerToMove.id);
        
        // Сохраняем данные peer перед удалением
        const peerData = {
            id: peerToMove.id,
            userId: peerToMove.userId,
            name: peerToMove.name,
            muted: peerToMove.muted,
            audioEnabled: peerToMove.audioEnabled,
            speaking: peerToMove.speaking,
            avatar: peerToMove.avatar,
            avatarColor: peerToMove.avatarColor,
            roomId: targetChannelId
        };
        
        // Удаляем пользователя из исходного канала
        sourceRoom.peers.delete(peerToMove.id);
        peers.delete(peerToMove.id);
        
        // Обновляем состояние пользователя
        updateUserVoiceState(userId, { channelId: null });
        
        // Уведомляем о выходе из исходного канала
        io.emit('userLeftVoiceChannel', {
            channelId: sourceChannelId,
            userId: userId
        });
        
        // Если исходная комната стала пустой, удаляем её
        if (sourceRoom.peers.size === 0) {
            rooms.delete(sourceChannelId);
            io.emit('voiceChannelParticipantsUpdate', {
                channelId: sourceChannelId,
                participants: []
            });
        } else {
            scheduleChannelUpdate(sourceChannelId, 100);
        }
        
        // Добавляем пользователя в новый канал
        const targetRoom = rooms.get(targetChannelId);
        if (!targetRoom) {
            // Создаем новую комнату если её нет
            const newRoom = {
                id: targetChannelId,
                peers: new Map(),
                createdAt: Date.now()
            };
            rooms.set(targetChannelId, newRoom);
            console.log(`Created new room ${targetChannelId}`);
        }
        
        const targetRoomFinal = rooms.get(targetChannelId);
        
        // Восстанавливаем peer для нового канала
        targetRoomFinal.peers.set(peerData.id, peerData);
        peers.set(peerData.id, peerData);
        
        if (userSocket) {
            // Обновляем socket.data
            userSocket.data.roomId = targetChannelId;
            
            // Отправляем событие пользователю для переключения в новый канал
            // Клиент обработает это событие и переключится через LiveKit
            userSocket.emit('switchToChannel', {
                channelId: targetChannelId,
                sourceChannelId: sourceChannelId
            });
            console.log(`Sent switchToChannel event to user ${userId} for channel ${targetChannelId}`);
        } else {
            console.warn(`Socket not found for user ${userId} (socketId: ${peerData.id}), cannot send switch command`);
        }
        
        // Обновляем состояние пользователя
        updateUserVoiceState(userId, { 
            channelId: targetChannelId,
            userName: peerToMove.name
        });
        
        // Уведомляем о присоединении к новому каналу
        io.emit('userJoinedVoiceChannel', {
            channelId: targetChannelId,
            userId: userId,
            userName: peerToMove.name,
            isMuted: peerToMove.muted || false,
            isAudioDisabled: userState.isAudioDisabled || false,
            avatar: peerToMove.avatar || null,
            avatarColor: peerToMove.avatarColor || '#5865f2'
        });
        
        scheduleChannelUpdate(targetChannelId, 100);
        
        console.log(`User ${userId} switched from ${sourceChannelId} to ${targetChannelId}`);
        
        if (callback) callback({ success: true, sourceChannelId, targetChannelId });
    });

    // Обработчик выхода из комнаты (без отключения сокета)
    socket.on('leave', ({ roomId }) => {
        console.log('Client leaving room:', socket.id, roomId);
        
        const peer = peers.get(socket.id);
        if (!peer) {
            console.log(`Peer ${socket.id} not found`);
            return;
        }
        
        const actualRoomId = roomId || peer.roomId;
        const room = rooms.get(actualRoomId);
        
        if (!room) {
            console.log(`Room ${actualRoomId} not found for peer ${socket.id}`);
            return;
        }
        
        // Важно: Удаляем информацию о пользователе из глобального состояния
        if (peer.userId) {
            // Получаем текущее состояние пользователя
            const userState = getUserVoiceState(peer.userId);
            if (userState.channelId === actualRoomId) {
                console.log(`Removing user ${peer.userId} from voice channel ${actualRoomId} due to leave`);
                
                // Обновляем состояние - пользователь покинул канал
                updateUserVoiceState(peer.userId, { channelId: null });
                
                // Уведомляем всех клиентов о выходе пользователя
                io.emit('userLeftVoiceChannel', {
                    channelId: actualRoomId,
                    userId: peer.userId
                });
                
                // Также отправляем обновленный список участников
                scheduleChannelUpdate(actualRoomId, 100);
            }
        }
        
        // Удаляем peer из комнаты
        room.peers.delete(socket.id);
        peers.delete(socket.id);
        socket.data.roomId = null;
        console.log(`Peer ${socket.id} removed from room ${actualRoomId}`);
        
        // Если комната пустая, удаляем её и уведомляем всех клиентов
        if (room.peers.size === 0) {
            rooms.delete(actualRoomId);
            console.log(`Empty room ${actualRoomId} removed`);
            
            // Уведомляем всех клиентов о том, что комната стала пустой
            io.emit('voiceChannelParticipantsUpdate', {
                channelId: actualRoomId,
                participants: []
            });
        } else {
            // Уведомляем остальных участников о выходе
            socket.to(room.id).emit('peerLeft', { peerId: socket.id });
            
            // Отправляем обновленный список участников
            scheduleChannelUpdate(actualRoomId, 100);
        }
    });

    // Обработчик отключения сокета
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        
        const peer = peers.get(socket.id);
        if (peer) {
            const roomId = peer.roomId;
            const room = rooms.get(roomId);
            
            // Важно: Удаляем информацию о пользователе из глобального состояния
            if (peer.userId) {
                // Получаем текущее состояние пользователя
                const userState = getUserVoiceState(peer.userId);
                if (userState.channelId) {
                    console.log(`Removing user ${peer.userId} from voice channel ${userState.channelId} due to disconnect`);
                    
                    // Обновляем состояние - пользователь покинул канал
                    updateUserVoiceState(peer.userId, { channelId: null });
                    
                    // Уведомляем всех клиентов о выходе пользователя
                    io.emit('userLeftVoiceChannel', {
                        channelId: userState.channelId,
                        userId: peer.userId
                    });
                    
                    // Также отправляем обновленный список участников
                    scheduleChannelUpdate(userState.channelId, 100);
                }
            }
            
            if (room) {
                // Удаляем peer из комнаты
                room.peers.delete(socket.id);
                console.log(`Peer ${socket.id} removed from room ${roomId}`);
                
                // Если комната пустая, удаляем её и уведомляем всех клиентов
                if (room.peers.size === 0) {
                    rooms.delete(roomId);
                    console.log(`Empty room ${roomId} removed`);
                    
                    // Уведомляем всех клиентов о том, что комната стала пустой
                    io.emit('voiceChannelParticipantsUpdate', {
                        channelId: roomId,
                        participants: []
                    });
                } else {
                    // Уведомляем остальных участников о выходе
                    socket.to(room.id).emit('peerLeft', { peerId: socket.id });
                }
            } else {
                console.log(`Room ${roomId} not found for peer ${socket.id}`);
                // Даже если комната не найдена, отправляем обновление с пустым списком участников
                if (roomId) {
                    io.emit('voiceChannelParticipantsUpdate', {
                        channelId: roomId,
                        participants: []
                    });
                }
            }
            
            // Удаляем peer из глобального списка
            peers.delete(socket.id);
        }
    });

});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log('LiveKit configuration:', {
        url: LIVEKIT_URL,
        externalUrl: LIVEKIT_EXTERNAL_URL,
        apiKey: LIVEKIT_API_KEY,
        secretLength: LIVEKIT_API_SECRET?.length || 0,
        secretPreview: LIVEKIT_API_SECRET ? LIVEKIT_API_SECRET.substring(0, 10) + '...' : 'missing'
    });
});
