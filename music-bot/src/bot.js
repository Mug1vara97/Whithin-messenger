const { Room, RoomEvent } = require('@livekit/rtc-node');
const { AccessToken } = require('livekit-server-sdk');
const { io } = require('socket.io-client');
const { MusicPlayer } = require('./musicPlayer');
const { CommandHandler } = require('./commandHandler');

class MusicBot {
  constructor() {
    this.rooms = new Map(); // roomId -> { room, player, handler }
    this.socket = null;
    this.isConnected = false;
    
    // Configuration
    this.LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://whithin.ru';
    this.LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
    this.LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'this_is_a_very_long_secret_key_for_livekit_server_at_least_32_chars';
    this.VOICE_SERVER_URL = process.env.VOICE_SERVER_URL || 'https://whithin.ru';
    this.BOT_USER_ID = process.env.BOT_USER_ID || 'music-bot-001';
    this.BOT_USER_NAME = process.env.BOT_USER_NAME || 'Music Bot';
  }

  async initialize() {
    console.log('[MusicBot] Initializing Music Bot...');
    
    // Connect to voice server via Socket.IO
    await this.connectToVoiceServer();
    
    console.log('[MusicBot] Music Bot initialized');
  }

  async connectToVoiceServer() {
    return new Promise((resolve, reject) => {
      const connectOptions = {
        transports: ['websocket'],
        upgrade: false,
        rememberUpgrade: false,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity
      };

      this.socket = io(this.VOICE_SERVER_URL, connectOptions);

      this.socket.on('connect', () => {
        console.log('[MusicBot] Connected to voice server:', this.VOICE_SERVER_URL);
        this.isConnected = true;
        
        // Register bot as a special user
        this.socket.emit('registerBot', {
          botId: this.BOT_USER_ID,
          botName: this.BOT_USER_NAME
        });
        
        resolve();
      });

      this.socket.on('disconnect', () => {
        console.log('[MusicBot] Disconnected from voice server');
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('[MusicBot] Connection error to', this.VOICE_SERVER_URL, ':', error.message);
        // Не отклоняем промис, чтобы бот продолжал работать и пытался переподключиться
        // reject(error);
      });

      // Listen for room join requests
      this.socket.on('botJoinRoom', async (data) => {
        const { roomId, channelId } = data;
        const targetRoomId = roomId || channelId;
        console.log(`[MusicBot] Received botJoinRoom event:`, { roomId, channelId, targetRoomId, fullData: data });
        if (!targetRoomId) {
          console.error('[MusicBot] No roomId or channelId provided in botJoinRoom event');
          return;
        }
        await this.joinRoom(targetRoomId);
      });

      // Listen for room leave requests
      this.socket.on('botLeaveRoom', (data) => {
        const { roomId, channelId } = data;
        this.leaveRoom(roomId || channelId);
      });

      // Listen for commands
      this.socket.on('botCommand', async (data) => {
        const { roomId, command, args, userId } = data;
        console.log(`[MusicBot] Received botCommand event:`, { roomId, command, args, userId, fullData: data });
        if (!roomId) {
          console.error('[MusicBot] No roomId provided in botCommand event');
          return;
        }
        await this.handleCommand(roomId, command, args, userId);
      });
    });
  }

  async generateToken(roomName) {
    const at = new AccessToken(this.LIVEKIT_API_KEY, this.LIVEKIT_API_SECRET, {
      identity: this.BOT_USER_ID,
      name: this.BOT_USER_NAME,
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return await at.toJwt();
  }

  async joinRoom(roomId) {
    if (this.rooms.has(roomId)) {
      console.log(`[MusicBot] Bot already in room: ${roomId}`);
      return;
    }

    try {
      console.log(`[MusicBot] Joining room: ${roomId}`);
      
      // Generate token
      const token = await this.generateToken(roomId);
      
      // Create LiveKit room
      const room = new Room();
      
      // Create music player for this room
      const player = new MusicPlayer(room);
      
      // Create command handler
      const handler = new CommandHandler(player, roomId, this.socket);
      
      // Connect to room
      await room.connect(this.LIVEKIT_URL, token, {
        autoSubscribe: true,
        dynacast: true
      });
      console.log(`[MusicBot] Connected to LiveKit room: ${roomId}`);
      
      // Set up room event handlers
      room.on(RoomEvent.Disconnected, () => {
        console.log(`[MusicBot] Disconnected from room ${roomId}`);
        this.leaveRoom(roomId);
      });
      
      room.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log(`[MusicBot] Participant connected to room ${roomId}:`, participant.identity);
      });
      
      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        console.log(`[MusicBot] Participant disconnected from room ${roomId}:`, participant.identity);
        
        // If no participants left, optionally leave the room
        if (room.remoteParticipants.size === 0) {
          console.log(`[MusicBot] No participants left, leaving room ${roomId}`);
          // Optionally auto-leave after delay
          // setTimeout(() => this.leaveRoom(roomId), 60000); // 1 minute
        }
      });
      
      // Start publishing audio track
      await player.start();
      
      // Store room data
      this.rooms.set(roomId, { room, player, handler });
      
      // Notify voice server
      if (this.socket) {
        this.socket.emit('botJoinedRoom', { roomId, botId: this.BOT_USER_ID });
      }
      
      console.log(`[MusicBot] Bot successfully joined room: ${roomId}`);
    } catch (error) {
      console.error(`[MusicBot] Error joining room ${roomId}:`, error);
      throw error;
    }
  }

  async leaveRoom(roomId) {
    const roomData = this.rooms.get(roomId);
    if (!roomData) {
      console.log(`[MusicBot] Bot not in room: ${roomId}`);
      return;
    }

    try {
      console.log(`[MusicBot] Leaving room: ${roomId}`);
      
      // Stop music player
      await roomData.player.cleanup();
      
      // Disconnect from room
      await roomData.room.disconnect();
      
      // Remove from map
      this.rooms.delete(roomId);
      
      // Notify voice server
      if (this.socket) {
        this.socket.emit('botLeftRoom', { roomId, botId: this.BOT_USER_ID });
      }
      
      console.log(`[MusicBot] Bot left room: ${roomId}`);
    } catch (error) {
      console.error(`[MusicBot] Error leaving room ${roomId}:`, error);
    }
  }

  async handleCommand(roomId, command, args, userId) {
    console.log(`[MusicBot] handleCommand called:`, { roomId, command, args, userId });
    console.log(`[MusicBot] Current rooms:`, Array.from(this.rooms.keys()));
    
    const roomData = this.rooms.get(roomId);
    if (!roomData) {
      console.log(`[MusicBot] Bot not in room: ${roomId}. Available rooms:`, Array.from(this.rooms.keys()));
      // Try to find room by string comparison
      const roomIdStr = String(roomId);
      for (const [key, value] of this.rooms.entries()) {
        if (String(key) === roomIdStr) {
          console.log(`[MusicBot] Found room by string comparison: ${key}`);
          await value.handler.handleCommand(command, args, userId);
          return;
        }
      }
      return;
    }

    try {
      await roomData.handler.handleCommand(command, args, userId);
    } catch (error) {
      console.error(`[MusicBot] Error handling command ${command} in room ${roomId}:`, error);
    }
  }

  disconnectAll() {
    console.log('[MusicBot] Disconnecting from all rooms...');
    const roomIds = Array.from(this.rooms.keys());
    roomIds.forEach(roomId => {
      this.leaveRoom(roomId);
    });
    
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

module.exports = { MusicBot };
