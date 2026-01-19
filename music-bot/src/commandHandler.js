class CommandHandler {
  constructor(player, roomId, socket) {
    this.player = player;
    this.roomId = roomId;
    this.socket = socket;
  }

  async handleCommand(command, args, userId) {
    const cmd = command.toLowerCase().trim();
    
    try {
      switch (cmd) {
        case 'play':
        case 'p':
          if (args.length === 0) {
            this.sendMessage('Error: Please provide a URL or search query');
            return;
          }
          const url = args.join(' ');
          await this.player.addToQueue(url);
          this.sendMessage(`Added to queue: ${url}`);
          break;
          
        case 'pause':
          await this.player.pause();
          this.sendMessage('Music paused');
          break;
          
        case 'resume':
        case 'unpause':
          await this.player.resume();
          this.sendMessage('Music resumed');
          break;
          
        case 'stop':
          await this.player.stop();
          this.sendMessage('Music stopped');
          break;
          
        case 'skip':
        case 'next':
          await this.player.skip();
          this.sendMessage('Skipped to next track');
          break;
          
        case 'queue':
        case 'q':
          const queueInfo = this.getQueueInfo();
          this.sendMessage(queueInfo);
          break;
          
        case 'clear':
          this.player.clearQueue();
          this.sendMessage('Queue cleared');
          break;
          
        case 'volume':
        case 'vol':
          if (args.length === 0) {
            this.sendMessage(`Current volume: ${Math.round(this.player.volume * 100)}%`);
            return;
          }
          const volume = parseFloat(args[0]);
          if (isNaN(volume) || volume < 0 || volume > 100) {
            this.sendMessage('Error: Volume must be between 0 and 100');
            return;
          }
          this.player.setVolume(volume / 100);
          this.sendMessage(`Volume set to: ${volume}%`);
          break;
          
        case 'help':
          this.sendMessage(this.getHelpMessage());
          break;
          
        default:
          this.sendMessage(`Unknown command: ${command}. Use !help for available commands.`);
      }
    } catch (error) {
      console.error('Error handling command:', error);
      this.sendMessage(`❌ Error: ${error.message}`);
    }
  }

  getQueueInfo() {
    if (this.player.queue.length === 0) {
      return 'Queue is empty';
    }
    
    let info = `Queue (${this.player.queue.length} items):\n`;
    this.player.queue.forEach((url, index) => {
      const marker = index === this.player.currentIndex ? '> ' : '  ';
      info += `${marker}${index + 1}. ${url}\n`;
    });
    
    return info;
  }

  getHelpMessage() {
    return `Music Bot Commands:
!play <url> - Add music to queue
!pause - Pause playback
!resume - Resume playback
!stop - Stop playback
!skip - Skip to next track
!queue - Show current queue
!clear - Clear queue
!volume <0-100> - Set volume
!help - Show this help`;
  }

  sendMessage(message) {
    // Send message back to voice server
    if (this.socket) {
      this.socket.emit('botMessage', {
        roomId: this.roomId,
        message: message,
        botId: 'music-bot-001'
      });
    }
  }
}

module.exports = { CommandHandler };
