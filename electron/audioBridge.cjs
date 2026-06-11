const path = require('node:path');

const fs = require('node:fs');

const { spawn } = require('node:child_process');

const http = require('node:http');

const os = require('node:os');



const BRIDGE_PORT = 38473;

const BRIDGE_HOST = '127.0.0.1';



let bridgeProcess = null;

let bridgeReady = false;

let bridgeStartInFlight = null;

let mixerStartInFlight = null;

let autoDefaultCableMicEnabled = true;



const log = (...args) => console.log('[Soundpad:Electron]', ...args);

const warn = (...args) => console.warn('[Soundpad:Electron]', ...args);

const logError = (...args) => console.error('[Soundpad:Electron]', ...args);



function getBridgeExecutablePath() {

  const devPath = path.join(__dirname, 'audio-bridge-bin', 'Whithin.AudioBridge.exe');

  if (fs.existsSync(devPath)) {

    return devPath;

  }



  const packagedPath = path.join(process.resourcesPath, 'audio-bridge-bin', 'Whithin.AudioBridge.exe');

  if (fs.existsSync(packagedPath)) {

    return packagedPath;

  }



  return devPath;

}



function bridgeRequest(method, routePath, body = null) {

  return new Promise((resolve, reject) => {

    const payload = body ? JSON.stringify(body) : null;

    log('HTTP →', method, routePath, body ? { ...body, base64: body.base64 ? `[${body.base64.length} chars]` : undefined } : '');



    const request = http.request(

      {

        hostname: BRIDGE_HOST,

        port: BRIDGE_PORT,

        path: routePath,

        method,

        headers: payload

          ? {

              'Content-Type': 'application/json',

              'Content-Length': Buffer.byteLength(payload),

            }

          : undefined,

      },

      (response) => {

        let raw = '';

        response.on('data', (chunk) => {

          raw += chunk;

        });

        response.on('end', () => {

          try {

            const parsed = raw ? JSON.parse(raw) : {};

            log('HTTP ←', method, routePath, response.statusCode, parsed);

            if (response.statusCode >= 400) {

              reject(new Error(parsed.error || `Audio bridge error (${response.statusCode})`));

              return;

            }

            resolve(parsed);

          } catch (error) {

            logError('HTTP parse error', method, routePath, raw, error);

            reject(error);

          }

        });

      }

    );



    request.on('error', (error) => {

      logError('HTTP request failed', method, routePath, error.message);

      reject(error);

    });

    if (payload) {

      request.write(payload);

    }

    request.end();

  });

}



async function pingBridge() {

  try {

    await bridgeRequest('GET', '/status');

    return true;

  } catch {

    return false;

  }

}



async function spawnBridgeProcess() {

  const executable = getBridgeExecutablePath();

  log('spawnBridgeProcess:', executable);



  if (!fs.existsSync(executable)) {

    throw new Error(

      'Whithin.AudioBridge.exe not found. Build it: dotnet publish electron/Whithin.AudioBridge -c Release -r win-x64 -o electron/audio-bridge-bin'

    );

  }



  const child = spawn(executable, ['--port', String(BRIDGE_PORT)], {

    stdio: ['ignore', 'pipe', 'pipe'],

    windowsHide: true,

  });



  log('spawned pid', child.pid);



  child.stdout.on('data', (chunk) => {

    const text = chunk.toString().trim();

    if (text) {

      console.log('[Soundpad:Bridge]', text);

    }

    if (text.includes('"event":"ready"')) {

      bridgeReady = true;

    }

  });



  child.stderr.on('data', (chunk) => {

    const text = chunk.toString().trim();

    if (text) {

      console.error('[Soundpad:Bridge]', text);

    }

  });



  child.on('exit', (code) => {

    if (bridgeProcess === child) {

      bridgeProcess = null;

      bridgeReady = false;

    }

    warn('bridge process exited', { pid: child.pid, code });

  });



  bridgeProcess = child;



  const startedAt = Date.now();

  while (!bridgeReady && Date.now() - startedAt < 8000) {

    if (await pingBridge()) {

      bridgeReady = true;

      log('bridge ready via ping');

      break;

    }

    await new Promise((resolve) => setTimeout(resolve, 150));

  }



  if (!bridgeReady) {

    if (bridgeProcess === child) {

      child.kill();

      bridgeProcess = null;

    }

    throw new Error('Audio bridge failed to start');

  }

}



