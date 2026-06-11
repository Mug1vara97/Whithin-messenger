import hotkeyStorage from '../utils/hotkeyStorage';
import { soundpadStorage } from './soundpadStorage';

export const SOUNDPAD_ACTION_PREFIX = 'soundpad:';

export function isSoundpadAction(action) {
  return typeof action === 'string' && action.startsWith(SOUNDPAD_ACTION_PREFIX);
}

export function getSlotIdFromAction(action) {
  if (!isSoundpadAction(action)) return null;
  return action.slice(SOUNDPAD_ACTION_PREFIX.length);
}

export function buildSoundpadShortcutMap() {
  const map = {};
  for (const slot of soundpadStorage.getConfig().slots) {
    if (slot.hotkey && slot.soundId) {
      map[`${SOUNDPAD_ACTION_PREFIX}${slot.id}`] = slot.hotkey;
    }
  }
  return map;
}

export function buildAllElectronShortcuts() {
  const voice = hotkeyStorage.getHotkeys();
  return {
    'toggle-mic': voice.toggleMic,
    'toggle-audio': voice.toggleAudio,
    'toggle-soundpad-panel': voice.toggleSoundpadPanel,
    ...buildSoundpadShortcutMap(),
  };
}

export function findHotkeyConflict(key, excludeSlotId = null) {
  if (!key) return null;

  const voiceConflict = hotkeyStorage.isKeyUsed(key);
  if (voiceConflict) {
    return { type: 'voice', label: voiceConflict };
  }

  for (const slot of soundpadStorage.getConfig().slots) {
    if (slot.id !== excludeSlotId && slot.hotkey === key) {
      return { type: 'soundpad', label: slot.label || 'саундпад' };
    }
  }

  return null;
}
