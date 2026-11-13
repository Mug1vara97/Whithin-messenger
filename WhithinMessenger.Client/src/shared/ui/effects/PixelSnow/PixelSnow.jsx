import React, { useEffect, useRef } from 'react';
import './PixelSnow.css';

/*
 * Pixel-art snowfall drawn on a 2D canvas over the whole window.
 * Sprites keep their chunky cells, but flakes move in whole device pixels
 * instead of whole cells, so the fall stays smooth at any speed.
 */

const SPRITES = [
  ['@'],
  ['.x.', 'x@x', '.x.'],
  ['..x..', 'x.o.x', '.o@o.', 'x.o.x', '..x..'],
  ['...x...', '.x.o.x.', '..ooo..', 'xoo@oox', '..ooo..', '.x.o.x.', '...x...'],
  ['....x....', '.x..o..x.', '..o.o.o..', '...ooo...', 'xooo@ooox', '...ooo...', '..o.o.o..', '.x..o..x.', '....x....'],
  ['x...x', '.o.o.', '..@..', '.o.o.', 'x...x'],
  ['x..x..x', '.o.o.o.', '..ooo..', 'xoo@oox', '..ooo..', '.o.o.o.', 'x..x..x'],
  ['x...x...x', '.o..o..o.', '..o.o.o..', '...ooo...', 'xooo@ooox', '...ooo...', '..o.o.o..', '.o..o..o.', 'x...x...x'],
];
const MARK_ALPHA = { '@': 1, o: 0.9, x: 0.6 };

const LEVELS = 5;
const LEVEL_WEIGHTS = [0.46, 0.27, 0.15, 0.08, 0.04];
const LEVEL_FALL = [16, 24, 34, 48, 66];
const LEVEL_LIGHT = [0.42, 0.58, 0.76, 0.92, 1];
const MAX_FLAKES = 1500;
const INTRO_SECONDS = 1.4;
const POINTER_RADIUS = 120;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const seeded = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

function buildSprite(rows, cell, color, glow) {
  const size = rows.length * cell;
  const pad = glow > 0 ? cell * 2 : 0;
  const base = document.createElement('canvas');
  base.width = size;
  base.height = size;
  const bctx = base.getContext('2d');
  bctx.fillStyle = color;
  rows.forEach((line, y) => {
    for (let x = 0; x < line.length; x += 1) {
      const alpha = MARK_ALPHA[line[x]];
      if (!alpha) continue;
      bctx.globalAlpha = alpha;
      bctx.fillRect(x * cell, y * cell, cell, cell);
    }
  });

  const sprite = document.createElement('canvas');
  sprite.width = size + pad * 2;
  sprite.height = size + pad * 2;
  const ctx = sprite.getContext('2d');
  if (pad) {
    ctx.filter = `blur(${Math.max(1, cell * 0.9)}px)`;
    ctx.globalAlpha = 0.22 * glow;
    ctx.drawImage(base, pad, pad);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
  }
  ctx.drawImage(base, pad, pad);
  return { canvas: sprite, half: Math.floor(sprite.width / 2) };
}