async function ensureBridgeProcess() {

  if (bridgeReady) {

    return;

  }



  if (await pingBridge()) {

    bridgeReady = true;

    log('reusing existing bridge on port', BRIDGE_PORT);

    return;

  }



  if (bridgeStartInFlight) {

    log('waiting for bridge start already in flight');

    return bridgeStartInFlight;

  }



  bridgeStartInFlight = (async () => {

    if (await pingBridge()) {

      bridgeReady = true;

      return;

    }

    await spawnBridgeProcess();

  })();



  try {

    await bridgeStartInFlight;

  } finally {

    bridgeStartInFlight = null;

  }

}



async function listDevices() {

  await ensureBridgeProcess();

  return bridgeRequest('GET', '/devices');

}



async function getStatus() {

  await ensureBridgeProcess();

  return bridgeRequest('GET', '/status');

}



async function startBridge(captureDeviceId, renderDeviceId) {

  log('startBridge IPC', { captureDeviceId, renderDeviceId });

  await ensureBridgeProcess();

  return bridgeRequest('POST', '/bridge/start', {

    captureDeviceId,

    renderDeviceId,

  });

}



async function ensureMixerBridgeStarted(captureDeviceId = null, renderDeviceId = null) {

  await ensureBridgeProcess();



  try {

    const status = await bridgeRequest('GET', '/status');

    if (status?.running) {

      log('ensureMixerBridgeStarted: already running', {

        captureDevice: status.captureDevice,

        renderDevice: status.renderDevice,

      });

      return status;

    }

  } catch (error) {

    warn('ensureMixerBridgeStarted: status check failed', error.message);

  }



  if (mixerStartInFlight) {

    log('ensureMixerBridgeStarted: waiting for start in flight');

    return mixerStartInFlight;

  }



  mixerStartInFlight = (async () => {

    log('ensureMixerBridgeStarted: starting mixer', { captureDeviceId, renderDeviceId });

    return startBridge(captureDeviceId, renderDeviceId);

  })();



  try {

    return await mixerStartInFlight;

  } finally {

    mixerStartInFlight = null;

  }

}



async function stopBridge() {

  log('stopBridge IPC');

  if (!(await pingBridge())) {

    return { ok: true };

  }

  return bridgeRequest('POST', '/bridge/stop');

}



async function playSoundFile(filePath, volume = 1) {

  const status = await getStatus();

  if (!status?.running) {

    warn('playSoundFile: bridge NOT running — enable bridge in soundpad settings');

  }



  const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;

  log('playSoundFile', { filePath, volume, sizeBytes: stat?.size ?? 0 });



  await ensureBridgeProcess();

  return bridgeRequest('POST', '/play', { filePath, volume });

}



async function stopPlayback() {

  log('stopPlayback IPC');

  await ensureBridgeProcess();

  return bridgeRequest('POST', '/play/stop');

}



function writeTempSoundFile(base64Data, extension = '.wav') {

  if (!base64Data || base64Data.length === 0) {

    throw new Error('Empty audio payload (base64)');

  }



  const soundsDir = path.join(os.tmpdir(), 'whithin-soundpad');

  fs.mkdirSync(soundsDir, { recursive: true });

  const filePath = path.join(soundsDir, `sound-${Date.now()}${extension}`);

  const buffer = Buffer.from(base64Data, 'base64');



  if (buffer.length === 0) {

    throw new Error('Decoded audio buffer is empty');

  }



  fs.writeFileSync(filePath, buffer);

  log('writeTempSoundFile', { filePath, extension, sizeBytes: buffer.length });

  return filePath;

}



