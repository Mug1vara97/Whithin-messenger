const TARGET_SAMPLE_RATE = 48000;
const TARGET_CHANNELS = 2;

function toFloat32Array(buffer) {
  if (buffer instanceof Float32Array) {
    return buffer;
  }
  if (buffer?.buffer instanceof ArrayBuffer) {
    return new Float32Array(buffer.buffer, buffer.byteOffset || 0, buffer.byteLength
      ? buffer.byteLength / 4
      : undefined);
  }
  if (ArrayBuffer.isView(buffer)) {
    return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  }
  if (Array.isArray(buffer)) {
    return new Float32Array(buffer);
  }
  return new Float32Array(0);
}

function resamplePcm(floatBuffer, channels, sampleRate, targetRate = TARGET_SAMPLE_RATE) {
  if (sampleRate === targetRate) {
    return floatBuffer;
  }

  const inputFrames = Math.floor(floatBuffer.length / channels);
  if (inputFrames <= 0) {
    return floatBuffer;
  }

  const outputFrames = Math.max(1, Math.round(inputFrames * (targetRate / sampleRate)));
  const output = new Float32Array(outputFrames * channels);
  const step = sampleRate / targetRate;

  for (let outFrame = 0; outFrame < outputFrames; outFrame += 1) {
    const srcPos = outFrame * step;
    const srcIndex = Math.floor(srcPos);
    const frac = srcPos - srcIndex;
    const nextIndex = Math.min(srcIndex + 1, inputFrames - 1);

    for (let ch = 0; ch < channels; ch += 1) {
      const s0 = floatBuffer[srcIndex * channels + ch] ?? 0;
      const s1 = floatBuffer[nextIndex * channels + ch] ?? s0;
      output[outFrame * channels + ch] = s0 + frac * (s1 - s0);
    }
  }

  return output;
}

function upmixToStereo(floatBuffer, channels) {
  if (channels >= TARGET_CHANNELS) {
    return { buffer: floatBuffer, channels: TARGET_CHANNELS };
  }

  const frames = Math.floor(floatBuffer.length / channels);
  const stereo = new Float32Array(frames * TARGET_CHANNELS);

  for (let frame = 0; frame < frames; frame += 1) {
    const sample = floatBuffer[frame * channels] ?? 0;
    stereo[frame * 2] = sample;
    stereo[frame * 2 + 1] = sample;
  }

  return { buffer: stereo, channels: TARGET_CHANNELS };
}

function normalizePcm(floatBuffer, channels, sampleRate) {
  const resampled = resamplePcm(floatBuffer, channels, sampleRate, TARGET_SAMPLE_RATE);
  return upmixToStereo(resampled, channels);
}

function canUseMediaStreamTrackGenerator() {
  return typeof MediaStreamTrackGenerator !== 'undefined'
    && typeof AudioData !== 'undefined';
}

/**
 * Bridges process-audio-capture PCM chunks into a browser MediaStream audio track.
 */
export class ScreenShareProcessAudioSession {
  constructor() {
    this.unsubscribe = null;
    this.trackGenerator = null;
    this.writer = null;
    this.audioContext = null;
    this.fallbackTrack = null;
    this.timestampUs = 0;
    this.stopped = false;
    this.writeInFlight = false;
    this.pendingAudioData = null;
    this.sampleRate = 48000;
    this.channels = 2;
  }

  static isAvailable() {
    return Boolean(window.processAudioCapture?.startCapture);
  }

  static async isSupported() {
    if (!ScreenShareProcessAudioSession.isAvailable()) {
      return false;
    }
    try {
      return Boolean(await window.processAudioCapture.isPlatformSupported());
    } catch {
      return false;
    }
  }

  async start(pid, options = {}) {
    const { exclude = false } = options;
    if (!pid || pid <= 0) {
      throw new Error('Invalid process id for screen-share audio');
    }
    if (!ScreenShareProcessAudioSession.isAvailable()) {
      throw new Error('processAudioCapture API is not available');
    }

    const supported = await ScreenShareProcessAudioSession.isSupported();
    if (!supported) {
      throw new Error('Process audio capture is not supported on this platform');
    }

    const permission = await window.processAudioCapture.checkPermission?.();
    if (permission?.status === 'denied') {
      throw new Error('Process audio capture permission denied');
    }

    const startCapture = exclude
      ? window.processAudioCapture.startCaptureExclude
      : window.processAudioCapture.startCapture;

    if (typeof startCapture !== 'function') {
      throw new Error(exclude
        ? 'Process audio exclude capture is not available'
        : 'Process audio capture is not available');
    }

    const started = await startCapture.call(window.processAudioCapture, pid);
    if (!started) {
      throw new Error(exclude
        ? `Failed to start system audio capture excluding pid ${pid}`
        : `Failed to start process audio capture for pid ${pid}`);
    }

    const track = canUseMediaStreamTrackGenerator()
      ? this.createGeneratorTrack()
      : this.createFallbackTrack();

    this.unsubscribe = window.processAudioCapture.on('audio-data', (audioData) => {
      if (this.stopped) return;
      this.enqueueAudioData(audioData);
    });

    return new MediaStream([track]);
  }

