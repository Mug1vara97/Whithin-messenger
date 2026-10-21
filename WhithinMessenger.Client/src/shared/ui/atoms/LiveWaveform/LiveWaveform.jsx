import React, { useEffect, useRef } from 'react';
import {
  WAVEFORM_BAR_GAP,
  WAVEFORM_BAR_RADIUS,
  WAVEFORM_BAR_WIDTH,
  WAVEFORM_HEIGHT_SCALE,
  WAVEFORM_LIVE_SENSITIVITY,
  WAVEFORM_MIN_BAR_HEIGHT,
  waveformBarFactor,
} from '../../../lib/utils/waveformVisual';
import './LiveWaveform.css';

const IDLE_ALPHA = 0.35;
const HISTORY_CAP = 96;
const HISTORY_INTERVAL_MS = 48;

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
 * Live mic waveform (scrolling bars), inspired by audiocn LiveWaveform.
 * Color follows `color` / currentColor so app themes apply.
 */
const LiveWaveform = ({
  stream = null,
  active = true,
  mode = 'scrolling',
  barWidth = WAVEFORM_BAR_WIDTH,
  barGap = WAVEFORM_BAR_GAP,
  barRadius = WAVEFORM_BAR_RADIUS,
  minBarHeight = WAVEFORM_MIN_BAR_HEIGHT,
  fadeEdges = true,
  fadeWidth = 20,
  sensitivity = WAVEFORM_LIVE_SENSITIVITY,
  className = '',
  'aria-label': ariaLabel = 'Уровень записи',
}) => {
  const canvasRef = useRef(null);
  const historyRef = useRef([]);
  const lastSampleAtRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let audioContext = null;
    let analyser = null;
    let sourceNode = null;
    let rafId = 0;
    let disposed = false;
    let timeDomain = new Uint8Array(2048);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const setupAnalyser = async () => {
      if (!stream || !active) return;
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        if (disposed) {
          audioContext.close();
          return;
        }
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.45;
        sourceNode = audioContext.createMediaStreamSource(stream);
        sourceNode.connect(analyser);
        timeDomain = new Uint8Array(analyser.fftSize);
      } catch (error) {
        console.warn('LiveWaveform: analyser setup failed', error);
      }
    };

    void setupAnalyser();

    const sampleLevel = () => {
      if (!analyser) return 0;
      analyser.getByteTimeDomainData(timeDomain);
      let sum = 0;
      let peak = 0;
      for (let i = 0; i < timeDomain.length; i += 1) {
        const v = (timeDomain[i] - 128) / 128;
        const abs = Math.abs(v);
        sum += v * v;
        if (abs > peak) peak = abs;
      }
      const rms = Math.sqrt(sum / timeDomain.length);
      // Mild blend — loudness→height shaped later via waveformBarFactor.
      return clamp(rms * 0.85 + peak * 0.35, 0, 1);
    };

    const drawIdle = (width, height) => {
      const step = (barWidth + barGap) * 2;
      const y = height / 2 - 0.5;
      ctx.globalAlpha = IDLE_ALPHA;
      for (let x = 0; x < width; x += step) {
        ctx.fillRect(x, y, barWidth, 1);
      }
      ctx.globalAlpha = 1;
    };

    const applyFade = (width, height) => {
      const edge = Math.min(fadeWidth, width / 2);
      ctx.globalCompositeOperation = 'destination-out';
      const left = ctx.createLinearGradient(0, 0, edge, 0);
      left.addColorStop(0, 'rgba(0,0,0,1)');
      left.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = left;
      ctx.fillRect(0, 0, edge, height);
      const right = ctx.createLinearGradient(width - edge, 0, width, 0);
      right.addColorStop(0, 'rgba(0,0,0,0)');
      right.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = right;
      ctx.fillRect(width - edge, 0, edge, height);
      ctx.globalCompositeOperation = 'source-over';
    };

    const paint = (now) => {
      if (disposed) return;
      const width = canvas.clientWidth || 1;
      const height = canvas.clientHeight || 1;
      const color = getComputedStyle(canvas).color || '#fff';

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;
      ctx.strokeStyle = color;

      if (!(active && analyser)) {
        drawIdle(width, height);
        rafId = requestAnimationFrame(paint);
        return;
      }

      if (now - lastSampleAtRef.current >= HISTORY_INTERVAL_MS) {
        lastSampleAtRef.current = now;
        const level = sampleLevel();
        const history = historyRef.current;
        history.push(level);
        if (history.length > HISTORY_CAP) {
          history.shift();
        }
      }

      const pitch = barWidth + barGap;
      const count = Math.max(1, Math.floor((width + barGap) / pitch));
      const history = historyRef.current;
      const levels =
        mode === 'scrolling'
          ? history.slice(Math.max(0, history.length - count))
          : history.slice(-1);

      const used = count * pitch - barGap;
      const left = (width - used) / 2;
      const offset = count - levels.length;

      for (let i = 0; i < levels.length; i += 1) {
        const raw = levels[i] || 0;
        const factor = waveformBarFactor(raw, sensitivity);
        const visual = clamp(factor / WAVEFORM_HEIGHT_SCALE, 0, 1);
        const barHeight = Math.max(minBarHeight, factor * height);
        const x = left + (offset + i) * pitch;
        const y = (height - barHeight) / 2;
        ctx.globalAlpha = 0.35 + 0.65 * visual;
        drawRoundedBar(ctx, x, y, barWidth, barHeight, barRadius);
      }
      ctx.globalAlpha = 1;

      if (fadeEdges) {
        applyFade(width, height);
      }

      rafId = requestAnimationFrame(paint);
    };

    rafId = requestAnimationFrame(paint);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      observer.disconnect();
      try {
        sourceNode?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        analyser?.disconnect();
      } catch {
        /* ignore */
      }
      if (audioContext && audioContext.state !== 'closed') {
        void audioContext.close();
      }
      historyRef.current = [];
    };
  }, [
    stream,
    active,
    mode,
    barWidth,
    barGap,
    barRadius,
    minBarHeight,
    fadeEdges,
    fadeWidth,
    sensitivity,
  ]);

  return (
    <div
      className={`live-waveform ${className}`.trim()}
      data-active={active ? '' : undefined}
      data-mode={mode}
      role="img"
      aria-label={ariaLabel}
    >
      <canvas ref={canvasRef} className="live-waveform__canvas" />
    </div>
  );
};

export default LiveWaveform;
