const path = require('node:path');

let addon = null;
let loadError = null;

try {
  addon = require(path.join(__dirname, 'build/Release/game_overlay.node'));
} catch (error) {
  loadError = error;
}

const ensure = () => {
  if (!addon) {
    throw new Error(`Game overlay addon unavailable: ${loadError?.message || 'unknown error'}`);
  }
  return addon;
};

module.exports = {
  isAvailable: () => Boolean(addon),
  getLoadError: () => (loadError ? String(loadError.message || loadError) : null),
  attach: (pid) => ensure().attach(pid),
  detach: () => ensure().detach(),
  toggle: () => ensure().toggle(),
  setVisible: (visible) => ensure().setVisible(Boolean(visible)),
  setState: (payload) => ensure().setState(payload),
  status: () => ensure().status()
};