async function restoreDefaultCableRender() {
  if (process.platform !== 'win32') {
    return { ok: true, skipped: true };
  }

  try {
    await ensureBridgeProcess();
    log('restoreDefaultCableRender');
    const result = await bridgeRequest('POST', '/default-render/restore');
    log('restoreDefaultCableRender: done', result);
    return result;
  } catch (error) {
    warn('restoreDefaultCableRender failed', error.message);
    return { ok: false, error: error.message };
  }
}

async function activateDefaultCableRender(deviceId = null) {
  if (process.platform !== 'win32') {
    return { ok: true, skipped: true };
  }

  await ensureBridgeProcess();
  log('activateDefaultCableRender', { deviceId: deviceId || '(CABLE Input)' });
  try {
    return await bridgeRequest('POST', '/default-render/activate', deviceId ? { deviceId } : {});
  } catch (error) {
    warn('activateDefaultCableRender failed', error.message);
    return { ok: false, error: error.message };
  }
}

async function getDefaultRenderStatus() {
  await ensureBridgeProcess();
  return bridgeRequest('GET', '/default-render/status');
}

async function restoreDefaultCableMic() {
  if (process.platform !== 'win32') {
    return { ok: true, skipped: true };
  }

  try {
    await ensureBridgeProcess();
    log('restoreDefaultCableMic');
    const result = await bridgeRequest('POST', '/default-capture/restore');
    log('restoreDefaultCableMic: done', result);
    return result;
  } catch (error) {
    warn('restoreDefaultCableMic failed', error.message);
    return { ok: false, error: error.message };
  }
}

async function activateDefaultCableMic(deviceId = null) {
  if (process.platform !== 'win32' || !autoDefaultCableMicEnabled) {
    log('activateDefaultCableMic skipped', { platform: process.platform, enabled: autoDefaultCableMicEnabled });
    return { ok: true, skipped: true };
  }

  await ensureBridgeProcess();
  log('activateDefaultCableMic', { deviceId: deviceId || '(CABLE Output)' });
  try {
    return await bridgeRequest('POST', '/default-capture/activate', deviceId ? { deviceId } : {});
  } catch (error) {
    warn('activateDefaultCableMic failed', error.message);
    return { ok: false, error: error.message };
  }
}

async function applyAutoDefaultCableMicSetting(enabled) {
  autoDefaultCableMicEnabled = Boolean(enabled);
  log('applyAutoDefaultCableMicSetting', { enabled: autoDefaultCableMicEnabled });

  if (autoDefaultCableMicEnabled) {
    return activateDefaultCableMic();
  }

  return restoreDefaultCableMic();
}

async function applySoundpadAudioConfig(config) {
  if (process.platform !== 'win32') {
    return { ok: true, skipped: true, reason: 'not-win32' };
  }

  if (!config) {
    return { ok: true, skipped: true, reason: 'no-config' };
  }

  const isSystem = config.soundpadMode === 'system';
  const autoDefault = config.autoDefaultCableMic !== false;
  autoDefaultCableMicEnabled = isSystem && autoDefault;

  log('applySoundpadAudioConfig', { soundpadMode: config.soundpadMode, autoDefault, isSystem });

  try {
    if (isSystem) {
      const micResult = autoDefault
        ? await activateDefaultCableMic(config.cableOutputDeviceId || null)
        : { ok: true, skipped: true };

      let renderResult = { ok: true, skipped: true };
      try {
        renderResult = await activateDefaultCableRender(config.cableInputDeviceId || null);
      } catch (error) {
        warn('activateDefaultCableRender failed', error.message);
        renderResult = { ok: false, error: error.message };
      }

      let bridgeResult = { ok: true, skipped: true };
      try {
        bridgeResult = await ensureMixerBridgeStarted(
          config.captureDeviceId || null,
          config.renderDeviceId || null,
        );
      } catch (error) {
        warn('ensureMixerBridgeStarted failed', error.message);
        bridgeResult = { ok: false, error: error.message };
      }

      return { ...micResult, render: renderResult, bridge: bridgeResult };
    }

    const restoreResult = await restoreDefaultCableMic();
    try {
      await restoreDefaultCableRender();
    } catch (error) {
      warn('restoreDefaultCableRender during inApp switch failed', error.message);
    }
    try {
      await stopBridge();
    } catch (error) {
      warn('stopBridge during inApp switch failed', error.message);
    }

    return restoreResult;
  } catch (error) {
    warn('applySoundpadAudioConfig failed', error.message);
    return { ok: false, error: error.message };
  }
}