  createGeneratorTrack() {
    this.trackGenerator = new MediaStreamTrackGenerator({ kind: 'audio' });
    this.writer = this.trackGenerator.writable.getWriter();
    return this.trackGenerator;
  }

  createFallbackTrack() {
    this.audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    const destination = this.audioContext.createMediaStreamDestination();
    this.fallbackTrack = destination.stream.getAudioTracks()[0];
    this.fallbackWorkletNode = null;
    this.pendingFrames = [];

    const scriptNode = this.audioContext.createScriptProcessor(4096, TARGET_CHANNELS, TARGET_CHANNELS);
    scriptNode.onaudioprocess = (event) => {
      const output = event.outputBuffer;
      const frames = output.length;
      const channelCount = output.numberOfChannels;

      for (let frame = 0; frame < frames; frame += 1) {
        const chunk = this.pendingFrames.shift();
        if (!chunk) {
          for (let ch = 0; ch < channelCount; ch += 1) {
            output.getChannelData(ch)[frame] = 0;
          }
          continue;
        }

        for (let ch = 0; ch < channelCount; ch += 1) {
          output.getChannelData(ch)[frame] = chunk[ch] ?? 0;
        }
      }
    };

    const silence = this.audioContext.createGain();
    silence.gain.value = 0;
    scriptNode.connect(silence);
    silence.connect(destination);
    this.fallbackScriptNode = scriptNode;

    return this.fallbackTrack;
  }

  enqueueAudioData(audioData) {
    if (this.writeInFlight) {
      this.pendingAudioData = audioData;
      return;
    }

    this.writeInFlight = true;
    Promise.resolve(this.feedAudioData(audioData))
      .catch((error) => {
        console.warn('[screen-audio] failed to feed process audio frame:', error);
      })
      .finally(() => {
        this.writeInFlight = false;
        if (this.pendingAudioData) {
          const next = this.pendingAudioData;
          this.pendingAudioData = null;
          this.enqueueAudioData(next);
        }
      });
  }

  async feedAudioData(audioData) {
    const sourceChannels = Math.max(1, Number(audioData?.channels) || TARGET_CHANNELS);
    const sourceRate = Math.max(8000, Number(audioData?.sampleRate) || TARGET_SAMPLE_RATE);
    const floatBuffer = toFloat32Array(audioData?.buffer);
    const { buffer, channels } = normalizePcm(floatBuffer, sourceChannels, sourceRate);
    const frames = Math.floor(buffer.length / channels);
    if (frames <= 0) {
      return;
    }

    const sampleRate = TARGET_SAMPLE_RATE;
    this.sampleRate = sampleRate;
    this.channels = channels;

    if (this.writer) {
      const audioFrame = new AudioData({
        format: 'f32',
        sampleRate,
        numberOfFrames: frames,
        numberOfChannels: channels,
        timestamp: this.timestampUs,
        data: buffer,
      });
      this.timestampUs += Math.round((frames / sampleRate) * 1_000_000);
      await this.writer.write(audioFrame);
      audioFrame.close();
      return;
    }

    if (this.fallbackScriptNode) {
      for (let frame = 0; frame < frames; frame += 1) {
        const sample = [];
        for (let ch = 0; ch < channels; ch += 1) {
          sample.push(buffer[frame * channels + ch] ?? 0);
        }
        this.pendingFrames.push(sample);
      }
    }
  }

  async stop() {
    if (this.stopped) return;
    this.stopped = true;

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    try {
      await window.processAudioCapture?.stopCapture?.();
    } catch (error) {
      console.warn('[screen-audio] stopCapture failed:', error);
    }

    try {
      if (this.writeInFlight) {
        await new Promise((resolve) => {
          const check = () => {
            if (!this.writeInFlight) {
              resolve();
              return;
            }
            setTimeout(check, 10);
          };
          check();
        });
      }
    } catch {
      /* ignore */
    }

    try {
      await this.writer?.close?.();
    } catch {
      /* ignore */
    }

    try {
      this.trackGenerator?.stop?.();
    } catch {
      /* ignore */
    }

    try {
      this.fallbackScriptNode?.disconnect?.();
      this.fallbackTrack?.stop?.();
      await this.audioContext?.close?.();
    } catch {
      /* ignore */
    }

    this.writer = null;
    this.trackGenerator = null;
    this.fallbackTrack = null;
    this.audioContext = null;
    this.fallbackScriptNode = null;
    this.pendingFrames = [];
  }
}
