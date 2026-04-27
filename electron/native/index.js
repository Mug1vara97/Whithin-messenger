const path = require('node:path');

let addon = null;
let loadError = null;

try {
  addon = require(path.join(__dirname, 'build/Release/windows_audio_capture.node'));
} catch (error) {
  loadError = error;
}

const ensure = () => {
  if (!addon) {
    throw new Error(`Windows audio capture addon is unavailable: ${loadError?.message || 'unknown error'}`);
  }
  return addon;
};

module.exports = {
  isAvailable: () => Boolean(addon),
  getLoadError: () => (loadError ? String(loadError.message || loadError) : null),
  listAudioSessions: () => ensure().listAudioSessions(),
  startCapture: (sessionId) => ensure().startCapture(sessionId),
  stopCapture: () => ensure().stopCapture(),
  readChunk: (maxFrames = 960) => ensure().readChunk(maxFrames),
  getCaptureState: () => ensure().getCaptureState()
};