export default function PixelSnow({
  color = '#ffffff',
  density = 0.3,
  speed = 1,
  wind = 0.25,
  sway = 0.5,
  pixelSize = 3,
  depth = 0.6,
  glow = 0.8,
  twinkle = 0.35,
  mouseInteraction = true,
  opacity = 0.95,
}) {
  const canvasRef = useRef(null);
  const settingsRef = useRef(null);
  settingsRef.current = {
    color, density, speed, wind, sway, pixelSize, depth, glow, twinkle, mouseInteraction, opacity,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: true, desynchronized: true });
    if (!canvas || !ctx) return undefined;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const rng = seeded(4271);
    const flakes = [];
    const view = { width: 1, height: 1, ratio: 1, cell: 3 };
    const pointer = { x: 0, y: 0, vx: 0, vy: 0, inside: false, time: 0 };
    const state = { time: 0, intro: reduce ? 1 : 0, push: 0 };
    let sprites = [];
    let raf = 0;
    let last = 0;

    const pickLevel = (r) => {
      let total = 0;
      for (let level = 0; level < LEVELS; level += 1) {
        total += LEVEL_WEIGHTS[level];
        if (r <= total) return level;
      }
      return LEVELS - 1;
    };

    const spawn = (flake, top) => {
      flake.level = pickLevel(rng());
      flake.x = rng() * (view.width + 40) - 20;
      flake.y = top ? -10 - rng() * 30 : rng() * view.height;
      flake.vx = 0;
      flake.vy = LEVEL_FALL[flake.level];
      flake.phase = rng() * Math.PI * 2;
      flake.rate = 0.6 + rng() * 0.9;
      flake.sparkle = rng() * 100;
      flake.drift = 0.7 + rng() * 0.6;
      flake.slot = flake.level >= 2 && rng() < 0.5 ? flake.level + 3 : flake.level;
    };

    const populate = (s) => {
      const target = Math.round(clamp((view.width * view.height * s.density) / 1100, 0, MAX_FLAKES));
      while (flakes.length < target) {
        const flake = {};
        spawn(flake, false);
        flakes.push(flake);
      }
      if (flakes.length > target) flakes.length = target;
    };

    const simulate = (s, dt) => {
      const windSpeed = s.wind * 46;
      const pushing = state.push > 0.001 && pointer.inside;
      const ease = 1 - Math.exp(-dt * 2.2);
      const margin = 24;

      for (const flake of flakes) {
        const { level } = flake;
        const parallax = 1 - s.depth * (1 - (level + 1) / LEVELS) * 0.75;
        const swing = Math.sin(state.time * flake.rate + flake.phase) * s.sway * (6 + level * 7);
        flake.vx += ((windSpeed * parallax + swing) * flake.drift - flake.vx) * ease;
        flake.vy += (LEVEL_FALL[level] * parallax * s.speed * flake.drift - flake.vy) * ease;

        if (pushing) {
          const dx = flake.x - pointer.x;
          const dy = flake.y - pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance < POINTER_RADIUS && distance > 0.001) {
            const near = 1 - distance / POINTER_RADIUS;
            const repel = near * near * near * state.push * 1500 * dt;
            const carry = near * near * state.push * dt * 5;
            flake.vx += (dx / distance) * repel + pointer.vx * carry;
            flake.vy += (dy / distance) * repel + pointer.vy * carry;
          }
        }

        flake.x += flake.vx * dt;
        flake.y += flake.vy * dt;

        if (flake.y > view.height + margin) spawn(flake, true);
        if (flake.x < -margin) flake.x += view.width + margin * 2;
        else if (flake.x > view.width + margin) flake.x -= view.width + margin * 2;
      }
    };

    const render = (s) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const fadeIn = state.intro * state.intro;
      const { ratio } = view;
      for (const flake of flakes) {
        const sprite = sprites[flake.slot];
        if (!sprite) continue;
        const depthLight = 1 - s.depth * (1 - LEVEL_LIGHT[flake.level]);
        const spark = Math.max(0, Math.sin(state.time * 0.9 + flake.sparkle)) ** 60 * s.twinkle;
        ctx.globalAlpha = Math.min(1, depthLight * (0.85 + spark * 0.6)) * s.opacity * fadeIn;
        ctx.drawImage(
          sprite.canvas,
          Math.round(flake.x * ratio) - sprite.half,
          Math.round(flake.y * ratio) - sprite.half,
        );
      }
      ctx.globalAlpha = 1;
    };

    const frame = (now) => {
      raf = 0;
      if (document.hidden) {
        last = 0;
        return;
      }
      const s = settingsRef.current;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      if (state.intro < 1) state.intro = Math.min(1, state.intro + dt / INTRO_SECONDS);
      const goal = s.mouseInteraction && pointer.inside && !reduce ? 1 : 0;
      state.push += (goal - state.push) * (1 - Math.exp(-dt * (goal ? 6 : 3)));
      pointer.vx *= Math.exp(-dt * 6);
      pointer.vy *= Math.exp(-dt * 6);
      populate(s);
      if (!reduce) {
        state.time += dt;
        simulate(s, dt);
      }
      render(s);
      if (!reduce) raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const resize = () => {
      const s = settingsRef.current;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      view.width = Math.max(1, window.innerWidth);
      view.height = Math.max(1, window.innerHeight);
      view.ratio = ratio;
      view.cell = Math.max(1, Math.round(s.pixelSize * ratio));
      canvas.width = Math.round(view.width * ratio);
      canvas.height = Math.round(view.height * ratio);
      sprites = SPRITES.map((rows) => buildSprite(rows, view.cell, s.color, s.glow));
      populate(s);
      render(s);
      wake();
    };

    const onPointerMove = (event) => {
      const now = performance.now();
      const x = event.clientX;
      const y = event.clientY;
      if (pointer.inside && pointer.time) {
        const elapsed = Math.max(1, now - pointer.time) / 1000;
        pointer.vx = clamp((x - pointer.x) / elapsed, -3000, 3000);
        pointer.vy = clamp((y - pointer.y) / elapsed, -3000, 3000);
      }
      pointer.x = x;
      pointer.y = y;
      pointer.time = now;
      pointer.inside = true;
    };
    const onPointerLeave = () => {
      pointer.inside = false;
    };
    const onVisibility = () => {
      last = 0;
      wake();
    };

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('blur', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);
    resize();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('blur', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="pixel-snow" aria-hidden="true" />;
}
