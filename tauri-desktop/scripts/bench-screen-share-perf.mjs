/**
 * Tauri-side screen-share microbench (source enumeration via xcap CLI helper).
 * Runs the compiled helper if present; otherwise prints pipeline expectations.
 *
 * Usage:
 *   node ./scripts/bench-screen-share-perf.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const helper = path.join(
  root,
  'src-tauri',
  'target',
  'debug',
  'bench-screen-sources.exe',
);

const PRESETS = [
  { id: '480p', width: 854, height: 480, fps: 30 },
  { id: '720p', width: 1280, height: 720, fps: 30 },
  { id: '720p60', width: 1280, height: 720, fps: 60 },
  { id: '1080p', width: 1920, height: 1080, fps: 30 },
  { id: '1440p', width: 2560, height: 1440, fps: 30 },
];

const result = {
  runtime: 'tauri',
  platform: process.platform,
  pipeline: [
    'Windows Graphics Capture / GDI',
    'SIMD downscale + I420 (or JPEG fallback)',
    'localhost WebSocket → VideoFrame/MediaStreamTrackGenerator',
    'LiveKit VP8 publish',
  ],
  presets: PRESETS,
  notes: [
    'Capture honors maxWidth/maxHeight/fps from getDisplayMedia constraints.',
    'I420 path avoids JPEG decode in the happy path (lower CPU than canvas/JPEG).',
    'WebView2 software encode is usually heavier than Electron/Chromium at 1080p60+.',
  ],
};

if (existsSync(helper)) {
  const run = spawnSync(helper, [], { encoding: 'utf8' });
  try {
    result.sourceList = JSON.parse(run.stdout || '{}');
  } catch {
    result.sourceListRaw = run.stdout;
    result.sourceListError = run.stderr;
  }
} else {
  result.sourceList = {
    skipped: true,
    reason: 'bench-screen-sources.exe not built (optional helper)',
  };
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
