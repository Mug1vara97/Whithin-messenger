import { useGlobalCall } from './useGlobalCall';
import { useGlobalHotkeys } from './useGlobalHotkeys';

/**
 * Глобальные горячие клавиши (Electron + мышь) должны жить выше любого экрана,
 * иначе при отсутствии UserPanel или при перехвате событий окном они не сработают.
 */
export function ElectronHotkeysBridge() {
  const { toggleMute, toggleGlobalAudio } = useGlobalCall();
  useGlobalHotkeys(toggleMute, toggleGlobalAudio);
  return null;
}
