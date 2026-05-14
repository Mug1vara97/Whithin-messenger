import { useEffect, useCallback, useState } from 'react';
import hotkeyStorage from '../utils/hotkeyStorage';

export const useGlobalHotkeys = (onToggleMic, onToggleAudio) => {
  const [currentHotkeys, setCurrentHotkeys] = useState(() => hotkeyStorage.getHotkeys());

  const handleGlobalShortcut = useCallback((shortcut) => {
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
      default:
        console.log('❓ Неизвестная горячая клавиша:', shortcut);
    }
  }, [onToggleMic, onToggleAudio]);

  // Функция для обновления горячих клавиш в Electron
  const updateElectronHotkeys = useCallback((hotkeys) => {
    if (window.electronAPI && window.electronAPI.updateGlobalShortcuts) {
      const electronHotkeys = {
        'toggle-mic': hotkeys.toggleMic,
        'toggle-audio': hotkeys.toggleAudio
      };
      window.electronAPI.updateGlobalShortcuts(electronHotkeys);
      console.log('🔄 Горячие клавиши обновлены в Electron:', electronHotkeys);
    }
  }, []);

  useEffect(() => {
    // Проверяем, что мы в Electron
    if (window.electronAPI && window.electronAPI.onGlobalShortcut) {
      // Регистрируем слушатель глобальных горячих клавиш
      window.electronAPI.onGlobalShortcut(handleGlobalShortcut);
      
      // Устанавливаем текущие горячие клавиши
      updateElectronHotkeys(currentHotkeys);
      
      console.log('✅ Глобальные горячие клавиши активированы в Electron');
      
      // Очистка при размонтировании
      return () => {
        if (window.electronAPI && window.electronAPI.removeGlobalShortcutListener) {
          window.electronAPI.removeGlobalShortcutListener();
        }
      };
    } else {
      console.log('ℹ️ Приложение запущено в браузере - глобальные горячие клавиши недоступны');
    }
  }, [handleGlobalShortcut, currentHotkeys, updateElectronHotkeys]);

  useEffect(() => {
    const hotkeyToAction = {
      [currentHotkeys.toggleMic]: 'toggle-mic',
      [currentHotkeys.toggleAudio]: 'toggle-audio'
    };

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

    // Для разных драйверов/браузерного слоя события могут приходить как mousedown/mouseup/auxclick.
    window.addEventListener('mousedown', handleMouseHotkey, true);
    window.addEventListener('mouseup', handleMouseHotkey, true);
    window.addEventListener('auxclick', handleMouseHotkey, true);

    return () => {
      window.removeEventListener('mousedown', handleMouseHotkey, true);
      window.removeEventListener('mouseup', handleMouseHotkey, true);
      window.removeEventListener('auxclick', handleMouseHotkey, true);
    };
  }, [currentHotkeys, handleGlobalShortcut]);

  // Слушаем изменения горячих клавиш в localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      const newHotkeys = hotkeyStorage.getHotkeys();
      setCurrentHotkeys(newHotkeys);
      updateElectronHotkeys(newHotkeys);
    };

    // Слушаем изменения в localStorage
    window.addEventListener('storage', handleStorageChange);
    
    // Также слушаем кастомное событие для изменений в том же окне
    const handleHotkeyChange = () => {
      const newHotkeys = hotkeyStorage.getHotkeys();
      setCurrentHotkeys(newHotkeys);
      updateElectronHotkeys(newHotkeys);
    };
    
    window.addEventListener('hotkeySettingsChanged', handleHotkeyChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('hotkeySettingsChanged', handleHotkeyChange);
    };
  }, [updateElectronHotkeys]);

  // Возвращаем функцию для проверки, запущено ли приложение в Electron
  const isElectron = () => {
    return window.electronAPI && window.electronAPI.isElectron;
  };

  return { isElectron };
};



