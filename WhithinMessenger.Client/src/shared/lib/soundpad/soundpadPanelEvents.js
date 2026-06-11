export const SOUNDPAD_PANEL_TOGGLE_EVENT = 'soundpadPanelToggle';

export function toggleSoundpadPanel() {
  window.dispatchEvent(new CustomEvent(SOUNDPAD_PANEL_TOGGLE_EVENT));
}
