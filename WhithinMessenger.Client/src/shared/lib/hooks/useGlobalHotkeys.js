import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import hotkeyStorage from '../utils/hotkeyStorage';
import { soundpadBridge } from '../soundpad/soundpadBridge';
import { soundpadStorage } from '../soundpad/soundpadStorage';
import {
  buildAllElectronShortcuts,
  getSlotIdFromAction,
  isSoundpadAction,
} from '../soundpad/soundpadHotkeys';
import { toggleSoundpadPanel } from '../soundpad/soundpadPanelEvents';

const SHORTCUT_DEDUPE_MS = 200;

const isElectronEnv = () => Boolean(window.electronAPI?.isElectron);

const isEditableTarget = (target) => {
  if (!target || typeof target !== 'object') return false;
  const el = target;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable === true;
};

export const useGlobalHotkeys = (onToggleMic, onToggleAudio) => {
  const [currentHotkeys, setCurrentHotkeys] = useState(() => hotkeyStorage.getHotkeys());
  const [soundpadSlots, setSoundpadSlots] = useState(() => soundpadStorage.getConfig().slots);
  const lastShortcutDispatchRef = useRef({ action: null, at: 0 });

  const handleGlobalShortcut = useCallback((shortcut) => {
    const now = Date.now();
    if (
      lastShortcutDispatchRef.current.action === shortcut &&
      now - lastShortcutDispatchRef.current.at < SHORTCUT_DEDUPE_MS
    ) {
      return;
    }
    lastShortcutDispatchRef.current = { action: shortcut, at: now };

    console.log('🎹 Получена глобальная горячая клавиша:', shortcut);
    
    switch (shortcut) {
      case 'toggle-mic':
        if (onToggleMic) {
          onToggleMic();
          console.log('✅ Выполнена команда: переключение микрофона');
        }
        break;
      case 'toggle-audio':
        if (onToggleAudio) {
          onToggleAudio();
          console.log('✅ Выполнена команда: переключение наушников');
        }
        break;
      case 'toggle-soundpad-panel':
        toggleSoundpadPanel();
        console.log('✅ Выполнена команда: панель саундпада');
        break;
      default:
        if (isSoundpadAction(shortcut)) {
          const slotId = getSlotIdFromAction(shortcut);
          if (slotId) {
            soundpadBridge.playSlot(slotId).catch((error) => {
              console.warn('Саундпад: не удалось воспроизвести по шорткату', slotId, error);
            });
          }
          break;
        }
        console.log('❓ Неизвестная горячая клавиша:', shortcut);
    }
  }, [onToggleMic, onToggleAudio]);

  const updateElectronHotkeys = useCallback(() => {
    if (window.electronAPI?.updateGlobalShortcuts) {
      const electronHotkeys = buildAllElectronShortcuts();
      window.electronAPI.updateGlobalShortcuts(electronHotkeys);
      console.log('🔄 Глобальные привязки обновлены в Electron:', electronHotkeys);
    }
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.onGlobalShortcut) {
      console.log('ℹ️ Приложение запущено в браузере — горячие клавиши только в окне');
      return undefined;
    }

    window.electronAPI.onGlobalShortcut(handleGlobalShortcut);
    console.log('✅ Слушатель глобальных горячих клавиш Electron зарегистрирован');

    return () => {
      window.electronAPI.removeGlobalShortcutListener?.();
    };
  }, [handleGlobalShortcut]);

  useEffect(() => {
    // Electron main process: passive global keyboard + mouse hooks.
    if (!window.electronAPI?.updateGlobalShortcuts) {
      return;
    }
    updateElectronHotkeys();
  }, [currentHotkeys, soundpadSlots, updateElectronHotkeys]);

  useEffect(() => {
    const onSoundpadConfigChange = () => {
      setSoundpadSlots(soundpadStorage.getConfig().slots);
    };
    window.addEventListener('soundpadConfigChanged', onSoundpadConfigChange);
    return () => window.removeEventListener('soundpadConfigChanged', onSoundpadConfigChange);
  }, []);

  const hotkeyToAction = useMemo(() => {
    const map = {
      [currentHotkeys.toggleMic]: 'toggle-mic',
      [currentHotkeys.toggleAudio]: 'toggle-audio',
      [currentHotkeys.toggleSoundpadPanel]: 'toggle-soundpad-panel',
    };
    for (const slot of soundpadSlots) {
      if (slot.hotkey) {
        map[slot.hotkey] = `soundpad:${slot.id}`;
      }
    }
    return map;
  }, [currentHotkeys, soundpadSlots]);

  // Keyboard in-window (fallback when global hook unavailable; dedupe avoids double-fire).
  useEffect(() => {
    const handleKeyboardHotkey = (event) => {
      if (event.repeat || isEditableTarget(event.target)) {
        return;
      }

      const keyString = hotkeyStorage.parseKeyEvent(event);
      const action = hotkeyToAction[keyString];
      if (!action) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      handleGlobalShortcut(action);
    };

    window.addEventListener('keydown', handleKeyboardHotkey, true);
    return () => window.removeEventListener('keydown', handleKeyboardHotkey, true);
  }, [hotkeyToAction, handleGlobalShortcut]);

  useEffect(() => {
    if (isElectronEnv()) {
      return undefined;
    }

    const handleMouseHotkey = (event) => {
      const isSupportedMouseButton =
        event.button === 3 || event.button === 4 || event.button === 1;
      if (!isSupportedMouseButton) {
        return;
      }

      const mouseString = hotkeyStorage.parseMouseEvent(event);
      const action = hotkeyToAction[mouseString];
      if (!action) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      handleGlobalShortcut(action);
    };

    window.addEventListener('mousedown', handleMouseHotkey, true);
    window.addEventListener('mouseup', handleMouseHotkey, true);
    window.addEventListener('auxclick', handleMouseHotkey, true);
    window.addEventListener('pointerdown', handleMouseHotkey, true);
    window.addEventListener('pointerup', handleMouseHotkey, true);

    return () => {
      window.removeEventListener('mousedown', handleMouseHotkey, true);
      window.removeEventListener('mouseup', handleMouseHotkey, true);
      window.removeEventListener('auxclick', handleMouseHotkey, true);
      window.removeEventListener('pointerdown', handleMouseHotkey, true);
      window.removeEventListener('pointerup', handleMouseHotkey, true);
    };
  }, [hotkeyToAction, handleGlobalShortcut]);

  // Слушаем изменения горячих клавиш в localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      const newHotkeys = hotkeyStorage.getHotkeys();
      setCurrentHotkeys(newHotkeys);
      updateElectronHotkeys();
    };

    // Слушаем изменения в localStorage
    window.addEventListener('storage', handleStorageChange);
    
    // Также слушаем кастомное событие для изменений в том же окне
    const handleHotkeyChange = () => {
      const newHotkeys = hotkeyStorage.getHotkeys();
      setCurrentHotkeys(newHotkeys);
      updateElectronHotkeys();
    };
    
    window.addEventListener('hotkeySettingsChanged', handleHotkeyChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('hotkeySettingsChanged', handleHotkeyChange);
    };
  }, [updateElectronHotkeys]);

  return { isElectron: isElectronEnv };
};



