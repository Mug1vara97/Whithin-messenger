const path = require('node:path');
const fs = require('node:fs');
const { app } = require('electron');

function getConfigPath() {
  return path.join(app.getPath('userData'), 'soundpad-audio.json');
}

function readSoundpadAudioConfig() {
  try {
    const filePath = getConfigPath();
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeSoundpadAudioConfig(config) {
  const filePath = getConfigPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');
}

module.exports = {
  readSoundpadAudioConfig,
  writeSoundpadAudioConfig,
};
