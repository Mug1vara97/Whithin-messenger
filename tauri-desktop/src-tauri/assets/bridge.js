//! Injected into the React client so the existing Electron screen-share path works.

(function () {
  if (window.__whithinTauriBridgeInstalled) return;
  window.__whithinTauriBridgeInstalled = true;

  function waitForTauri(cb) {
    if (window.__TAURI__?.core?.invoke) {
      cb();
      return;
    }
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (window.__TAURI__?.core?.invoke) {
        clearInterval(timer);
        cb();
      } else if (tries > 200) {
        clearInterval(timer);
        console.warn('[whithin-tauri] __TAURI__ not available');
      }
    }, 25);
  }

  function decodePcmBase64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new Float32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));
  }

  async function currentWindow() {
    return window.__TAURI__.window.getCurrentWindow();
  }

  function parseCssColorToRgba(color) {
    if (!color || typeof color !== 'string') return null;
    const hex = color.trim();
    const short = /^#([0-9a-f]{3})$/i.exec(hex);
    if (short) {
      const s = short[1];
      return {
        red: parseInt(s[0] + s[0], 16),
        green: parseInt(s[1] + s[1], 16),
        blue: parseInt(s[2] + s[2], 16),
        alpha: 255,
      };
    }
    const full = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex);
    if (full) {
      return {
        red: parseInt(full[1].slice(0, 2), 16),
        green: parseInt(full[1].slice(2, 4), 16),
        blue: parseInt(full[1].slice(4, 6), 16),
        alpha: full[2] ? parseInt(full[2], 16) : 255,
      };
    }
    const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)$/i.exec(hex);
    if (rgb) {
      return {
        red: Number(rgb[1]),
        green: Number(rgb[2]),
        blue: Number(rgb[3]),
        alpha: rgb[4] != null ? Math.round(Number(rgb[4]) * 255) : 255,
      };
    }
    return null;
  }

  function ensureTitlebarDragRegion() {
    const mark = () => {
      const shim = document.getElementById('electron-titlebar-drag-shim');
      if (shim && !shim.hasAttribute('data-tauri-drag-region')) {
        shim.setAttribute('data-tauri-drag-region', '');
      }
      const name = document.querySelector('.electron-titlebar-app-name');
      if (name && !name.hasAttribute('data-tauri-drag-region')) {
        name.setAttribute('data-tauri-drag-region', '');
      }
    };
    mark();
    const observer = new MutationObserver(mark);
    const start = () => {
      observer.observe(document.documentElement, { childList: true, subtree: true });
      mark();
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  }

  waitForTauri(() => {
    const { invoke } = window.__TAURI__.core;
    const { listen } = window.__TAURI__.event;

    const audioListeners = new Map();

    listen('process-audio-data', (event) => {
      const payload = event.payload || {};
      if (!payload.pcmBase64) return;
      const audioData = {
        buffer: decodePcmBase64(payload.pcmBase64),
        channels: Number(payload.channels) || 2,
        sampleRate: Number(payload.sampleRate) || 48000,
      };
      audioListeners.forEach((cb) => {
        try {
          cb(audioData);
        } catch (err) {
          console.warn('[process-audio] listener error', err);
        }
      });
    }).catch((err) => console.warn('[process-audio] listen failed', err));

    window.processAudioCapture = {
      isPlatformSupported: async () => Boolean(await invoke('audio_is_platform_supported')),
      checkPermission: async () => invoke('audio_check_permission'),
      requestPermission: async () => invoke('audio_request_permission'),
      getProcessList: async () => [],
      startCapture: async (pid) => Boolean(await invoke('audio_start_capture', { pid: Number(pid) })),
      startCaptureExclude: async (pid) =>
        Boolean(await invoke('audio_start_capture_exclude', { pid: Number(pid) })),
      stopCapture: async () => Boolean(await invoke('audio_stop_capture')),
      isCapturing: async () => Boolean(await invoke('audio_is_capturing')),
      on: (eventName, callback) => {
        if (eventName !== 'audio-data' || typeof callback !== 'function') {
          return () => {};
        }
        const id = crypto.randomUUID();
        audioListeners.set(id, callback);
        return () => audioListeners.delete(id);
      },
      off: (eventName) => {
        if (!eventName || eventName === 'audio-data') audioListeners.clear();
      },
    };

    let shortcutListener = null;
    let shortcutsByAction = {};
    let lastShortcut = { action: null, at: 0 };

    function isEditableTarget(target) {
      if (!target || typeof target !== 'object') return false;
      const tag = String(target.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (target.isContentEditable) return true;
      const role = target.getAttribute?.('role');
      if (role === 'textbox' || role === 'searchbox' || role === 'combobox') return true;
      return Boolean(target.closest?.('input, textarea, select, [contenteditable="true"]'));
    }

    function parseMouseEvent(event) {
      const parts = [];
      if (event.ctrlKey) parts.push('Ctrl');
      if (event.altKey) parts.push('Alt');
      if (event.shiftKey) parts.push('Shift');
      if (event.metaKey) parts.push('Cmd');
      if (event.button === 3) parts.push('Mouse4');
      else if (event.button === 4) parts.push('Mouse5');
      else if (event.button === 1) parts.push('MiddleClick');
      else if (event.button === 0) parts.push('LeftClick');
      else if (event.button === 2) parts.push('RightClick');
      else return '';
      return parts.join('+');
    }

    function defaultShortcutMap() {
      let voice = {};
      let soundpad = null;
      try {
        voice = JSON.parse(localStorage.getItem('voiceChatHotkeys') || '{}') || {};
      } catch (_) {
        voice = {};
      }
      try {
        soundpad = JSON.parse(localStorage.getItem('whithinSoundpadConfig') || 'null');
      } catch (_) {
        soundpad = null;
      }
      const map = {
        'toggle-mic': voice.toggleMic || 'F1',
        'toggle-audio': voice.toggleAudio || 'F2',
        'toggle-soundpad-panel': voice.toggleSoundpadPanel || 'F3',
      };
      const slots = soundpad?.slots;
      if (Array.isArray(slots)) {
        slots.forEach((slot) => {
          if (slot?.id && slot?.hotkey) {
            map[`soundpad:${slot.id}`] = slot.hotkey;
          }
        });
      }
      return map;
    }

    function activeShortcutMap() {
      return Object.keys(shortcutsByAction).length ? shortcutsByAction : defaultShortcutMap();
    }

    function actionForAccelerator(accelerator) {
      if (!accelerator) return null;
      const map = activeShortcutMap();
      for (const [action, accel] of Object.entries(map)) {
        if (accel === accelerator) return action;
      }
      return null;
    }

    function fireShortcut(action) {
      if (!action) return;
      if (document.hasFocus() && isEditableTarget(document.activeElement)) return;
      const now = Date.now();
      if (lastShortcut.action === action && now - lastShortcut.at < 180) return;
      lastShortcut = { action, at: now };
      if (typeof shortcutListener === 'function') {
        try {
          shortcutListener(action);
        } catch (err) {
          console.warn('[whithin-tauri] shortcut listener error', err);
        }
      }
      try {
        window.dispatchEvent(new CustomEvent('whithin-global-shortcut', { detail: action }));
      } catch (_) {}
    }

    function syncShortcutsToNative(map) {
      const shortcuts = map && typeof map === 'object' ? { ...map } : defaultShortcutMap();
      shortcutsByAction = shortcuts;
      invoke('shortcuts_update', { shortcuts }).catch((err) => {
        console.warn('[whithin-tauri] shortcuts_update failed', err);
      });
    }

    function onMouse(event) {
      const isSideOrMiddle = event.button === 3 || event.button === 4 || event.button === 1;
      if (!isSideOrMiddle) return;
      if (isEditableTarget(event.target)) return;
      const action = actionForAccelerator(parseMouseEvent(event));
      if (action) fireShortcut(action);
    }

    document.addEventListener('mousedown', onMouse, true);
    document.addEventListener('mouseup', onMouse, true);
    document.addEventListener('auxclick', onMouse, true);

    listen('whithin-global-shortcut', (event) => {
      fireShortcut(event.payload);
    }).catch((err) => console.warn('[whithin-tauri] shortcut listen failed', err));

    const bootShortcuts = () => {
      try {
        syncShortcutsToNative(defaultShortcutMap());
      } catch (err) {
        console.warn('[whithin-tauri] shortcut boot failed', err);
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootShortcuts, { once: true });
    } else {
      bootShortcuts();
    }

    window.electronAPI = Object.assign(window.electronAPI || {}, {
      isElectron: true,
      isTauri: true,
      titleBarInsetPx: 32,
      // Custom picker; getDisplayMedia is polyfilled from native capture (no system UI).
      chooseScreenSource: () => invoke('choose_screen_source'),
      armScreenCapture: (options) => invoke('arm_screen_capture', { options: options || {} }),
      openExternal: async (url) => {
        try {
          await invoke('plugin:shell|open', { path: url });
        } catch {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      },
      windowMinimize: async () => {
        try {
          await invoke('window_minimize');
        } catch (err) {
          console.warn('[whithin-tauri] minimize failed', err);
          try {
            await (await currentWindow()).minimize();
          } catch (_) {}
        }
      },
      windowToggleMaximize: async () => {
        try {
          await invoke('window_toggle_maximize');
        } catch (err) {
          console.warn('[whithin-tauri] toggleMaximize failed', err);
          try {
            await (await currentWindow()).toggleMaximize();
          } catch (_) {}
        }
      },
      windowClose: async () => {
        try {
          await invoke('window_close');
        } catch (err) {
          console.warn('[whithin-tauri] close failed', err);
          try {
            await (await currentWindow()).close();
          } catch (_) {}
        }
      },
      focusWindow: async () => {
        try {
          await invoke('focus_main_window');
        } catch (err) {
          console.warn('[whithin-tauri] focusWindow failed', err);
        }
      },
      navigationReload: () => {
        window.location.reload();
      },
      setBadgeCount: (count) =>
        invoke('set_badge_count', { count: Number(count) || 0 }).catch((err) => {
          console.warn('[whithin-tauri] setBadgeCount failed', err);
        }),
      onDeepLink: (callback) => {
        if (typeof callback !== 'function') return undefined;
        let unlisten = () => {};
        listen('deep-link-received', (event) => {
          if (typeof event.payload === 'string') callback(event.payload);
        })
          .then((fn) => {
            unlisten = fn;
          })
          .catch(() => {});
        return () => unlisten();
      },
      pickBackgroundImage: () => invoke('pick_background_image'),
      loadBackgroundImage: (filePath) =>
        invoke('load_background_image', { filePath: String(filePath || '') }),
      clearBackgroundImage: () => invoke('clear_background_image'),
      saveMediaFile: (payload) => invoke('save_media_file', { payload: payload || {} }),
      syncWindowBackground: async (color) => {
        try {
          const rgba = parseCssColorToRgba(color);
          if (!rgba) return;
          await (await currentWindow()).setBackgroundColor(rgba);
        } catch (err) {
          console.warn('[whithin-tauri] syncWindowBackground failed', err);
        }
      },
      syncWindowShape: () => {},
      updateGlobalShortcuts: (shortcuts) => {
        syncShortcutsToNative(shortcuts);
        console.log('[whithin-tauri] passive shortcuts updated', shortcuts);
      },
      onGlobalShortcut: (callback) => {
        if (typeof callback !== 'function') return;
        shortcutListener = callback;
      },
      removeGlobalShortcutListener: () => {
        shortcutListener = null;
      },

      // Desktop notifications (custom HTML host, Electron-compatible)
      showDesktopNotification: (payload) =>
        invoke('show_desktop_notification', { payload: payload || {} }).catch((err) => {
          console.warn('[whithin-tauri] showDesktopNotification failed', err);
        }),
      dismissDesktopNotification: (id) =>
        invoke('desktop_notification_dismiss', { id: String(id) }).catch(() => {}),
      dismissDesktopNotificationsByChatId: (chatId) =>
        invoke('desktop_notification_dismiss_by_chat', { chatId: String(chatId) }).catch(() => {}),
      dismissAllDesktopNotifications: () =>
        invoke('desktop_notification_dismiss_all').catch(() => {}),
      syncDesktopNotificationSettings: (settings) =>
        invoke('desktop_notification_sync_settings', { settings: settings || {} }).catch(() => {}),
      syncDesktopNotificationTheme: (theme) =>
        invoke('desktop_notification_sync_theme', { theme: theme || {} }).catch(() => {}),
      onOpenNotification: (callback) => {
        if (typeof callback !== 'function') return undefined;
        let unlisten = () => {};
        listen('desktop-open-notification', (event) => {
          callback(event.payload);
        })
          .then((fn) => {
            unlisten = fn;
          })
          .catch(() => {});
        return () => unlisten();
      },

      // Incoming call overlay
      showCallOverlay: (payload) =>
        invoke('show_call_overlay', { payload: payload || {} }).catch((err) => {
          console.warn('[whithin-tauri] showCallOverlay failed', err);
        }),
      updateCallOverlay: (payload) =>
        invoke('update_call_overlay', { payload: payload || {} }).catch(() => {}),
      dismissCallOverlay: () => invoke('call_overlay_dismiss').catch(() => {}),
      syncCallOverlayTheme: (theme) =>
        invoke('call_overlay_sync_theme', { theme: theme || {} }).catch(() => {}),
      onCallOverlayAction: (callback) => {
        if (typeof callback !== 'function') return undefined;
        let unlisten = () => {};
        listen('call-overlay-action', (event) => {
          callback({ detail: event.payload });
        })
          .then((fn) => {
            unlisten = fn;
          })
          .catch(() => {});
        return () => unlisten();
      },

      // Active call participants overlay (Electron activeCallOverlay parity)
      showActiveCallOverlay: (payload) =>
        invoke('show_active_call_overlay', { payload: payload || {} }).catch((err) => {
          console.warn('[whithin-tauri] showActiveCallOverlay failed', err);
        }),
      updateActiveCallOverlay: (payload) =>
        invoke('update_active_call_overlay', { payload: payload || {} }).catch(() => {}),
      dismissActiveCallOverlay: () => invoke('dismiss_active_call_overlay').catch(() => {}),
      syncActiveCallOverlaySettings: (settings) =>
        invoke('sync_active_call_overlay_settings', { settings: settings || {} }).catch(() => {}),
      syncActiveCallOverlayTheme: (theme) =>
        invoke('sync_active_call_overlay_theme', { theme: theme || {} }).catch(() => {}),
      onForceActiveCallOverlaySync: (callback) => {
        if (typeof callback !== 'function') return undefined;
        let unlisten = () => {};
        listen('force-active-call-overlay-sync', () => {
          callback();
        })
          .then((fn) => {
            unlisten = fn;
          })
          .catch(() => {});
        return () => unlisten();
      },

      onWindowVisibilityChanged: (callback) => {
        if (typeof callback !== 'function') return undefined;
        let unlisten = () => {};
        listen('window-visibility-changed', (event) => {
          callback(event.payload);
        })
          .then((fn) => {
            unlisten = fn;
          })
          .catch(() => {});
        return () => unlisten();
      },
    });

    // ---- Custom getDisplayMedia (no Chromium picker) -------------------------
    // WebView2 cannot inject a source like Electron's setDisplayMediaRequestHandler,
    // so we replace getDisplayMedia entirely:
    //   Rust: Windows Graphics Capture → SIMD scale → JPEG → loopback WebSocket
    //   JS:   WebSocket → ImageDecoder (WebCodecs) → VideoFrame → MediaStreamTrackGenerator
    // Decoding runs in a Web Worker so the UI thread stays idle. Fallbacks:
    // main-thread generator → canvas.captureStream → whithin-asset:// polling.

    const FIRST_FRAME_TIMEOUT_MS = 6000;
    const DEFAULT_HEADER_LEN = 24;
    const FORMAT_JPEG = 1;
    const FORMAT_I420 = 2;

    // Self-contained (no closure captures) so it can be stringified into a worker.
    function whithinFramePump(cfg, sink) {
      const headerLen = cfg.headerLength || 24;
      const wantVideoFrame = cfg.mode === 'videoframe';
      const hasImageDecoder = typeof ImageDecoder === 'function';
      const hasVideoFrame = typeof VideoFrame === 'function';
      // BT.601 limited range — what libyuv/Chromium use for screen capture.
      const I420_COLOR_SPACE = {
        primaries: 'bt709',
        transfer: 'bt709',
        matrix: 'smpte170m',
        fullRange: false,
      };
      let ws;
      try {
        ws = new WebSocket(cfg.wsUrl);
      } catch (err) {
        if (sink.onClose) sink.onClose('connect-failed: ' + (err && err.message));
        return { stop() {} };
      }
      ws.binaryType = 'arraybuffer';

      let pending = null;
      let decoding = false;
      let stopped = false;
      let dropped = 0;
      let delivered = 0;
      let useImageDecoder = wantVideoFrame && hasImageDecoder && hasVideoFrame;

      const parseHeader = (buf) => {
        const dv = new DataView(buf, 0, headerLen);
        return {
          seq: dv.getUint32(0, true),
          width: dv.getUint32(4, true),
          height: dv.getUint32(8, true),
          tsUs: Number(dv.getBigUint64(12, true)),
          format: headerLen >= 24 ? dv.getUint32(20, true) : 1,
        };
      };

      // Raw I420 → VideoFrame: no decode, no colour conversion; WebRTC takes it as-is.
      const wrapI420 = (bytes, meta) => {
        const expected = meta.width * meta.height * 1.5;
        if (bytes.byteLength < expected) {
          throw new Error('short I420 payload: ' + bytes.byteLength + ' < ' + expected);
        }
        return new VideoFrame(bytes, {
          format: 'I420',
          codedWidth: meta.width,
          codedHeight: meta.height,
          timestamp: meta.tsUs,
          colorSpace: I420_COLOR_SPACE,
        });
      };

      const decodeWithImageDecoder = async (bytes, meta) => {
        const decoder = new ImageDecoder({ data: bytes, type: 'image/jpeg', preferAnimation: false });
        try {
          const { image } = await decoder.decode();
          const frame = new VideoFrame(image, { timestamp: meta.tsUs });
          image.close();
          return frame;
        } finally {
          decoder.close();
        }
      };

      const decodeWithBitmap = async (bytes, meta) => {
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
        if (!wantVideoFrame) return bitmap;
        const frame = new VideoFrame(bitmap, { timestamp: meta.tsUs });
        bitmap.close();
        return frame;
      };

      const drain = async () => {
        if (decoding) return;
        decoding = true;
        try {
          while (pending && !stopped) {
            const buf = pending;
            pending = null;
            if (buf.byteLength <= headerLen) continue;
            const meta = parseHeader(buf);
            const bytes = new Uint8Array(buf, headerLen);
            let frame;
            try {
              if (meta.format === 2) {
                // I420 payload (VideoFrame is drawable on canvas too, so both sinks accept it).
                frame = wrapI420(bytes, meta);
              } else {
                frame = useImageDecoder
                  ? await decodeWithImageDecoder(bytes, meta)
                  : await decodeWithBitmap(bytes, meta);
              }
            } catch (err) {
              if (meta.format === 2) {
                if (sink.onError) sink.onError(err);
                continue;
              }
              if (useImageDecoder) {
                // Some builds lack JPEG support in ImageDecoder — fall back once.
                useImageDecoder = false;
                try {
                  frame = await decodeWithBitmap(bytes, meta);
                } catch (err2) {
                  if (sink.onError) sink.onError(err2);
                  continue;
                }
              } else {
                if (sink.onError) sink.onError(err);
                continue;
              }
            }
            if (stopped) {
              try { frame.close(); } catch (_) {}
              break;
            }
            try {
              await sink.onFrame(frame, meta);
              delivered += 1;
            } catch (err) {
              if (sink.onError) sink.onError(err);
            }
          }
        } finally {
          decoding = false;
        }
      };

      ws.onmessage = (ev) => {
        if (stopped || !(ev.data instanceof ArrayBuffer)) return;
        if (pending) dropped += 1; // latest-only: decoder slower than producer
        pending = ev.data;
        drain();
      };
      ws.onopen = () => {
        if (sink.onOpen) sink.onOpen();
      };
      ws.onerror = () => {
        if (sink.onError) sink.onError(new Error('frame socket error'));
      };
      ws.onclose = (ev) => {
        const wasStopped = stopped;
        stopped = true;
        if (sink.onClose) sink.onClose(wasStopped ? 'stopped' : 'closed:' + ev.code);
      };

      return {
        stop() {
          stopped = true;
          pending = null;
          try { ws.close(); } catch (_) {}
        },
        stats() {
          return { delivered, dropped };
        },
      };
    }

    let workerUrlCache = null;
    function getPumpWorkerUrl() {
      if (workerUrlCache) return workerUrlCache;
      const source = `
${whithinFramePump.toString()}
let pump = null;
let writer = null;
let first = false;
self.onmessage = (e) => {
  const msg = e.data || {};
  if (msg.type === 'start') {
    writer = msg.writable.getWriter();
    pump = whithinFramePump(msg.cfg, {
      onFrame: async (frame, meta) => {
        try {
          await writer.write(frame);
        } catch (err) {
          try { frame.close(); } catch (_) {}
          throw err;
        }
        if (!first) {
          first = true;
          self.postMessage({ type: 'first', meta });
        }
      },
      onClose: (reason) => self.postMessage({ type: 'closed', reason }),
      onError: (err) => self.postMessage({ type: 'error', message: String((err && err.message) || err) }),
    });
  } else if (msg.type === 'stop') {
    if (pump) pump.stop();
    if (writer) writer.close().catch(() => {});
    self.close();
  } else if (msg.type === 'stats') {
    self.postMessage({ type: 'stats', stats: pump ? pump.stats() : null });
  }
};
`;
      workerUrlCache = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      return workerUrlCache;
    }

    function pickConstraint(value, fallback) {
      if (value == null) return fallback;
      if (typeof value === 'number') return value;
      if (typeof value === 'object') {
        if (typeof value.exact === 'number') return value.exact;
        if (typeof value.ideal === 'number') return value.ideal;
        if (typeof value.max === 'number') return value.max;
        if (typeof value.min === 'number') return value.min;
      }
      return fallback;
    }

    function constraintMax(value) {
      return value && typeof value === 'object' && typeof value.max === 'number' ? value.max : Infinity;
    }

    function parseVideoConstraints(constraints) {
      const video = constraints && typeof constraints.video === 'object' ? constraints.video : {};
      const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(v)));
      const width = Math.min(pickConstraint(video.width, 1280), constraintMax(video.width));
      const height = Math.min(pickConstraint(video.height, 720), constraintMax(video.height));
      const frameRate = Math.min(pickConstraint(video.frameRate, 30), constraintMax(video.frameRate));
      return {
        maxWidth: clamp(width, 320, 3840),
        maxHeight: clamp(height, 180, 2160),
        frameRate: clamp(frameRate, 5, 60),
      };
    }

    function wireTrackLifecycle(track, stopPipeline) {
      let stopped = false;
      const nativeStop = track.stop.bind(track);
      const stopAll = () => {
        if (stopped) return;
        stopped = true;
        try { stopPipeline(); } catch (_) {}
        invoke('display_capture_stop').catch(() => {});
      };
      track.stop = () => {
        stopAll();
        nativeStop();
      };
      track.addEventListener('ended', stopAll);
      return () => {
        // Remote side ended (window closed, capture error): end the track for the app.
        stopAll();
        try { nativeStop(); } catch (_) {}
      };
    }

    function startGeneratorInWorker(cfg) {
      return new Promise((resolve, reject) => {
        const generator = new MediaStreamTrackGenerator({ kind: 'video' });
        try { generator.contentHint = 'detail'; } catch (_) {}
        let worker;
        try {
          worker = new Worker(getPumpWorkerUrl());
        } catch (err) {
          reject(err);
          return;
        }
        let settled = false;
        let endTrack = null;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          worker.terminate();
          reject(new Error('worker pipeline: no frames within timeout'));
        }, FIRST_FRAME_TIMEOUT_MS);
        const stopPipeline = () => {
          try { worker.postMessage({ type: 'stop' }); } catch (_) {}
          setTimeout(() => worker.terminate(), 500);
        };
        worker.onmessage = (e) => {
          const msg = e.data || {};
          if (msg.type === 'first') {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            endTrack = wireTrackLifecycle(generator, stopPipeline);
            resolve({ track: generator, meta: msg.meta, mode: 'worker+generator' });
          } else if (msg.type === 'closed') {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              worker.terminate();
              reject(new Error('worker pipeline: socket closed (' + msg.reason + ')'));
            } else if (msg.reason !== 'stopped' && endTrack) {
              endTrack();
            }
          } else if (msg.type === 'error') {
            console.warn('[whithin-tauri] capture worker:', msg.message);
          }
        };
        worker.onerror = (e) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          worker.terminate();
          reject((e && e.error) || new Error((e && e.message) || 'worker error'));
        };
        const writable = generator.writable;
        worker.postMessage({ type: 'start', cfg, writable }, [writable]);
      });
    }

    function startGeneratorInMain(cfg) {
      return new Promise((resolve, reject) => {
        const generator = new MediaStreamTrackGenerator({ kind: 'video' });
        try { generator.contentHint = 'detail'; } catch (_) {}
        const writer = generator.writable.getWriter();
        let settled = false;
        let endTrack = null;
        let pump = null;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          if (pump) pump.stop();
          reject(new Error('main pipeline: no frames within timeout'));
        }, FIRST_FRAME_TIMEOUT_MS);
        const stopPipeline = () => {
          if (pump) pump.stop();
          writer.close().catch(() => {});
        };
        pump = whithinFramePump(cfg, {
          onFrame: async (frame, meta) => {
            try {
              await writer.write(frame);
            } catch (err) {
              try { frame.close(); } catch (_) {}
              throw err;
            }
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              endTrack = wireTrackLifecycle(generator, stopPipeline);
              resolve({ track: generator, meta, mode: 'main+generator' });
            }
          },
          onClose: (reason) => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              reject(new Error('main pipeline: socket closed (' + reason + ')'));
            } else if (reason !== 'stopped' && endTrack) {
              endTrack();
            }
          },
          onError: (err) => console.warn('[whithin-tauri] capture pump:', err && err.message),
        });
      });
    }

    function startCanvasPipeline(cfg, frameRate) {
      return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
        const stream = canvas.captureStream(frameRate);
        const track = stream.getVideoTracks()[0];
        if (!track) {
          reject(new Error('canvas.captureStream produced no track'));
          return;
        }
        try { track.contentHint = 'detail'; } catch (_) {}
        let settled = false;
        let endTrack = null;
        let pump = null;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          if (pump) pump.stop();
          reject(new Error('canvas pipeline: no frames within timeout'));
        }, FIRST_FRAME_TIMEOUT_MS);
        pump = whithinFramePump({ ...cfg, mode: 'bitmap' }, {
          onFrame: async (image, meta) => {
            // `image` is an ImageBitmap (JPEG) or a VideoFrame (I420); both draw.
            const w = image.displayWidth || image.width || meta.width;
            const h = image.displayHeight || image.height || meta.height;
            if (canvas.width !== w || canvas.height !== h) {
              canvas.width = w;
              canvas.height = h;
            }
            ctx.drawImage(image, 0, 0);
            image.close();
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              endTrack = wireTrackLifecycle(track, () => pump.stop());
              resolve({ track, meta, mode: 'canvas' });
            }
          },
          onClose: (reason) => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              reject(new Error('canvas pipeline: socket closed (' + reason + ')'));
            } else if (reason !== 'stopped' && endTrack) {
              endTrack();
            }
          },
          onError: (err) => console.warn('[whithin-tauri] canvas pump:', err && err.message),
        });
      });
    }

    // Last resort: poll the asset protocol (no WebSocket needed).
    async function startPollingPipeline(frameRate) {
      const start = Date.now();
      let info = null;
      while (Date.now() - start < FIRST_FRAME_TIMEOUT_MS) {
        info = await invoke('display_capture_frame_info');
        if (info && info.seq > 0 && info.width > 0) break;
        await new Promise((r) => setTimeout(r, 40));
      }
      if (!info || !(info.seq > 0)) throw new Error('polling pipeline: no frames');

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
      const stream = canvas.captureStream(Math.min(frameRate, 30));
      const track = stream.getVideoTracks()[0];
      try { track.contentHint = 'detail'; } catch (_) {}
      let stopped = false;
      let lastSeq = 0;
      let timer = 0;
      wireTrackLifecycle(track, () => {
        stopped = true;
        if (timer) clearTimeout(timer);
      });
      const pump = async () => {
        if (stopped) return;
        try {
          const cur = await invoke('display_capture_frame_info');
          if (cur && cur.seq > lastSeq) {
            lastSeq = cur.seq;
            const resp = await fetch(`http://whithin-asset.localhost/live-frame.jpg?s=${cur.seq}`, { cache: 'no-store' });
            if (resp.ok) {
              const blob = await resp.blob();
              if (blob.size > 0) {
                const bmp = await createImageBitmap(blob);
                if (canvas.width !== bmp.width || canvas.height !== bmp.height) {
                  canvas.width = bmp.width;
                  canvas.height = bmp.height;
                }
                ctx.drawImage(bmp, 0, 0);
                bmp.close();
              }
            }
          }
        } catch (_) {}
        if (!stopped) timer = setTimeout(pump, Math.max(16, Math.floor(1000 / Math.min(frameRate, 30))));
      };
      pump();
      return { track, meta: info, mode: 'polling' };
    }

    async function buildNativeCaptureTrack(info, wanted) {
      const cfg = {
        wsUrl: info.wsUrl,
        headerLength: info.headerLength || DEFAULT_HEADER_LEN,
        mode: 'videoframe',
      };
      const hasGenerator =
        typeof MediaStreamTrackGenerator === 'function' && typeof VideoFrame === 'function';
      const attempts = [];
      if (hasGenerator && typeof Worker === 'function' && info.wsUrl) {
        attempts.push(() => startGeneratorInWorker(cfg));
      }
      if (hasGenerator && info.wsUrl) {
        attempts.push(() => startGeneratorInMain(cfg));
      }
      if (info.wsUrl) {
        attempts.push(() => startCanvasPipeline(cfg, wanted.frameRate));
      }
      attempts.push(async () => {
        // Polling can only consume JPEG via the asset protocol — restart in that format.
        if (info.format !== 'jpeg') {
          await invoke('display_capture_stop').catch(() => {});
          await invoke('display_capture_start', { options: { ...wanted, format: 'jpeg' } });
        }
        return startPollingPipeline(wanted.frameRate);
      });

      let lastError = null;
      for (const attempt of attempts) {
        try {
          return await attempt();
        } catch (err) {
          lastError = err;
          console.warn('[whithin-tauri] capture pipeline fallback:', err && err.message);
        }
      }
      throw lastError || new Error('No capture pipeline available');
    }

    navigator.mediaDevices.getDisplayMedia = async (constraints) => {
      if (constraints && constraints.video === false) {
        throw new TypeError('getDisplayMedia requires video');
      }
      let selection = await invoke('get_last_screen_selection');
      if (!selection) {
        selection = await invoke('choose_screen_source');
      }
      if (!selection) {
        throw new DOMException('Permission denied', 'NotAllowedError');
      }

      const wanted = parseVideoConstraints(constraints);
      console.log('[whithin-tauri] getDisplayMedia → native capture', {
        id: selection.id,
        type: selection.type,
        name: selection.name,
        ...wanted,
      });

      await invoke('arm_screen_capture', { options: { captureAudio: false } });
      // Raw I420 when we can build VideoFrames (zero-conversion into WebRTC); JPEG otherwise.
      const format = typeof VideoFrame === 'function' ? 'i420' : 'jpeg';
      let info;
      try {
        info = await invoke('display_capture_start', { options: { ...wanted, format } });
      } catch (err) {
        throw new DOMException(String(err), 'NotReadableError');
      }

      try {
        const { track, meta, mode } = await buildNativeCaptureTrack(info, wanted);
        console.log('[whithin-tauri] screen capture running', {
          backend: info.backend,
          format: info.format,
          mode,
          size: `${meta && meta.width}x${meta && meta.height}`,
          fps: info.frameRate,
        });
        return new MediaStream([track]);
      } catch (err) {
        invoke('display_capture_stop').catch(() => {});
        throw new DOMException(
          'Screen capture failed: ' + ((err && err.message) || err),
          'NotReadableError',
        );
      }
    };

    ensureTitlebarDragRegion();
    console.log('[whithin-tauri] bridge ready (custom getDisplayMedia: WGC → WebCodecs)');
  });
})();
