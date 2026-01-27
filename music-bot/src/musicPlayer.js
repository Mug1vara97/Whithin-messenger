const { AudioSource, AudioFrame, LocalAudioTrack, TrackPublishOptions, TrackSource } = require('@livekit/rtc-node');
const { spawn } = require('child_process');
const yandexProvider = require('./yandexMusicProvider');

class MusicPlayer {
  constructor(room) {
    this.room = room;
    this.audioTrack = null;
    this.audioSource = null;
    this.currentSource = null;
    this.ffmpegProcess = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.queue = [];
    this.currentIndex = -1;
    this.volume = 1.0;
    this.audioBuffer = Buffer.alloc(0);
    
    // Audio parameters (WebRTC standard)
    this.sampleRate = 48000;
    this.channels = 2; // Stereo
    this.frameDurationMs = 20; // 20ms frames (WebRTC standard)
    this.bytesPerSample = 2; // 16-bit samples
    this.chunkSize = this.sampleRate * this.channels * this.bytesPerSample * (this.frameDurationMs / 1000);
  }

  async start() {
    try {
      // Create AudioSource for raw audio data
      this.audioSource = new AudioSource(this.sampleRate, this.channels);
      
      // Create LocalAudioTrack from AudioSource
      this.audioTrack = LocalAudioTrack.createAudioTrack('music-bot-audio', this.audioSource);
      
      // Publish the track
      const options = new TrackPublishOptions();
      options.source = TrackSource.SOURCE_MICROPHONE;
      options.name = 'music-bot-audio';
      
      await this.room.localParticipant.publishTrack(this.audioTrack, options);
      
      // Send a few silent frames immediately to ensure track is unmuted
      // This helps the track be recognized as active/unmuted
      const silentSamples = new Int16Array(this.chunkSize / this.bytesPerSample);
      const silentFrame = new AudioFrame(
        silentSamples,
        this.sampleRate,
        this.channels,
        silentSamples.length / this.channels
      );
      for (let i = 0; i < 3; i++) {
        try {
          await this.audioSource.captureFrame(silentFrame);
        } catch (error) {
          // Ignore errors for initial silent frames
        }
      }
      
      console.log('[MusicPlayer] Audio track published and ready');
    } catch (error) {
      console.error('[MusicPlayer] Error starting music player:', error);
      throw error;
    }
  }

