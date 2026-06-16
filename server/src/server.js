const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { AccessToken } = require('livekit-server-sdk');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Redis = require('ioredis');
const { createAdapter } = require('@socket.io/redis-adapter');
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
    allowEIO3: true,
    pingInterval: 10000,
    pingTimeout: 25000,
});

// Configure CORS for Express
app.use(cors({
    origin: ["https://whithin.ru"],
    credentials: true
}));
app.post('/webhook/livekit', express.raw({ type: '*/*' }), handleLiveKitWebhook);
app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

// LiveKit configuration
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://host.docker.internal:7880';
const LIVEKIT_EXTERNAL_URL = process.env.LIVEKIT_EXTERNAL_URL || 'wss://whithin.ru';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'this_is_a_very_long_secret_key_for_livekit_server_at_least_32_chars';
const REDIS_URL = process.env.REDIS_URL || null;
const JWT_ISSUER = process.env.JWT_ISSUER || 'https://whithin.ru';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'https://whithin.ru';
const JWT_KEY = process.env.JWT_KEY || 'WhithinMessenger2024!SuperSecretJWTKeyForTesting123456789';
const VOICE_ALLOW_ANON = process.env.VOICE_ALLOW_ANON === 'true' || process.env.NODE_ENV !== 'production';
const VOICE_RECONNECT_GRACE_MS = Number(process.env.VOICE_RECONNECT_GRACE_MS || 20000);
const VOICE_PRESENCE_TTL_MS = Number(process.env.VOICE_PRESENCE_TTL_MS || 90000);
const VOICE_CLEAR_STALE_ON_START = process.env.VOICE_CLEAR_STALE_ON_START !== 'false';

let redis = null;
let redisPub = null;
let redisSub = null;

if (REDIS_URL) {
    redis = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 });
    redisPub = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 });
    redisSub = redisPub.duplicate();

    redis.on('error', (error) => console.warn('[redis] voice state error:', error.message));
    redisPub.on('error', (error) => console.warn('[redis] adapter pub error:', error.message));
    redisSub.on('error', (error) => console.warn('[redis] adapter sub error:', error.message));

    Promise.all([redis.connect(), redisPub.connect(), redisSub.connect()])
        .then(async () => {
            if (VOICE_CLEAR_STALE_ON_START) {
                await clearStaleRedisVoicePresence();
            }
            io.adapter(createAdapter(redisPub, redisSub));
            console.log('[redis] Voice server Redis adapter connected');
        })
        .catch((error) => {
            console.warn('[redis] Voice server running without Redis adapter:', error.message);
        });
}

// Store active rooms and peers (simplified - no mediasoup)
const rooms = new Map(); // roomId -> { id, peers: Map<socketId, peer> }
const peers = new Map(); // socketId -> { id, socket, roomId, name, userId, muted, audioEnabled, speaking }

// Глобальное хранилище состояния пользователей (независимо от WebRTC соединений)
const userVoiceStates = new Map(); // userId -> { isMuted, isAudioDisabled, channelId, userName }

// Дебаунс для обновлений участников канала
const channelUpdateTimeouts = new Map();
const peerSpeakingUpdateAt = new Map();
const disconnectGraceTimers = new Map();
const SPEAKING_UPDATE_MIN_INTERVAL_MS = 250;
const channelRoomName = (channelId) => `channel:${normalizeChannelId(channelId)}`;
const serverRoomName = (serverId) => `server:${String(serverId)}`;
const userRoomName = (userId) => `user:${String(userId)}`;

function parseAuthToken(token) {
    if (!token) return null;
    return jwt.verify(token, JWT_KEY, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        clockTolerance: 0,
    });
}

function getClaim(payload, ...names) {
    for (const name of names) {
        if (payload?.[name] != null && payload[name] !== '') return payload[name];
    }
    return null;
}

function normalizeAuthUser(payload) {
    if (!payload) return null;
    const userId = getClaim(payload, 'UserId', 'userId', 'sub', 'nameid');
    const username = getClaim(payload, 'Username', 'username', 'unique_name', 'preferred_username', 'name') || 'User';
    if (!userId) return null;
    return { userId: String(userId), username: String(username) };
}

io.use((socket, next) => {
    try {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        const authUser = normalizeAuthUser(parseAuthToken(token));
        if (authUser) {
            socket.data.userId = authUser.userId;
            socket.data.username = authUser.username;
            socket.data.authenticated = true;
            return next();
        }

        if (VOICE_ALLOW_ANON) {
            socket.data.authenticated = false;
            return next();
        }

        return next(new Error('Unauthorized voice socket'));
    } catch (error) {
        if (VOICE_ALLOW_ANON) {
            socket.data.authenticated = false;
            return next();
        }
        return next(new Error('Unauthorized voice socket'));
    }
});

function emitChannel(channelId, eventName, payload) {
    io.emit(eventName, payload);
}

function emitServer(serverId, eventName, payload) {
    io.emit(eventName, payload);
}

function emitVoiceState(peer, eventName, payload) {
    io.emit(eventName, payload);
}

