export const SOUNDPAD_PANEL_TOGGLE_EVENT = 'soundpadPanelToggle';
export const SOUNDPAD_OPEN_MANAGER_EVENT = 'soundpadOpenManager';

export function toggleSoundpadPanel() {
  window.dispatchEvent(new CustomEvent(SOUNDPAD_PANEL_TOGGLE_EVENT));
}

export function openSoundpadManager() {
  window.dispatchEvent(new CustomEvent(SOUNDPAD_OPEN_MANAGER_EVENT));
}
