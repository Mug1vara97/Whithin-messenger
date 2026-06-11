import { soundpadLog, soundpadWarn } from './soundpadLogger';

const BRIDGE_PORT = 38473;
const BRIDGE_BASE = `http://127.0.0.1:${BRIDGE_PORT}`;

let audioContext = null;
let mediaStream = null;
let abortController = null;
let processor = null;
let pcmQueue = [];

const int16ToFloat = (sample) => sample / 32768;

const ensureBridgeReady = async () => {
  if (window.electronAPI?.soundpadGetStatus) {
    await window.electronAPI.soundpadGetStatus();
  }
};

export const screenShareCableAudio = {
  isActive() {
    return Boolean(mediaStream?.active);
  },

  async start() {
    await this.stop();
    pcmQueue = [];

    await ensureBridgeReady();

    const startResponse = await fetch(`${BRIDGE_BASE}/screen-share-loopback/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    if (!startResponse.ok) {
      const payload = await startResponse.json().catch(() => ({}));
      throw new Error(payload.error || 'Не удалось запустить захват звука с CABLE Input');
    }

    soundpadLog('screenShareCableAudio: loopback started', await startResponse.json());

    abortController = new AbortController();
    const response = await fetch(`${BRIDGE_BASE}/screen-share-loopback/stream`, {
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error('Не удалось открыть поток звука CABLE Input');
    }

    audioContext = new AudioContext({ sampleRate: 48000 });
    const destination = audioContext.createMediaStreamDestination();
    const bufferSize = 4096;
    processor = audioContext.createScriptProcessor(bufferSize, 0, 2);

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Поток звука CABLE Input недоступен');
    }

    const readLoop = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value?.length) continue;

          const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
          for (let offset = 0; offset + 1 < value.length; offset += 2) {
            pcmQueue.push(view.getInt16(offset, true));
            if (pcmQueue.length > 48000 * 4) {
              pcmQueue.splice(0, pcmQueue.length - 48000 * 4);
            }
          }
        }
      } catch (error) {
        if (error?.name !== 'AbortError') {
          soundpadWarn('screenShareCableAudio: stream ended', error);
        }
      }
    };
    readLoop();

    processor.onaudioprocess = (event) => {
      const left = event.outputBuffer.getChannelData(0);
      const right = event.outputBuffer.getChannelData(1);
      for (let i = 0; i < left.length; i += 1) {
        const sample = pcmQueue.length ? int16ToFloat(pcmQueue.shift()) : 0;
        left[i] = sample;
        right[i] = sample;
      }
    };

    processor.connect(destination);
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    mediaStream = destination.stream;
    soundpadLog('screenShareCableAudio: MediaStream ready');
    return mediaStream;
  },

  async stop() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }

    if (processor) {
      processor.disconnect();
      processor.onaudioprocess = null;
      processor = null;
    }

    if (audioContext) {
      await audioContext.close().catch(() => {});
      audioContext = null;
    }

    mediaStream = null;
    pcmQueue = [];

    try {
      await fetch(`${BRIDGE_BASE}/screen-share-loopback/stop`, { method: 'POST' });
    } catch {
      // bridge may already be stopped
    }
  },

  getMediaStreamTrack() {
    const track = mediaStream?.getAudioTracks?.()[0];
    if (!track) {
      throw new Error('Захват звука CABLE Input не запущен');
    }
    return track;
  },
};
