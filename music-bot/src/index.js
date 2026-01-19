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
bot.initialize();

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