function redisKeyUser(userId) {
    return `voice:user:${String(userId)}`;
}

function redisKeyChannelParticipants(channelId) {
    return `voice:channel:${normalizeChannelId(channelId)}:participants`;
}

async function scanRedisKeys(pattern) {
    if (!redis) return [];
    const keys = [];
    let cursor = '0';
    do {
        const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        keys.push(...batch);
    } while (cursor !== '0');
    return keys;
}

async function clearStaleRedisVoicePresence() {
    if (!redis) return;
    try {
        const channelKeys = await scanRedisKeys('voice:channel:*:participants');
        if (channelKeys.length > 0) {
            await redis.del(...channelKeys);
        }

        const userKeys = await scanRedisKeys('voice:user:*');
        for (const key of userKeys) {
            const raw = await redis.hget(key, 'data');
            if (!raw) continue;
            const state = JSON.parse(raw);
            if (!state?.channelId) continue;
            state.channelId = null;
            state.liveKitConnected = false;
            state.graceUntil = null;
            state.clearedOnVoiceServerStart = Date.now();
            await redis.hset(key, {
                data: JSON.stringify(state),
                updatedAt: String(Date.now()),
            });
        }

        console.log('[redis] Cleared stale voice presence on startup:', {
            channelKeys: channelKeys.length,
            userKeys: userKeys.length,
        });
    } catch (error) {
        console.warn('[redis] Failed to clear stale voice presence on startup:', error.message);
    }
}

function serializeParticipantFromPeer(peer, userState = {}) {
    const realUserId = peer.userId || peer.id;
    return {
        userId: realUserId,
        name: peer.name,
        isMuted: userState.isMuted !== undefined ? Boolean(userState.isMuted) : Boolean(peer.muted),
        isSpeaking: Boolean(peer.speaking),
        isAudioDisabled: userState.isAudioDisabled !== undefined ? Boolean(userState.isAudioDisabled) : !peer.audioEnabled,
        isServerMuted: Boolean(
            peer.serverMuted ||
            getServerModerationState(userState, peer.serverId).serverMuted
        ),
        isServerDeafened: Boolean(
            peer.serverDeafened ||
            getServerModerationState(userState, peer.serverId).serverDeafened
        ),
        isActive: peer.liveKitConnected !== false,
        avatar: peer.avatar || userState.avatar || null,
        avatarColor: peer.avatarColor || userState.avatarColor || '#5865f2'
    };
}

function persistUserVoiceState(userId, state) {
    if (!redis || !userId) return;
    redis.hset(redisKeyUser(userId), {
        data: JSON.stringify(state),
        updatedAt: String(Date.now()),
    }).catch((error) => console.warn('[redis] persist user voice state failed:', error.message));
}

function persistChannelParticipant(channelId, participant) {
    return;
}

function removeChannelParticipant(channelId, userId) {
    return;
}

async function getRedisChannelParticipants(channelId) {
    return [];
}

