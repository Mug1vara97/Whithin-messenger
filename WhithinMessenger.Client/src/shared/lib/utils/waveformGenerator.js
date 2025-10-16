/**
 * Генератор реалистичных волн для визуализации аудио
 * Создает волны в стиле современных мессенджеров
 */

export class WaveformGenerator {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.animationId = null;
    this.isAnimating = false;
  }

  /**
   * Создание реалистичной визуализации волн
   * @param {Array} amplitudes - массив амплитуд
   * @param {number} progress - прогресс воспроизведения (0-1)
   * @param {boolean} isPlaying - играет ли аудио
   * @param {Object} options - опции визуализации
   */
  createModernWaveform(amplitudes, progress = 0, isPlaying = false, options = {}) {
    // Валидация входных данных
    if (!Array.isArray(amplitudes) || amplitudes.length === 0) {
      console.warn('Invalid amplitudes data, using fallback');
      amplitudes = Array.from({ length: 35 }, () => Math.random() * 50 + 10);
    }

    // Валидация progress
    if (typeof progress !== 'number' || isNaN(progress)) {
      progress = 0;
    }
    progress = Math.max(0, Math.min(1, progress));

    const {
      width = 300,
      height = 40,
      barCount = 35,
      barSpacing = 2,
      barRadius = 2,
      colors = {
        played: '#4CAF50',
        current: '#2196F3',
        unplayed: '#E0E0E0',
        background: '#F5F5F5'
      }
    } = options;

    // Создаем canvas если его нет
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
    }

    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.clearRect(0, 0, width, height);

    // Вычисляем размеры баров
    const totalBarWidth = (width - (barCount - 1) * barSpacing);
    const barWidth = totalBarWidth / barCount;
    const maxBarHeight = height - 8; // Отступы сверху и снизу

    // Создаем градиент для фона
    this.createBackgroundGradient(width, height, colors.background);

    // Рисуем бары
    for (let i = 0; i < barCount; i++) {
      let amplitude = amplitudes[i] || 0;
      
      // Валидация амплитуды
      if (typeof amplitude !== 'number' || isNaN(amplitude)) {
        amplitude = 0;
      }
      amplitude = Math.max(0, Math.min(100, amplitude));
      
      const x = i * (barWidth + barSpacing);
      const barHeight = Math.max(2, (amplitude / 100) * maxBarHeight);
      const y = (height - barHeight) / 2;

      // Определяем состояние бара
      const barProgress = i / (barCount - 1);
      const isPlayed = barProgress < progress;
      const isCurrent = Math.abs(barProgress - progress) < 0.05;
      const isNearCurrent = Math.abs(barProgress - progress) < 0.15;

      // Выбираем цвет
      let color;
      if (isCurrent) {
        color = colors.current;
      } else if (isPlayed) {
        color = colors.played;
      } else if (isNearCurrent) {
        color = this.interpolateColor(colors.unplayed, colors.current, 0.5);
      } else {
        color = colors.unplayed;
      }

      // Рисуем бар с эффектами
      this.drawBar(x, y, barWidth, barHeight, color, barRadius, {
        isPlayed,
        isCurrent,
        isNearCurrent,
        amplitude
      });
    }

    // Добавляем эффекты для текущего бара
    if (isPlaying) {
      this.addPlayingEffects(barCount, barWidth, barSpacing, height, progress);
    }

    return this.canvas;
  }

  /**
   * Создание фонового градиента
   */
  createBackgroundGradient(width, height, backgroundColor) {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, backgroundColor);
    gradient.addColorStop(0.5, this.lightenColor(backgroundColor, 0.1));
    gradient.addColorStop(1, backgroundColor);
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);
  }

  /**
   * Рисование отдельного бара
   */
  drawBar(x, y, width, height, color, radius, effects) {
    const { isPlayed, isCurrent, isNearCurrent, amplitude } = effects;

    // Создаем градиент для бара
    const gradient = this.ctx.createLinearGradient(x, y, x, y + height);
    
    if (isCurrent) {
      gradient.addColorStop(0, this.lightenColor(color, 0.3));
      gradient.addColorStop(0.5, color);
      gradient.addColorStop(1, this.darkenColor(color, 0.2));
    } else if (isPlayed) {
      gradient.addColorStop(0, this.lightenColor(color, 0.2));
      gradient.addColorStop(0.5, color);
      gradient.addColorStop(1, this.darkenColor(color, 0.1));
    } else {
      gradient.addColorStop(0, this.lightenColor(color, 0.1));
      gradient.addColorStop(0.5, color);
      gradient.addColorStop(1, this.darkenColor(color, 0.1));
    }

    this.ctx.fillStyle = gradient;

    // Рисуем закругленный прямоугольник
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, width, height, radius);
    this.ctx.fill();

    // Добавляем блик для активных баров
    if (isCurrent || isPlayed) {
      this.addBarHighlight(x, y, width, height, radius);
    }

    // Добавляем тень для глубины
    this.addBarShadow(x, y, width, height, radius);
  }

  /**
   * Добавление блика к бару
   */
  addBarHighlight(x, y, width, height, radius) {
    const highlightGradient = this.ctx.createLinearGradient(x, y, x, y + height);
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    highlightGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.2)');
    highlightGradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.1)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    this.ctx.fillStyle = highlightGradient;
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, width, height, radius);
    this.ctx.fill();
  }

  /**
   * Добавление тени к бару
   */
  addBarShadow(x, y, width, height, radius) {
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    this.ctx.shadowBlur = 2;
    this.ctx.shadowOffsetY = 1;
    
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, width, height, radius);
    this.ctx.fill();
    
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetY = 0;
  }

  /**
   * Добавление эффектов воспроизведения
   */
  addPlayingEffects(barCount, barWidth, barSpacing, height, progress) {
    const currentBarIndex = Math.floor(progress * (barCount - 1));
    const x = currentBarIndex * (barWidth + barSpacing);
    const y = height / 2;

    // Создаем пульсирующий эффект
    const time = Date.now() * 0.005;
    const pulse = Math.sin(time) * 0.5 + 0.5;
    const pulseRadius = 8 + pulse * 4;

    // Рисуем пульсирующий круг
    const gradient = this.ctx.createRadialGradient(x + barWidth/2, y, 0, x + barWidth/2, y, pulseRadius);
    gradient.addColorStop(0, 'rgba(33, 150, 243, 0.3)');
    gradient.addColorStop(0.7, 'rgba(33, 150, 243, 0.1)');
    gradient.addColorStop(1, 'rgba(33, 150, 243, 0)');

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x + barWidth/2, y, pulseRadius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  /**
   * Создание более реалистичных волн
   */
  generateRealisticWaves(duration, sampleRate = 44100) {
    const bars = 35;
    const samplesPerBar = Math.floor((duration * sampleRate) / bars);
    const waves = [];

    for (let i = 0; i < bars; i++) {
      // Создаем более естественную форму волны
      const baseAmplitude = 20 + Math.sin(i * 0.4) * 15;
      const variation = Math.random() * 25;
      const envelope = Math.sin((i / bars) * Math.PI); // Огибающая
      
      // Добавляем микро-вариации для реализма
      const microVariation = Math.sin(i * 0.8) * 5;
      
      const amplitude = Math.max(5, Math.min(95, 
        (baseAmplitude + variation + microVariation) * envelope
      ));
      
      waves.push(amplitude);
    }

    return waves;
  }

  /**
   * Создание волн на основе реального аудио
   */
  async generateFromAudio(audioFile, barsCount = 35) {
    try {
      const arrayBuffer = await audioFile.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      const duration = audioBuffer.duration;
      
      const segmentSize = Math.floor(channelData.length / barsCount);
      const waves = [];

      for (let i = 0; i < barsCount; i++) {
        const start = i * segmentSize;
        const end = Math.min(start + segmentSize, channelData.length);
        const segment = channelData.slice(start, end);
        
        // Вычисляем RMS
        let sum = 0;
        for (let j = 0; j < segment.length; j++) {
          sum += segment[j] * segment[j];
        }
        const rms = Math.sqrt(sum / segment.length);
        
        // Применяем логарифмическую шкалу
        const logValue = 20 * Math.log10(rms + 1e-10);
        const normalized = Math.max(0, Math.min(100, (logValue + 60) * 1.67));
        
        waves.push(normalized);
      }

      audioContext.close();
      return waves;
    } catch (error) {
      console.error('Ошибка генерации волн из аудио:', error);
      return this.generateRealisticWaves(10); // Fallback
    }
  }

  /**
   * Анимация волн
   */
  animateWaveform(amplitudes, progress, isPlaying, options = {}) {
    if (this.isAnimating) {
      cancelAnimationFrame(this.animationId);
    }

    this.isAnimating = true;
    
    const animate = () => {
      this.createModernWaveform(amplitudes, progress, isPlaying, options);
      
      if (isPlaying) {
        this.animationId = requestAnimationFrame(animate);
      } else {
        this.isAnimating = false;
      }
    };

    animate();
  }

  /**
   * Остановка анимации
   */
  stopAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.isAnimating = false;
  }

  /**
   * Утилиты для работы с цветами
   */
  lightenColor(color, factor) {
    if (!color || typeof color !== 'string') return '#E0E0E0';
    
    const hex = color.replace('#', '');
    if (hex.length !== 6) return '#E0E0E0';
    
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    if (isNaN(r) || isNaN(g) || isNaN(b)) return '#E0E0E0';
    
    return `rgb(${Math.min(255, Math.max(0, r + (255 - r) * factor))}, ${Math.min(255, Math.max(0, g + (255 - g) * factor))}, ${Math.min(255, Math.max(0, b + (255 - b) * factor))})`;
  }

  darkenColor(color, factor) {
    if (!color || typeof color !== 'string') return '#E0E0E0';
    
    const hex = color.replace('#', '');
    if (hex.length !== 6) return '#E0E0E0';
    
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    if (isNaN(r) || isNaN(g) || isNaN(b)) return '#E0E0E0';
    
    return `rgb(${Math.max(0, Math.min(255, r * (1 - factor)))}, ${Math.max(0, Math.min(255, g * (1 - factor)))}, ${Math.max(0, Math.min(255, b * (1 - factor)))})`;
  }

  interpolateColor(color1, color2, factor) {
    if (!color1 || !color2 || typeof color1 !== 'string' || typeof color2 !== 'string') return '#E0E0E0';
    
    const hex1 = color1.replace('#', '');
    const hex2 = color2.replace('#', '');
    
    if (hex1.length !== 6 || hex2.length !== 6) return '#E0E0E0';
    
    const r1 = parseInt(hex1.substr(0, 2), 16);
    const g1 = parseInt(hex1.substr(2, 2), 16);
    const b1 = parseInt(hex1.substr(4, 2), 16);
    
    const r2 = parseInt(hex2.substr(0, 2), 16);
    const g2 = parseInt(hex2.substr(2, 2), 16);
    const b2 = parseInt(hex2.substr(4, 2), 16);
    
    if (isNaN(r1) || isNaN(g1) || isNaN(b1) || isNaN(r2) || isNaN(g2) || isNaN(b2)) return '#E0E0E0';
    
    const r = Math.round(Math.max(0, Math.min(255, r1 + (r2 - r1) * factor)));
    const g = Math.round(Math.max(0, Math.min(255, g1 + (g2 - g1) * factor)));
    const b = Math.round(Math.max(0, Math.min(255, b1 + (b2 - b1) * factor)));
    
    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Очистка ресурсов
   */
  cleanup() {
    this.stopAnimation();
    this.canvas = null;
    this.ctx = null;
  }
}

// Экспортируем синглтон
export const waveformGenerator = new WaveformGenerator();