async function shutdownBridge() {
  log('shutdownBridge');

  try {
    await restoreDefaultCableMic();
    await restoreDefaultCableRender();
  } catch (error) {
    warn('restoreDefaultCableMic/render failed during shutdown', error.message);
  }

  if (bridgeProcess && !bridgeProcess.killed) {
    bridgeProcess.kill();
  }

  bridgeProcess = null;
  bridgeReady = false;
}



function registerAudioBridgeIpc(ipcMain) {

  ipcMain.handle('soundpad:list-devices', async () => {

    log('IPC soundpad:list-devices');

    return listDevices();

  });



  ipcMain.handle('soundpad:get-status', async () => {

    log('IPC soundpad:get-status');

    return getStatus();

  });



  ipcMain.handle('soundpad:start-bridge', async (_, payload) => {

    log('IPC soundpad:start-bridge', payload);

    return startBridge(payload?.captureDeviceId, payload?.renderDeviceId);

  });



  ipcMain.handle('soundpad:stop-bridge', async () => {

    log('IPC soundpad:stop-bridge');

    return stopBridge();

  });



  ipcMain.handle('soundpad:play-base64', async (_, payload) => {

    log('IPC soundpad:play-base64', {

      extension: payload?.extension,

      volume: payload?.volume,

      slotId: payload?.slotId,

      label: payload?.label,

      base64Length: payload?.base64?.length ?? 0,

    });



    try {

      const extension = payload?.extension || '.wav';

      const filePath = writeTempSoundFile(payload?.base64, extension);

      const result = await playSoundFile(filePath, payload?.volume ?? 1);

      log('IPC soundpad:play-base64 success', result);

      return result;

    } catch (error) {

      logError('IPC soundpad:play-base64 failed', error.message);

      throw error;

    }

  });



  ipcMain.handle('soundpad:stop-playback', async () => {

    log('IPC soundpad:stop-playback');

    return stopPlayback();

  });



  ipcMain.handle('soundpad:set-auto-default-mic', async (_, enabled) => {
    log('IPC soundpad:set-auto-default-mic', { enabled });
    return applyAutoDefaultCableMicSetting(enabled);
  });

  ipcMain.handle('soundpad:sync-audio-config', async (_, config) => {
    log('IPC soundpad:sync-audio-config', config);
    const { writeSoundpadAudioConfig } = require('./soundpadElectronConfig.cjs');
    if (config) {
      writeSoundpadAudioConfig(config);
    }
    return applySoundpadAudioConfig(config);
  });

  ipcMain.handle('soundpad:get-default-capture-status', async () => {
    log('IPC soundpad:get-default-capture-status');
    await ensureBridgeProcess();
    return bridgeRequest('GET', '/default-capture/status');
  });

  ipcMain.handle('soundpad:get-default-render-status', async () => {
    log('IPC soundpad:get-default-render-status');
    return getDefaultRenderStatus();
  });

  ipcMain.handle('soundpad:is-available', async () => {

    const exe = getBridgeExecutablePath();

    const result = {

      available: process.platform === 'win32' && fs.existsSync(exe),

      platform: process.platform,

      executable: exe,

      executableExists: fs.existsSync(exe),

    };

    log('IPC soundpad:is-available', result);

    return result;

  });

}



module.exports = {
  registerAudioBridgeIpc,
  shutdownBridge,
  activateDefaultCableMic,
  restoreDefaultCableMic,
  activateDefaultCableRender,
  restoreDefaultCableRender,
  applyAutoDefaultCableMicSetting,
  applySoundpadAudioConfig,
};


