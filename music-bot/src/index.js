require('dotenv').config();
const { MusicBot } = require('./bot');
const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.BOT_PORT || 3001;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'music-bot' });
});

app.listen(PORT, () => {
  console.log(`Music Bot API server running on port ${PORT}`);
});

// Initialize bot
const bot = new MusicBot();
bot.initialize().catch((error) => {
  console.error('[MusicBot] Fatal error during initialization:', error);
  // Don't exit - let the bot try to reconnect
});

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('[MusicBot] Uncaught Exception:', error);
  // Don't exit - log and continue
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[MusicBot] Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - log and continue
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  bot.disconnectAll();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  bot.disconnectAll();
  process.exit(0);
});
