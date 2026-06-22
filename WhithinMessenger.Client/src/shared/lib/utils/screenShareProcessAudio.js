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
    this.writeQueue = Promise.resolve();
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

  async start(pid) {
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

    const started = await window.processAudioCapture.startCapture(pid);
    if (!started) {
      throw new Error(`Failed to start process audio capture for pid ${pid}`);
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
    this.audioContext = new AudioContext();
    const destination = this.audioContext.createMediaStreamDestination();
    this.fallbackTrack = destination.stream.getAudioTracks()[0];
    this.fallbackWorkletNode = null;
    this.pendingFrames = [];

    const scriptNode = this.audioContext.createScriptProcessor(4096, this.channels, this.channels);
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
    this.writeQueue = this.writeQueue
      .then(() => this.feedAudioData(audioData))
      .catch((error) => {
        console.warn('[screen-audio] failed to feed process audio frame:', error);
      });
  }

  async feedAudioData(audioData) {
    const channels = Math.max(1, Number(audioData?.channels) || 2);
    const sampleRate = Math.max(8000, Number(audioData?.sampleRate) || 48000);
    const floatBuffer = toFloat32Array(audioData?.buffer);
    const frames = Math.floor(floatBuffer.length / channels);
    if (frames <= 0) {
      return;
    }

    this.sampleRate = sampleRate;
    this.channels = channels;

    if (this.writer) {
      const audioFrame = new AudioData({
        format: 'f32',
        sampleRate,
        numberOfFrames: frames,
        numberOfChannels: channels,
        timestamp: this.timestampUs,
        data: floatBuffer,
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
          sample.push(floatBuffer[frame * channels + ch] ?? 0);
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
      await this.writeQueue;
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