  async play(url) {
    try {
      // Ensure audio track is started before playing
      if (!this.audioTrack || !this.audioSource) {
        console.log('[MusicPlayer] Audio track not started, starting now...');
        await this.start();
      }

      if (this.isPlaying && !this.isPaused) {
        console.log('[MusicPlayer] Already playing, adding to queue');
        this.addToQueue(url);
        return;
      }

      console.log(`[MusicPlayer] Playing: ${url}`);
      
      // Stop current playback if any
      if (this.ffmpegProcess) {
        this.ffmpegProcess.kill();
        this.ffmpegProcess = null;
      }

      // Don't unpublish track - keep it published and just change the audio source
      // Use Yandex Music provider: ссылка или поисковый запрос
      console.log(`[MusicPlayer] Resolving via Yandex Music: ${url}`);
      let streamUrl;
      let resolvedTitle;
      try {
        const resolved = await yandexProvider.resolveToStreamUrl(url);
        streamUrl = resolved.streamUrl;
        resolvedTitle = resolved.title || null;
        console.log(`[MusicPlayer] Got stream URL from Yandex Music${resolvedTitle ? `: ${resolvedTitle}` : ''}`);
      } catch (urlError) {
        console.error('[MusicPlayer] Error resolving Yandex Music:', urlError.message);
        throw new Error(urlError.message || 'Не удалось получить поток из Яндекс.Музыки');
      }
      if (!streamUrl || !streamUrl.startsWith('http')) {
        throw new Error('Некорректная ссылка на поток от Яндекс.Музыки');
      }
      
      // Create ffmpeg process to download and convert audio to raw PCM format
      // Input from stream URL, output: Raw PCM 16-bit, 48kHz, stereo (for AudioSource)
      this.ffmpegProcess = spawn('ffmpeg', [
        '-i', streamUrl,             // Input from stream URL
        '-f', 's16le',               // Output format: signed 16-bit little-endian PCM
        '-ar', String(this.sampleRate),  // Sample rate: 48kHz
        '-ac', String(this.channels),    // Channels: stereo
        '-acodec', 'pcm_s16le',     // Audio codec: PCM 16-bit
        '-loglevel', 'error',       // Reduce ffmpeg output
        '-reconnect', '1',           // Reconnect on errors
        '-reconnect_at_eof', '1',    // Reconnect at EOF
        '-reconnect_streamed', '1',   // Reconnect for streamed media
        '-reconnect_delay_max', '2',  // Max delay between reconnects
        'pipe:1'                      // Output to stdout
      ], { stdio: ['pipe', 'pipe', 'pipe'] });
      
      // Handle ffmpeg errors
      this.ffmpegProcess.stderr.on('data', (data) => {
        const errorMsg = data.toString();
        if (errorMsg.includes('error') || errorMsg.includes('Error')) {
          console.error('[MusicPlayer] FFmpeg error:', errorMsg);
        }
      });
      
      // Handle ffmpeg process errors
      this.ffmpegProcess.on('error', (ffmpegError) => {
        console.error('[MusicPlayer] FFmpeg process error:', ffmpegError);
      });
      
      this.ffmpegProcess.on('exit', (code, signal) => {
        if (code !== 0 && code !== null && signal !== 'SIGTERM' && signal !== 'SIGKILL') {
          console.error(`[MusicPlayer] FFmpeg exited with code ${code}, signal: ${signal}`);
          // Clean up and handle error
          // Error handling will be done in the catch block
          if (!this.isPlaying) {
            // Already handled
            return;
          }
          // Trigger error handling
          const error = new Error(`FFmpeg process exited with code ${code}`);
          this.isPlaying = false;
          this.isPaused = false;
          this.currentSource = null;
          this.audioBuffer = Buffer.alloc(0);
          
          // Try next track or remove failed one
          const currentUrl = this.queue[this.currentIndex];
          const hasOtherTracks = this.queue.length > 1 || 
                                (this.queue.length === 1 && this.queue[0] !== currentUrl);
          
          if (hasOtherTracks) {
            console.log('[MusicPlayer] Attempting to play next track after ffmpeg error');
            setTimeout(() => {
              this.playNext().catch(err => {
                console.error('[MusicPlayer] Error in playNext after ffmpeg error:', err);
              });
            }, 2000);
          } else if (this.queue.length === 1 && this.queue[0] === currentUrl) {
            console.error('[MusicPlayer] Removing failed track from queue to prevent infinite loop');
            this.queue = [];
            this.currentIndex = -1;
          }
        }
      });
      
      // Reset buffer
      this.audioBuffer = Buffer.alloc(0);
      
      // Process FFmpeg output: read PCM data and convert to AudioFrames
      this.ffmpegProcess.stdout.on('data', async (data) => {
        if (this.isPaused) {
          return; // Skip processing when paused
        }
        
        // Append new data to buffer
        this.audioBuffer = Buffer.concat([this.audioBuffer, data]);
        
        // Process complete frames (20ms chunks)
        while (this.audioBuffer.length >= this.chunkSize) {
          const frameBuf = this.audioBuffer.slice(0, this.chunkSize);
          this.audioBuffer = this.audioBuffer.slice(this.chunkSize);
          
          // Convert buffer to Int16Array
          const int16Samples = new Int16Array(
            frameBuf.buffer,
            frameBuf.byteOffset,
            frameBuf.length / this.bytesPerSample
          );
          
          // Apply volume if needed (simple multiplication)
          if (this.volume !== 1.0) {
            for (let i = 0; i < int16Samples.length; i++) {
              int16Samples[i] = Math.max(-32768, Math.min(32767, Math.round(int16Samples[i] * this.volume)));
            }
          }
          
          // Create AudioFrame and capture it
          const frame = new AudioFrame(
            int16Samples,
            this.sampleRate,
            this.channels,
            int16Samples.length / this.channels
          );
          
          try {
            await this.audioSource.captureFrame(frame);
          } catch (error) {
            console.error('[MusicPlayer] Error capturing audio frame:', error);
          }
        }
      });
      
      this.isPlaying = true;
      this.isPaused = false;
      this.currentSource = url;
      
      // Handle stream end (only for successful completion)
      // Error cases are handled in 'exit' event handler
      this.ffmpegProcess.on('close', (code) => {
        // Only handle successful completion here
        // Errors are handled in 'exit' event
        if (code === 0 || code === null) {
          console.log('[MusicPlayer] Stream ended successfully');
          this.ffmpegProcess = null;
          this.audioBuffer = Buffer.alloc(0);
          this.isPlaying = false;
          this.isPaused = false;
          this.currentSource = null;
          
          // Play next in queue
          if (this.queue.length > 0) {
            setTimeout(() => this.playNext(), 500);
          }
        }
      });
      
      // Handle errors
      this.ffmpegProcess.on('error', (error) => {
        console.error('[MusicPlayer] FFmpeg process error:', error);
        this.isPlaying = false;
        this.isPaused = false;
        this.currentSource = null;
        this.audioBuffer = Buffer.alloc(0);
      });
      
    } catch (error) {
      console.error('[MusicPlayer] Error playing audio:', error);
      this.isPlaying = false;
      this.isPaused = false;
      this.currentSource = null;
      this.audioBuffer = Buffer.alloc(0);
      
      // Don't throw - log error and try next track if available
      // This prevents the bot from crashing
      // But prevent infinite retry loop - only retry if queue has different items
      const hasOtherTracks = this.queue.length > 1 || 
                            (this.queue.length === 1 && this.queue[0] !== url);
      
      if (hasOtherTracks) {
        console.log('[MusicPlayer] Attempting to play next track after error');
        setTimeout(() => {
          this.playNext().catch(err => {
            console.error('[MusicPlayer] Error in playNext after play error:', err);
          });
        }, 2000); // Increased delay to prevent rapid retries
      } else if (this.queue.length === 1 && this.queue[0] === url) {
        // Same track failed, remove it to prevent infinite loop
        console.error('[MusicPlayer] Removing failed track from queue to prevent infinite loop');
        this.queue = [];
        this.currentIndex = -1;
      } else {
        console.error('[MusicPlayer] Failed to play and queue is empty');
      }
      // Don't rethrow - we've handled the error
    }
  }