// Функция для дебаунса обновлений канала
function scheduleChannelUpdate(channelId, delay = 100) {
    // Отменяем предыдущее обновление
    if (channelUpdateTimeouts.has(channelId)) {
        clearTimeout(channelUpdateTimeouts.get(channelId));
    }
    
    // Планируем новое обновление
    const timeout = setTimeout(async () => {
        const participants = await getChannelParticipantsAsync(channelId);
        emitChannel(channelId, 'voiceChannelParticipantsUpdate', {
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
    persistUserVoiceState(userId, newState);
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

function getServerModerationState(userState, serverId) {
    if (!serverId) {
        return { serverMuted: false, serverDeafened: false };
    }

    const bucket = userState?.serverModeration?.[String(serverId)];
    if (bucket) {
        return {
            serverMuted: Boolean(bucket.serverMuted),
            serverDeafened: Boolean(bucket.serverDeafened),
        };
    }

    return { serverMuted: false, serverDeafened: false };
}

function updateServerModeration(userId, serverId, updates) {
    if (!userId || !serverId) return;

    const state = getUserVoiceState(userId);
    const serverModeration = { ...(state.serverModeration || {}) };
    const key = String(serverId);
    serverModeration[key] = {
        ...(serverModeration[key] || {}),
        ...updates,
    };
    updateUserVoiceState(userId, { serverModeration });
}

function removeUserVoiceState(userId) {
    const state = userVoiceStates.get(userId);
    if (state) {
        // Обновляем состояние, но не удаляем полностью - сохраняем настройки микрофона/наушников
        updateUserVoiceState(userId, { channelId: null });
    }
}

function normalizeChannelId(channelId) {
    return channelId == null ? '' : String(channelId);
}

function reconcileUserVoiceStates() {
    for (const [userId, state] of userVoiceStates.entries()) {
        if (!state.channelId) continue;

        const room = rooms.get(state.channelId);
        const hasActivePeer = room && Array.from(room.peers.values()).some(
            (peer) => String(peer.userId) === String(userId)
        );

        if (!hasActivePeer) {
            const channelId = state.channelId;
            updateUserVoiceState(userId, { channelId: null });
            emitChannel(channelId, 'userLeftVoiceChannel', { channelId, userId });
            removeChannelParticipant(channelId, userId);
            scheduleChannelUpdate(channelId, 100);
        }
    }
}

function evictUserPeersFromRoom(room, userId, exceptSocketId, options = {}) {
    const { emitLeftEvent = false } = options;
    if (!room || !userId) return;

    const staleSocketIds = [];
    room.peers.forEach((existingPeer, existingSocketId) => {
        if (String(existingPeer.userId) === String(userId) && existingSocketId !== exceptSocketId) {
            staleSocketIds.push(existingSocketId);
        }
    });

    for (const staleSocketId of staleSocketIds) {
        const stalePeer = room.peers.get(staleSocketId);
        room.peers.delete(staleSocketId);
        peers.delete(staleSocketId);

        if (emitLeftEvent && stalePeer?.userId) {
            emitChannel(room.id, 'userLeftVoiceChannel', {
                channelId: room.id,
                userId: stalePeer.userId
            });
        }

        if (stalePeer?.socket) {
            try {
                stalePeer.socket.removeAllListeners('disconnect');
                stalePeer.socket.disconnect(true);
            } catch (error) {
                console.warn('Failed to disconnect stale peer socket:', error);
            }
        }
    }

    if (staleSocketIds.length > 0) {
        scheduleChannelUpdate(room.id, 100);
    }
}

function getChannelParticipants(channelId) {
    const participants = [];
    const normalizedChannelId = normalizeChannelId(channelId);
    const room = rooms.get(channelId) || rooms.get(normalizedChannelId);

    if (room) {
        room.peers.forEach((peer) => {
            const realUserId = peer.userId || peer.id;
            const userState = userVoiceStates.get(realUserId) || {};

            participants.push(serializeParticipantFromPeer(peer, userState));
        });
    }

    return participants;
}

async function getChannelParticipantsAsync(channelId) {
    const redisParticipants = await getRedisChannelParticipants(channelId);
    const localParticipants = getChannelParticipants(channelId);
    const byUserId = new Map();
    redisParticipants.forEach((participant) => {
        if (participant?.userId) byUserId.set(String(participant.userId), participant);
    });
    localParticipants.forEach((participant) => {
        if (participant?.userId) byUserId.set(String(participant.userId), participant);
    });
    return Array.from(byUserId.values()).filter((participant) => participant?.isActive !== false);
}

function getLiveKitWebhookToken(req) {
    const header = req.headers.authorization || req.headers.Authorization;
    if (!header || typeof header !== 'string') return null;
    const [scheme, token] = header.split(' ');
    if (!token || scheme.toLowerCase() !== 'bearer') return null;
    return token;
}

function verifyLiveKitWebhook(req) {
    const token = getLiveKitWebhookToken(req);
    if (!token) {
        throw new Error('Missing LiveKit webhook authorization');
    }

    try {
        jwt.verify(token, LIVEKIT_API_SECRET, {
            issuer: LIVEKIT_API_KEY,
            clockTolerance: 60,
        });
    } catch (error) {
        jwt.verify(token, LIVEKIT_API_SECRET, {
            clockTolerance: 60,
        });
    }
}

function findPeerByUserAndRoom(userId, roomId) {
    const normalizedRoomId = normalizeChannelId(roomId);
    const room = rooms.get(normalizedRoomId);
    if (!room || !userId) return null;
    for (const peer of room.peers.values()) {
        if (String(peer.userId) === String(userId)) {
            return peer;
        }
    }
    return null;
}

async function clearVoiceChannelFromLiveKit(roomId) {
    const normalizedRoomId = normalizeChannelId(roomId);
    if (!normalizedRoomId) return;

    const room = rooms.get(normalizedRoomId);
    if (room) {
        for (const peer of room.peers.values()) {
            if (peer.userId) {
                peer.liveKitConnected = false;
                updateUserVoiceState(peer.userId, {
                    channelId: null,
                    liveKitConnected: false,
                    liveKitLeftAt: Date.now(),
                });
                await removeChannelParticipant(normalizedRoomId, peer.userId);
            }
        }
        rooms.delete(normalizedRoomId);
    } else if (redis) {
        try {
            const participants = await getRedisChannelParticipants(normalizedRoomId);
            for (const participant of participants) {
                if (participant.userId) {
                    updateUserVoiceState(participant.userId, {
                        channelId: null,
                        liveKitConnected: false,
                        liveKitLeftAt: Date.now(),
                    });
                    await removeChannelParticipant(normalizedRoomId, participant.userId);
                }
            }
        } catch (error) {
            console.warn('[livekit-webhook] Failed to clear Redis channel participants:', error.message);
        }
    }

    emitChannel(normalizedRoomId, 'voiceChannelParticipantsUpdate', {
        channelId: normalizedRoomId,
        participants: [],
    });
}

async function applyLiveKitParticipantJoined(roomId, participant) {
    const normalizedRoomId = normalizeChannelId(roomId);
    const userId = participant?.identity ? String(participant.identity) : null;
    if (!normalizedRoomId || !userId) return;

    const peer = findPeerByUserAndRoom(userId, normalizedRoomId);
    if (peer) {
        peer.liveKitConnected = true;
    }
    const state = updateUserVoiceState(userId, {
        channelId: normalizedRoomId,
        userName: participant?.name || peer?.name || userId,
        liveKitConnected: true,
        liveKitJoinedAt: Date.now(),
        liveKitLeftAt: null,
    });

    if (peer) {
        persistChannelParticipant(normalizedRoomId, serializeParticipantFromPeer(peer, state));
    } else {
        persistChannelParticipant(normalizedRoomId, {
            userId,
            name: participant?.name || userId,
            isMuted: Boolean(state.isMuted),
            isSpeaking: false,
            isAudioDisabled: Boolean(state.isAudioDisabled),
            isServerMuted: false,
            isServerDeafened: false,
            isActive: true,
            avatar: state.avatar || null,
            avatarColor: state.avatarColor || '#5865f2',
        });
    }

    emitChannel(normalizedRoomId, 'voiceChannelParticipantsUpdate', {
        channelId: normalizedRoomId,
        participants: await getChannelParticipantsAsync(normalizedRoomId),
    });
}

async function applyLiveKitParticipantLeft(roomId, participant) {
    const normalizedRoomId = normalizeChannelId(roomId);
    const userId = participant?.identity ? String(participant.identity) : null;
    if (!normalizedRoomId || !userId) return;

    const peer = findPeerByUserAndRoom(userId, normalizedRoomId);
    if (peer) {
        peer.liveKitConnected = false;
        const state = updateUserVoiceState(userId, {
            liveKitConnected: false,
            liveKitLeftAt: Date.now(),
        });
        persistChannelParticipant(normalizedRoomId, {
            ...serializeParticipantFromPeer(peer, state),
            isActive: false,
        });
    } else {
        updateUserVoiceState(userId, {
            channelId: null,
            liveKitConnected: false,
            liveKitLeftAt: Date.now(),
        });
        await removeChannelParticipant(normalizedRoomId, userId);
        emitChannel(normalizedRoomId, 'userLeftVoiceChannel', {
            channelId: normalizedRoomId,
            userId,
        });
    }

    emitChannel(normalizedRoomId, 'voiceChannelParticipantsUpdate', {
        channelId: normalizedRoomId,
        participants: await getChannelParticipantsAsync(normalizedRoomId),
    });
}

async function processLiveKitWebhookEvent(event) {
    const eventName = event?.event;
    const roomId = event?.room?.name;

    if (!eventName || !roomId) {
        console.warn('[livekit-webhook] Ignoring event without event or room:', event);
        return;
    }

    console.log('[livekit-webhook] Event received:', {
        event: eventName,
        room: roomId,
        participant: event?.participant?.identity || null,
    });

    if (eventName === 'room_finished') {
        await clearVoiceChannelFromLiveKit(roomId);
        return;
    }

    if (eventName === 'participant_joined') {
        await applyLiveKitParticipantJoined(roomId, event.participant);
        return;
    }

    if (eventName === 'participant_left') {
        await applyLiveKitParticipantLeft(roomId, event.participant);
    }
}

async function handleLiveKitWebhook(req, res) {
    try {
        verifyLiveKitWebhook(req);
        const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
        const event = JSON.parse(rawBody);
        await processLiveKitWebhookEvent(event);
        res.status(200).json({ ok: true });
    } catch (error) {
        console.warn('[livekit-webhook] Rejected webhook:', error.message);
        res.status(401).json({ error: 'invalid livekit webhook' });
    }
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
    console.log('Client connected:', socket.id, {
        authenticated: Boolean(socket.data.authenticated),
        userId: socket.data.userId || null,
    });

    if (socket.data.userId) {
        socket.join(userRoomName(socket.data.userId));
    }

    socket.on('subscribeChannel', async ({ channelId }) => {
        const normalizedChannelId = normalizeChannelId(channelId);
        if (!normalizedChannelId) return;
        socket.join(channelRoomName(normalizedChannelId));
        socket.emit('voiceChannelParticipantsUpdate', {
            channelId: normalizedChannelId,
            participants: await getChannelParticipantsAsync(normalizedChannelId),
        });
    });

    socket.on('unsubscribeChannel', ({ channelId }) => {
        const normalizedChannelId = normalizeChannelId(channelId);
        if (!normalizedChannelId) return;
        socket.leave(channelRoomName(normalizedChannelId));
    });

    socket.on('subscribeServer', ({ serverId }) => {
        if (!serverId) return;
        socket.join(serverRoomName(serverId));
    });

    // Handle voice activity
    socket.on('speaking', ({ speaking }) => {
        const peer = peers.get(socket.id);
        if (!peer || !socket.data?.roomId) return;

        const room = rooms.get(socket.data.roomId);
        if (!room) return;

        // Only update speaking state if the peer is not muted
        if (!peer.muted) {
            const nextSpeaking = Boolean(speaking);
            const now = Date.now();
            const lastUpdateAt = peerSpeakingUpdateAt.get(socket.id) || 0;
            if (peer.speaking === nextSpeaking && now - lastUpdateAt < SPEAKING_UPDATE_MIN_INTERVAL_MS) {
                return;
            }

            peer.speaking = nextSpeaking;
            peerSpeakingUpdateAt.set(socket.id, now);
            scheduleChannelUpdate(room.id, 250);
            // Broadcast speaking state to all peers in the room
            socket.to(room.id).emit('speakingStateChanged', {
                peerId: socket.id,
                userId: peer.userId, // Добавляем userId для правильного сопоставления
                speaking: nextSpeaking
            });
        } else if (!speaking) {
            peer.speaking = false;
            peerSpeakingUpdateAt.set(socket.id, Date.now());
            scheduleChannelUpdate(room.id, 250);
        }
    });

    socket.on('muteState', ({ isMuted }) => {
        const peer = peers.get(socket.id);
        if (!peer || !socket.data?.roomId) return;

        const room = rooms.get(socket.data.roomId);
        if (!room) return;

        if (peer.serverMuted && !isMuted) {
            socket.emit('serverVoiceModerationApplied', {
                serverId: peer.serverId || null,
                serverMuted: true,
                serverDeafened: Boolean(peer.serverDeafened),
                isMuted: true,
            });
            return;
        }

        peer.muted = isMuted;
        
        // Update global user voice state
        if (peer.userId) {
            const userState = updateUserVoiceState(peer.userId, { isMuted });
            persistChannelParticipant(room.id, serializeParticipantFromPeer(peer, userState));
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

        if (peer.userId) {
            emitVoiceState(peer, 'globalMuteState', {
                userId: peer.userId,
                isMuted,
            });
        }

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

    socket.on('join', async ({ roomId, name, userId, serverId = null, initialMuted = false, initialAudioEnabled = true, avatar = null, avatarColor = '#5865f2' }, callback) => {
        try {
            const effectiveUserId = socket.data.userId || (VOICE_ALLOW_ANON ? userId : null);
            const effectiveName = socket.data.username || name || 'User';
            if (!effectiveUserId) {
                callback({ error: 'Unauthorized voice join' });
                return;
            }

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

            if (disconnectGraceTimers.has(effectiveUserId)) {
                clearTimeout(disconnectGraceTimers.get(effectiveUserId));
                disconnectGraceTimers.delete(effectiveUserId);
            }

            if (effectiveUserId) {
                evictUserPeersFromRoom(room, effectiveUserId, socket.id);
            }

            const existingUserState = effectiveUserId ? getUserVoiceState(effectiveUserId) : {};
            const normalizedServerId = serverId ? String(serverId) : null;
            const { serverMuted, serverDeafened } = getServerModerationState(
                existingUserState,
                normalizedServerId
            );
            const effectiveMuted = serverMuted || initialMuted;
            const effectiveAudioEnabled = serverDeafened ? false : initialAudioEnabled;

            // Create peer with initial states
            const peer = {
                id: socket.id,
                socket: socket,
                roomId: roomId,
                serverId: normalizedServerId,
                name: effectiveName,
                userId: effectiveUserId,
                muted: effectiveMuted,
                audioEnabled: effectiveAudioEnabled,
                serverMuted,
                serverDeafened,
                speaking: false,
                avatar: avatar,
                avatarColor: avatarColor
            };
            
            // Обновляем глобальное состояние пользователя при подключении к комнате
            updateUserVoiceState(effectiveUserId, { 
                channelId: roomId, 
                userName: effectiveName, 
                isMuted: effectiveMuted, 
                isAudioDisabled: !effectiveAudioEnabled,
                avatar: avatar,
                avatarColor: avatarColor
            });

            if (normalizedServerId && (serverMuted || serverDeafened)) {
                socket.emit('serverVoiceModerationApplied', {
                    serverId: normalizedServerId,
                    serverMuted,
                    serverDeafened,
                    isMuted: effectiveMuted,
                    isGlobalAudioMuted: !effectiveAudioEnabled,
                });
            }
            
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
            socket.join(channelRoomName(roomId));
            if (normalizedServerId) {
                socket.join(serverRoomName(normalizedServerId));
            }

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
                        isServerMuted: Boolean(existingPeer.serverMuted),
                        isServerDeafened: Boolean(existingPeer.serverDeafened),
                        userId: existingPeer.userId
                    });
                }
            });

            // Generate and return the LiveKit token before fan-out presence updates.
            const token = await generateToken(roomId, effectiveName, effectiveUserId || socket.id);

            console.log(`Generated token for ${effectiveName} in room ${roomId}:`, {
                tokenType: typeof token,
                tokenLength: token?.length,
                tokenPreview: token ? token.substring(0, 20) + '...' : 'null'
            });

            callback({
                token: token,
                url: LIVEKIT_EXTERNAL_URL,
                existingPeers: existingPeers
            });

            // Получаем реальное состояние пользователя из глобального хранилища
            const userState = getUserVoiceState(peer.userId);
            persistChannelParticipant(roomId, serializeParticipantFromPeer(peer, userState));

            // Notify other peers after the joining client can start LiveKit connect.
            socket.to(roomId).emit('peerJoined', {
                peerId: peer.id,
                name: peer.name,
                isMuted: peer.muted,
                isAudioEnabled: peer.audioEnabled,
                isGlobalAudioMuted: userState.isAudioDisabled || false,
                isServerMuted: Boolean(peer.serverMuted),
                isServerDeafened: Boolean(peer.serverDeafened),
                userId: peer.userId
            });

            // Отправляем глобальное событие о присоединении к голосовому каналу
            // (для всех клиентов, даже тех кто не в звонке)
            emitChannel(roomId, 'userJoinedVoiceChannel', {
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

            console.log(`Peer ${effectiveName} (${socket.id}) joined room ${roomId}`);
            console.log('Existing peers:', existingPeers);

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

    socket.on('serverVoiceModeration', ({
        channelId,
        serverId,
        targetUserId,
        moderatorUserId,
        muteMic,
        deafen,
    }) => {
        const moderatorPeer = peers.get(socket.id);
        if (!moderatorPeer || !moderatorPeer.userId) return;
        if (String(moderatorPeer.userId) !== String(moderatorUserId)) return;

        const normalizedChannelId = normalizeChannelId(channelId);
        const room = rooms.get(channelId) || rooms.get(normalizedChannelId);
        if (!room) return;

        let targetPeer = null;
        room.peers.forEach((peer) => {
            if (String(peer.userId) === String(targetUserId)) {
                targetPeer = peer;
            }
        });

        if (!targetPeer || !targetPeer.socket) return;

        const moderationServerId = serverId
            ? String(serverId)
            : targetPeer.serverId
              ? String(targetPeer.serverId)
              : null;

        if (moderationServerId && !targetPeer.serverId) {
            targetPeer.serverId = moderationServerId;
        }

        if (muteMic !== undefined && muteMic !== null) {
            if (muteMic) {
                targetPeer.serverMuted = true;
                targetPeer.muted = true;
                const updatedState = updateUserVoiceState(targetUserId, { isMuted: true });
                persistChannelParticipant(room.id, serializeParticipantFromPeer(targetPeer, updatedState));
                if (moderationServerId) {
                    updateServerModeration(targetUserId, moderationServerId, { serverMuted: true });
                }
            } else {
                targetPeer.serverMuted = false;
                if (moderationServerId) {
                    updateServerModeration(targetUserId, moderationServerId, { serverMuted: false });
                }
            }
        }

        if (deafen !== undefined && deafen !== null) {
            if (deafen) {
                targetPeer.serverDeafened = true;
                targetPeer.audioEnabled = false;
                const updatedState = updateUserVoiceState(targetUserId, { isAudioDisabled: true });
                persistChannelParticipant(room.id, serializeParticipantFromPeer(targetPeer, updatedState));
                if (moderationServerId) {
                    updateServerModeration(targetUserId, moderationServerId, { serverDeafened: true });
                }
            } else {
                targetPeer.serverDeafened = false;
                if (moderationServerId) {
                    updateServerModeration(targetUserId, moderationServerId, { serverDeafened: false });
                }
            }
        }

        const appliedState = {
            serverId: moderationServerId,
            serverMuted: Boolean(targetPeer.serverMuted),
            serverDeafened: Boolean(targetPeer.serverDeafened),
        };

        if (muteMic === true) {
            appliedState.isMuted = true;
        } else if (muteMic === false) {
            appliedState.isMuted = Boolean(targetPeer.muted);
        } else if (targetPeer.serverMuted) {
            appliedState.isMuted = Boolean(targetPeer.muted);
        }

        if (deafen === true) {
            appliedState.isGlobalAudioMuted = true;
        } else if (deafen === false) {
            // Only lift server block — user keeps their own headphone preference.
        } else if (targetPeer.serverDeafened) {
            appliedState.isGlobalAudioMuted = true;
        }

        const moderationBroadcast = {
            ...appliedState,
            userId: targetUserId,
            channelId: normalizedChannelId,
        };
        io.to(room.id).emit('serverVoiceModerationApplied', moderationBroadcast);

        io.to(room.id).emit('peerMuteStateChanged', {
            peerId: targetPeer.id,
            userId: targetUserId,
            isMuted: targetPeer.muted,
        });

        emitVoiceState(targetPeer, 'globalMuteState', {
            userId: targetUserId,
            isMuted: Boolean(targetPeer.muted),
        });

        io.to(room.id).emit('peerAudioStateChanged', {
            peerId: targetPeer.id,
            userId: targetUserId,
            isEnabled: targetPeer.audioEnabled,
            isGlobalAudioMuted: !targetPeer.audioEnabled,
        });

        emitVoiceState(targetPeer, 'globalAudioState', {
            userId: targetUserId,
            isGlobalAudioMuted: !targetPeer.audioEnabled,
        });

        scheduleChannelUpdate(room.id, 100);
    });

    // Add audio state handling
    socket.on('audioState', ({ isEnabled, isGlobalAudioMuted, userId }) => {
        const peer = peers.get(socket.id);
        if (!peer || !socket.data?.roomId) return;

        const room = rooms.get(peer.roomId);
        if (!room) return;

        const wantsUndeafen = isEnabled === true || isGlobalAudioMuted === false;
        if (peer.serverDeafened && wantsUndeafen) {
            socket.emit('serverVoiceModerationApplied', {
                serverId: peer.serverId || null,
                serverMuted: Boolean(peer.serverMuted),
                serverDeafened: true,
                isGlobalAudioMuted: true,
            });
            return;
        }

        // Update peer's audio state
        peer.audioEnabled = isEnabled;
        
        // Update global user voice state if provided
        const realUserId = userId || peer.userId;
        if (realUserId && isGlobalAudioMuted !== undefined) {
            const userState = updateUserVoiceState(realUserId, { isAudioDisabled: isGlobalAudioMuted });
            persistChannelParticipant(room.id, serializeParticipantFromPeer(peer, userState));
        }
        
        // Broadcast to all peers in the room (including sender for consistency)
        io.to(room.id).emit('peerAudioStateChanged', {
            peerId: socket.id,
            isEnabled,
            isGlobalAudioMuted,
            userId: realUserId
        });
        
        // Also emit global event for all clients (even those not in the call)
        emitVoiceState(peer, 'globalAudioState', {
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
    socket.on('getVoiceChannelParticipants', async (data) => {
        try {
            const requestedChannelId = data?.channelId;
            
            // Если запрошен конкретный канал - отправляем только его
            if (requestedChannelId) {
                const participants = await getChannelParticipantsAsync(requestedChannelId);
                socket.emit('voiceChannelParticipantsUpdate', {
                    channelId: requestedChannelId,
                    participants: participants
                });
                return;
            }

            if (!VOICE_ALLOW_ANON) {
                socket.emit('voiceChannelParticipantsError', {
                    error: 'channelId is required',
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

            // Уведомляем подписчиков о пустых комнатах
            emptyRooms.forEach(roomId => {
                emitChannel(roomId, 'voiceChannelParticipantsUpdate', {
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
            for (const channelId of allChannelIds) {
                const participants = await getChannelParticipantsAsync(channelId);
                
                socket.emit('voiceChannelParticipantsUpdate', {
                    channelId: channelId,
                    participants: participants
                });
            }
        } catch (error) {
            console.error('Error in getVoiceChannelParticipants:', error);
        }
    });

    // Обработчик для уведомления о присоединении пользователя к голосовому каналу
    socket.on('userJoinedVoiceChannel', ({ channelId, userId, userName, isMuted }) => {
        try {
            if (!VOICE_ALLOW_ANON) return;
            emitChannel(channelId, 'userJoinedVoiceChannel', {
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
            if (!VOICE_ALLOW_ANON) return;
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
                    emitChannel(channelId, 'voiceChannelParticipantsUpdate', {
                        channelId: channelId,
                        participants: []
                    });
                } else {
                    // Отправляем уведомление всем клиентам о выходе конкретного пользователя
                    emitChannel(channelId, 'userLeftVoiceChannel', {
                        channelId,
                        userId
                    });
                }
            } else {
                console.log(`Room ${channelId} not found for user ${userId}`);
                // Даже если комната не найдена, отправляем обновление с пустым списком участников
                emitChannel(channelId, 'voiceChannelParticipantsUpdate', {
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
            if (!VOICE_ALLOW_ANON) return;
            emitChannel(channelId, 'voiceChannelParticipantStateChanged', {
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
    socket.on('updateUserVoiceState', async ({ userId, userName, channelId, isMuted, isAudioDisabled }) => {
        try {
            const effectiveUserId = socket.data.userId || (VOICE_ALLOW_ANON ? userId : null);
            if (!effectiveUserId || String(effectiveUserId) !== String(userId)) return;

            const updates = {};
            if (userName !== undefined) updates.userName = userName;
            if (channelId !== undefined) updates.channelId = channelId;
            if (isMuted !== undefined) updates.isMuted = isMuted;
            if (isAudioDisabled !== undefined) updates.isAudioDisabled = isAudioDisabled;
            
            updateUserVoiceState(effectiveUserId, updates);
            
            // Если пользователь присоединился/покинул канал, обновляем информацию о канале
            if (channelId !== undefined) {
                // Мгновенное обновление для смены канала
                const participants = await getChannelParticipantsAsync(channelId);
                console.log(`[INSTANT_UPDATE] Channel ${channelId}: ${participants.length} participants`);
                emitChannel(channelId, 'voiceChannelParticipantsUpdate', {
                    channelId: channelId,
                    participants: participants
                });
                
                // Если пользователь покинул канал, также обновляем предыдущий канал
                const currentState = getUserVoiceState(effectiveUserId);
                if (currentState.channelId && currentState.channelId !== channelId) {
                    const oldParticipants = await getChannelParticipantsAsync(currentState.channelId);
                    emitChannel(currentState.channelId, 'voiceChannelParticipantsUpdate', {
                        channelId: currentState.channelId,
                        participants: oldParticipants
                    });
                }
            } else {
                // Для изменений состояния (микрофон/наушники) - тоже мгновенно
                const userState = getUserVoiceState(effectiveUserId);
                if (userState.channelId) {
                    const participants = await getChannelParticipantsAsync(userState.channelId);
                    console.log(`[INSTANT_UPDATE] State change for channel ${userState.channelId}: ${participants.length} participants`);
                    emitChannel(userState.channelId, 'voiceChannelParticipantsUpdate', {
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
    socket.on('switchUserToChannel', async ({
        userId,
        targetChannelId,
        channelName,
        categoryId,
        categoryName,
        categoryOrder,
        chatOrder,
    }, callback) => {
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
            serverId: peerToMove.serverId || null,
            serverMuted: peerToMove.serverMuted || false,
            serverDeafened: peerToMove.serverDeafened || false,
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
        emitChannel(sourceChannelId, 'userLeftVoiceChannel', {
            channelId: sourceChannelId,
            userId: userId
        });
        
        // Если исходная комната стала пустой, удаляем её
        if (sourceRoom.peers.size === 0) {
            rooms.delete(sourceChannelId);
            emitChannel(sourceChannelId, 'voiceChannelParticipantsUpdate', {
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
                sourceChannelId: sourceChannelId,
                channelName: channelName || null,
                categoryId: categoryId ?? null,
                categoryName: categoryName || null,
                categoryOrder: categoryOrder ?? null,
                chatOrder: chatOrder ?? null,
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
        persistChannelParticipant(targetChannelId, serializeParticipantFromPeer(peerData, getUserVoiceState(userId)));
        await removeChannelParticipant(sourceChannelId, userId);
        
        // Уведомляем о присоединении к новому каналу
        emitChannel(targetChannelId, 'userJoinedVoiceChannel', {
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
    socket.on('leave', async ({ roomId }) => {
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
                await removeChannelParticipant(actualRoomId, peer.userId);
                
                // Уведомляем всех клиентов о выходе пользователя
                emitChannel(actualRoomId, 'userLeftVoiceChannel', {
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
            emitChannel(actualRoomId, 'voiceChannelParticipantsUpdate', {
                channelId: actualRoomId,
                participants: []
            });
        } else {
            // Уведомляем остальных участников о выходе
            socket.to(room.id).emit('peerLeft', { peerId: socket.id, userId: peer.userId });
            
            // Отправляем обновленный список участников
            scheduleChannelUpdate(actualRoomId, 100);
        }
    });

    // Обработчик отключения сокета
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);

        const peer = peers.get(socket.id);
        if (!peer) return;

        const graceKey = peer.userId || socket.id;
        const roomId = peer.roomId;
        const graceUntil = Date.now() + VOICE_RECONNECT_GRACE_MS;
        if (peer.userId) {
            updateUserVoiceState(peer.userId, { lastSeen: Date.now(), graceUntil });
        }

        if (disconnectGraceTimers.has(graceKey)) {
            clearTimeout(disconnectGraceTimers.get(graceKey));
        }

        disconnectGraceTimers.set(graceKey, setTimeout(async () => {
            disconnectGraceTimers.delete(graceKey);

            const currentPeer = peers.get(socket.id);
            if (!currentPeer || currentPeer.id !== peer.id) return;

            const room = rooms.get(roomId);
            if (peer.userId) {
                const userState = getUserVoiceState(peer.userId);
                if (userState.channelId) {
                    console.log(`Removing user ${peer.userId} from voice channel ${userState.channelId} after reconnect grace`);
                    updateUserVoiceState(peer.userId, { channelId: null, graceUntil: null });
                    await removeChannelParticipant(userState.channelId, peer.userId);
                    emitChannel(userState.channelId, 'userLeftVoiceChannel', {
                        channelId: userState.channelId,
                        userId: peer.userId
                    });
                    scheduleChannelUpdate(userState.channelId, 100);
                }
            }

            if (room) {
                room.peers.delete(socket.id);
                console.log(`Peer ${socket.id} removed from room ${roomId} after reconnect grace`);
                if (room.peers.size === 0) {
                    rooms.delete(roomId);
                    console.log(`Empty room ${roomId} removed`);
                    emitChannel(roomId, 'voiceChannelParticipantsUpdate', {
                        channelId: roomId,
                        participants: []
                    });
                } else {
                    socket.to(room.id).emit('peerLeft', { peerId: socket.id, userId: peer.userId });
                    scheduleChannelUpdate(roomId, 100);
                }
            } else if (roomId) {
                emitChannel(roomId, 'voiceChannelParticipantsUpdate', {
                    channelId: roomId,
                    participants: []
                });
            }

            peers.delete(socket.id);
            peerSpeakingUpdateAt.delete(socket.id);
        }, VOICE_RECONNECT_GRACE_MS));
    });

});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

setInterval(() => {
    reconcileUserVoiceStates();
    for (const [roomId, room] of rooms.entries()) {
        if (room.peers.size > 0) {
            scheduleChannelUpdate(roomId, 0);
        }
    }
}, 15000);

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
