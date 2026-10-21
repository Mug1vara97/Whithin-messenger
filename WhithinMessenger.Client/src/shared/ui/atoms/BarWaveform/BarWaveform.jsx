import React, { useCallback, useEffect, useRef } from 'react';
import './BarWaveform.css';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const drawRoundedBar = (ctx, x, y, width, height, radius) => {
  const r = Math.min(radius, width / 2, height / 2);
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, r);
    ctx.fill();
    return;
  }
  ctx.fillRect(x, y, width, height);
};

/**
 * Static/progress bar waveform matching LiveWaveform visual language.
 * `peaks` — 0..1 levels; `progress` — 0..1 playback position.
 */
const BarWaveform = ({
  peaks = [],
  progress = 0,
  barWidth = 3,
  barGap = 2,
  barRadius = 1.5,
  minBarHeight = 3,
  interactive = true,
  onSeek,
  className = '',
  'aria-label': ariaLabel = 'Форма волны',
}) => {
  const canvasRef = useRef(null);
  const peaksRef = useRef(peaks);
  const progressRef = useRef(progress);

  peaksRef.current = peaks;
  progressRef.current = progress;

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    const ratio = window.devicePixelRatio || 1;
    const targetW = Math.max(1, Math.round(width * ratio));
    const targetH = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const styles = getComputedStyle(canvas);
    const waveColor =
      styles.getPropertyValue('--bw-wave-color').trim()
      || styles.color
      || '#b9bbbe';
    const progressColor =
      styles.getPropertyValue('--bw-progress-color').trim()
      || styles.getPropertyValue('--primary').trim()
      || '#5865f2';

    const source = peaksRef.current;
    const pitch = barWidth + barGap;
    const count = Math.max(1, Math.floor((width + barGap) / pitch));
    const levels = new Array(count).fill(0);

    if (source.length > 0) {
      for (let i = 0; i < count; i += 1) {
        const srcIndex = Math.min(
          source.length - 1,
          Math.floor((i / Math.max(1, count - 1)) * (source.length - 1))
        );
        levels[i] = clamp(Number(source[srcIndex]) || 0, 0, 1);
      }
    }

    const used = count * pitch - barGap;
    const left = (width - used) / 2;
    const playedUntil = clamp(progressRef.current, 0, 1) * count;

    for (let i = 0; i < count; i += 1) {
      const value = levels[i] || 0;
      const barHeight = Math.max(minBarHeight, value * height * 0.92);
      const x = left + i * pitch;
      const y = (height - barHeight) / 2;
      ctx.fillStyle = i < playedUntil ? progressColor : waveColor;
      ctx.globalAlpha = i < playedUntil ? 0.55 + 0.45 * value : 0.35 + 0.45 * value;
      drawRoundedBar(ctx, x, y, barWidth, barHeight, barRadius);
    }
    ctx.globalAlpha = 1;
  }, [barWidth, barGap, barRadius, minBarHeight]);

  useEffect(() => {
    paint();
  }, [paint, peaks, progress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const observer = new ResizeObserver(() => paint());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [paint]);

  const handlePointer = (event) => {
    if (!interactive || !onSeek) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    onSeek(ratio);
  };

  return (
    <div
      className={`bar-waveform ${className}`.trim()}
      role="img"
      aria-label={ariaLabel}
    >
      <canvas
        ref={canvasRef}
        className="bar-waveform__canvas"
        onClick={handlePointer}
      />
    </div>
  );
};

export default BarWaveform;