  async stop() {
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill();
      this.ffmpegProcess = null;
    }
    
    // Clear buffer
    this.audioBuffer = Buffer.alloc(0);
    
    // Stop sending audio frames (effectively mutes the track)
    // The track remains published but no audio data is sent
    this.isPlaying = false;
    this.isPaused = false;
    this.currentSource = null;
    console.log('[MusicPlayer] Music stopped');
  }

  async pause() {
    if (!this.isPlaying || this.isPaused) {
      return;
    }
    
    if (this.ffmpegProcess) {
      try {
        // Pause ffmpeg process (if supported on platform)
        if (process.platform !== 'win32') {
          this.ffmpegProcess.kill('SIGSTOP');
        }
      } catch (error) {
        console.error('[MusicPlayer] Error pausing ffmpeg:', error);
      }
    }
    
    // Pause sending audio frames (effectively mutes the track)
    // The isPaused flag is already checked in the data handler (line 124)
    this.isPaused = true;
    console.log('[MusicPlayer] Music paused');
  }

  async resume() {
    if (!this.isPaused) {
      return;
    }
    
    if (this.ffmpegProcess) {
      try {
        // Resume ffmpeg process (if supported on platform)
        if (process.platform !== 'win32') {
          this.ffmpegProcess.kill('SIGCONT');
        }
      } catch (error) {
        console.error('[MusicPlayer] Error resuming ffmpeg:', error);
      }
    }
    
    // Resume sending audio frames (effectively unmutes the track)
    this.isPaused = false;
    console.log('[MusicPlayer] Music resumed');
  }

  async skip() {
    await this.stop();
    await this.playNext();
  }

  async playNext() {
    if (this.queue.length === 0) {
      console.log('[MusicPlayer] Queue is empty');
      return;
    }
    
    // Prevent infinite loop - if we've tried to play the same track multiple times, skip it
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
      const currentUrl = this.queue[this.currentIndex];
      const retryCount = this._retryCount || new Map();
      const count = retryCount.get(currentUrl) || 0;
      if (count >= 3) {
        console.error(`[MusicPlayer] Skipping ${currentUrl} after ${count} failed attempts`);
        this.queue.splice(this.currentIndex, 1);
        if (this.currentIndex >= this.queue.length) {
          this.currentIndex = 0;
        }
        retryCount.delete(currentUrl);
        this._retryCount = retryCount;
      }
    }
    
    // Ensure audio track is started before playing
    if (!this.audioTrack || !this.audioSource) {
      console.log('[MusicPlayer] Audio track not started in playNext, starting now...');
      try {
        await this.start();
      } catch (error) {
        console.error('[MusicPlayer] Error starting audio track in playNext:', error);
        return;
      }
    }
    
    if (this.queue.length === 0) {
      console.log('[MusicPlayer] Queue is empty after cleanup');
      return;
    }
    
    this.currentIndex++;
    if (this.currentIndex >= this.queue.length) {
      this.currentIndex = 0; // Loop
    }
    
    const nextUrl = this.queue[this.currentIndex];
    
    // Track retry count
    const retryCount = this._retryCount || new Map();
    retryCount.set(nextUrl, (retryCount.get(nextUrl) || 0) + 1);
    this._retryCount = retryCount;
    
    try {
      await this.play(nextUrl);
      // Reset retry count on success
      retryCount.delete(nextUrl);
      this._retryCount = retryCount;
    } catch (error) {
      console.error('[MusicPlayer] Error in playNext:', error);
      // Retry count is already incremented, will be checked on next call
    }
  }

  async addToQueue(url) {
    this.queue.push(url);
    console.log(`[MusicPlayer] Added to queue: ${url} (${this.queue.length} items)`);
    
    // If nothing is playing, start playing
    if (!this.isPlaying && this.currentIndex === -1) {
      try {
        await this.playNext();
      } catch (error) {
        console.error('[MusicPlayer] Error in playNext from addToQueue:', error);
        // Don't throw - just log the error
      }
    }
  }

  clearQueue() {
    this.queue = [];
    this.currentIndex = -1;
    console.log('[MusicPlayer] Queue cleared');
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    console.log(`[MusicPlayer] Volume set to: ${Math.round(this.volume * 100)}%`);
    // Volume is applied when processing audio frames in the play() method
  }

  async cleanup() {
    await this.stop();
    if (this.audioTrack) {
      await this.room.localParticipant.unpublishTrack(this.audioTrack);
      this.audioTrack.stop();
      this.audioTrack = null;
    }
  }
}

module.exports = { MusicPlayer };
