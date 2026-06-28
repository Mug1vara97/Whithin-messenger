export const SOUNDPAD_PANEL_TOGGLE_EVENT = 'soundpadPanelToggle';
export const SOUNDPAD_OPEN_MANAGER_EVENT = 'soundpadOpenManager';
export const SOUNDPAD_PLAYBACK_CHANGED_EVENT = 'soundpadPlaybackChanged';

export function toggleSoundpadPanel() {
  window.dispatchEvent(new CustomEvent(SOUNDPAD_PANEL_TOGGLE_EVENT));
}

export function openSoundpadManager() {
  window.dispatchEvent(new CustomEvent(SOUNDPAD_OPEN_MANAGER_EVENT));
}

export function notifySoundpadPlaybackChanged(playingSlotId) {
  window.dispatchEvent(
    new CustomEvent(SOUNDPAD_PLAYBACK_CHANGED_EVENT, {
      detail: { playingSlotId: playingSlotId ?? null },
    }),
  );
}
