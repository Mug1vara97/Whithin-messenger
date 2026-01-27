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
            this.sendMessage('Укажите ссылку Яндекс.Музыки или поисковый запрос (например: !play группа — песня)');
            return;
          }
          const url = args.join(' ');
          try {
            await this.player.addToQueue(url);
            this.sendMessage(`Добавлено в очередь: ${url}`);
          } catch (error) {
            console.error('[CommandHandler] Error adding to queue:', error);
            this.sendMessage(`❌ ${error.message || 'Ошибка при добавлении в очередь'}`);
          }
          break;
          
        case 'pause':
          await this.player.pause();
          this.sendMessage('Пауза');
          break;
          
        case 'resume':
        case 'unpause':
          await this.player.resume();
          this.sendMessage('Продолжаем');
          break;
          
        case 'stop':
          await this.player.stop();
          this.sendMessage('Остановлено');
          break;
          
        case 'skip':
        case 'next':
          await this.player.skip();
          this.sendMessage('Следующий трек');
          break;
          
        case 'queue':
        case 'q':
          const queueInfo = this.getQueueInfo();
          this.sendMessage(queueInfo);
          break;
          
        case 'clear':
          this.player.clearQueue();
          this.sendMessage('Очередь очищена');
          break;
          
        case 'volume':
        case 'vol':
          if (args.length === 0) {
            this.sendMessage(`Громкость: ${Math.round(this.player.volume * 100)}%`);
            return;
          }
          const volume = parseFloat(args[0]);
          if (isNaN(volume) || volume < 0 || volume > 100) {
            this.sendMessage('Громкость от 0 до 100');
            return;
          }
          this.player.setVolume(volume / 100);
          this.sendMessage(`Громкость: ${volume}%`);
          break;
          
        case 'help':
          this.sendMessage(this.getHelpMessage());
          break;
          
        default:
          this.sendMessage(`Неизвестная команда. !help — подсказка.`);
      }
    } catch (error) {
      console.error('Error handling command:', error);
      this.sendMessage(`❌ Error: ${error.message}`);
    }
  }

  getQueueInfo() {
    if (this.player.queue.length === 0) {
      return 'Очередь пуста';
    }
    
    let info = `Очередь (${this.player.queue.length}):\n`;
    this.player.queue.forEach((url, index) => {
      const marker = index === this.player.currentIndex ? '> ' : '  ';
      info += `${marker}${index + 1}. ${url}\n`;
    });
    
    return info;
  }

  getHelpMessage() {
    return `Музыкальный бот (Яндекс.Музыка):
!play <ссылка или запрос> — добавить трек (ссылка music.yandex.ru или поиск)
!pause — пауза
!resume — продолжить
!stop — остановить
!skip — следующий трек
!queue — очередь
!clear — очистить очередь
!volume <0-100> — громкость
!help — эта подсказка`;
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
