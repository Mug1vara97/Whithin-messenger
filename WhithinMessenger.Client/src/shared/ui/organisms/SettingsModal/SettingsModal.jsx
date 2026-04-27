import React, { useState, useEffect } from 'react';
import hotkeyStorage from '../../../lib/utils/hotkeyStorage';
import './SettingsModal.css';

const SettingsModal = ({ isOpen, onClose }) => {
  const [noiseSuppression, setNoiseSuppression] = useState(() => {
    const saved = localStorage.getItem('noiseSuppression');
    return saved ? JSON.parse(saved) : false;
  });
  
  const [hotkeys, setHotkeys] = useState(() => hotkeyStorage.getHotkeys());
  const [editingHotkey, setEditingHotkey] = useState(null);
  const [tempKey, setTempKey] = useState('');
  const [soundNotificationsEnabled, setSoundNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem('soundNotificationsEnabled');
    return saved == null ? true : JSON.parse(saved);
  });
  const [overlayPid, setOverlayPid] = useState('');
  const [overlayStatus, setOverlayStatus] = useState(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    localStorage.setItem('noiseSuppression', JSON.stringify(noiseSuppression));
    
    window.dispatchEvent(new CustomEvent('noiseSuppressionChanged', {
      detail: { enabled: noiseSuppression }
    }));
  }, [noiseSuppression]);

  useEffect(() => {
    localStorage.setItem('soundNotificationsEnabled', JSON.stringify(soundNotificationsEnabled));
    window.dispatchEvent(
      new CustomEvent('notificationSettingsChanged', {
        detail: { soundNotificationsEnabled },
      })
    );
  }, [soundNotificationsEnabled]);

  useEffect(() => {
    if (!isOpen || !window.electronAPI?.overlayStatus) return;
    window.electronAPI.overlayStatus().then(setOverlayStatus).catch(() => {});
  }, [isOpen]);

  const handleNoiseSuppressionToggle = () => {
    setNoiseSuppression(!noiseSuppression);
  };

  const handleSoundNotificationsToggle = () => {
    setSoundNotificationsEnabled((prev) => !prev);
  };

  const handleHotkeyEdit = (action) => {
    setEditingHotkey(action);
    setTempKey(hotkeys[action] || '');
  };

  const handleHotkeyCancel = () => {
    setEditingHotkey(null);
    setTempKey('');
  };

  const handleHotkeySave = (action) => {
    if (tempKey) {
      const usedBy = hotkeyStorage.isKeyUsed(tempKey, action);
      if (usedBy) {
        alert(`Клавиша "${tempKey}" уже используется для: ${getActionName(usedBy)}`);
        return;
      }
    }

    const newHotkeys = { ...hotkeys, [action]: tempKey };
    setHotkeys(newHotkeys);
    hotkeyStorage.saveHotkeys(newHotkeys);
    setEditingHotkey(null);
    setTempKey('');
    
    window.dispatchEvent(new CustomEvent('hotkeySettingsChanged'));
  };

  const handleHotkeyKeyDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      return;
    }
    
    const keyString = hotkeyStorage.parseKeyEvent(e);
    setTempKey(keyString);
  };

  const handleHotkeyMouseDown = (e) => {
    if (e.button === 3 || e.button === 4 || e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      
      const mouseString = hotkeyStorage.parseMouseEvent(e);
      setTempKey(mouseString);
    }
  };

  const handleHotkeyMouseUp = (e) => {
    if (e.button === 3 || e.button === 4) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleHotkeyReset = () => {
    if (window.confirm('Сбросить все горячие клавиши к значениям по умолчанию?')) {
      hotkeyStorage.resetToDefaults();
      setHotkeys(hotkeyStorage.getHotkeys());
      
      window.dispatchEvent(new CustomEvent('hotkeySettingsChanged'));
    }
  };

  const handleOverlayAttach = async () => {
    if (!window.electronAPI?.overlayAttach) return;
    const pid = Number(overlayPid);
    if (!pid) return;
    const status = await window.electronAPI.overlayAttach(pid);
    setOverlayStatus(status);
  };

  const handleOverlayDetach = async () => {
    if (!window.electronAPI?.overlayDetach) return;
    await window.electronAPI.overlayDetach();
    const status = await window.electronAPI.overlayStatus();
    setOverlayStatus(status);
  };

  const getActionName = (action) => {
    const actionNames = {
      toggleMic: 'Переключить микрофон',
      toggleAudio: 'Переключить наушники',
      toggleOverlay: 'Переключить overlay'
    };
    return actionNames[action] || action;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Настройки</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="settings-content">
          <div className="setting-section">
            <h3>Аудио</h3>
            <div className="setting-item">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={noiseSuppression}
                  onChange={handleNoiseSuppressionToggle}
                />
                <span className="setting-text">Подавление шума</span>
              </label>
              <p className="setting-description">
                Автоматически удаляет фоновый шум из вашего микрофона
              </p>
            </div>
          </div>

          <div className="setting-section">
            <h3>Интерфейс</h3>
            <div className="setting-item">
              <label className="setting-label">
                <span className="setting-text">Тема</span>
                <select className="setting-select">
                  <option value="dark">Темная</option>
                  <option value="light">Светлая</option>
                </select>
              </label>
            </div>
          </div>

          <div className="setting-section">
            <h3>Уведомления</h3>
            <div className="setting-item">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={soundNotificationsEnabled}
                  onChange={handleSoundNotificationsToggle}
                />
                <span className="setting-text">Звуковые уведомления</span>
              </label>
            </div>
            <div className="setting-item">
              <label className="setting-label">
                <input type="checkbox" defaultChecked />
                <span className="setting-text">Уведомления в браузере</span>
              </label>
            </div>
          </div>

          <div className="setting-section">
            <h3>Горячие клавиши</h3>
            
            <div className="setting-item">
              <div className="setting-item-info">
                <span className="setting-text">🎤 Переключить микрофон</span>
                <p className="setting-description">
                  Горячая клавиша для включения/выключения микрофона
                </p>
              </div>
              {editingHotkey === 'toggleMic' ? (
                <div className="hotkey-edit-container">
                  <input
                    type="text"
                    className="hotkey-input"
                    value={hotkeyStorage.formatKey(tempKey)}
                    onKeyDown={handleHotkeyKeyDown}
                    onMouseDown={handleHotkeyMouseDown}
                    onMouseUp={handleHotkeyMouseUp}
                    placeholder="Нажмите клавишу..."
                    autoFocus
                    readOnly
                  />
                  <button 
                    className="hotkey-save-btn"
                    onClick={() => handleHotkeySave('toggleMic')}
                  >
                    ✓
                  </button>
                  <button 
                    className="hotkey-cancel-btn"
                    onClick={handleHotkeyCancel}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="hotkey-display-container">
                  <span className="hotkey-display">
                    {hotkeyStorage.formatKey(hotkeys.toggleMic)}
                  </span>
                  <button 
                    className="hotkey-edit-btn"
                    onClick={() => handleHotkeyEdit('toggleMic')}
                  >
                    Изменить
                  </button>
                </div>
              )}
            </div>

            <div className="setting-item">
              <div className="setting-item-info">
                <span className="setting-text">🔊 Переключить наушники</span>
                <p className="setting-description">
                  Горячая клавиша для включения/выключения звука в наушниках
                </p>
              </div>
              {editingHotkey === 'toggleAudio' ? (
                <div className="hotkey-edit-container">
                  <input
                    type="text"
                    className="hotkey-input"
                    value={hotkeyStorage.formatKey(tempKey)}
                    onKeyDown={handleHotkeyKeyDown}
                    onMouseDown={handleHotkeyMouseDown}
                    onMouseUp={handleHotkeyMouseUp}
                    placeholder="Нажмите клавишу..."
                    autoFocus
                    readOnly
                  />
                  <button 
                    className="hotkey-save-btn"
                    onClick={() => handleHotkeySave('toggleAudio')}
                  >
                    ✓
                  </button>
                  <button 
                    className="hotkey-cancel-btn"
                    onClick={handleHotkeyCancel}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="hotkey-display-container">
                  <span className="hotkey-display">
                    {hotkeyStorage.formatKey(hotkeys.toggleAudio)}
                  </span>
                  <button 
                    className="hotkey-edit-btn"
                    onClick={() => handleHotkeyEdit('toggleAudio')}
                  >
                    Изменить
                  </button>
                </div>
              )}
            </div>

            <div className="setting-item">
              <div className="setting-item-info">
                <span className="setting-text">🔄 Сбросить горячие клавиши</span>
                <p className="setting-description">
                  Вернуть все горячие клавиши к значениям по умолчанию (F1, F2, F3)
                </p>
              </div>
              <button 
                className="hotkey-reset-btn"
                onClick={handleHotkeyReset}
              >
                Сбросить
              </button>
            </div>
            <div className="setting-item">
              <div className="setting-item-info">
                <span className="setting-text">🕹️ Переключить overlay</span>
                <p className="setting-description">
                  Показывать/скрывать игровой overlay с участниками звонка
                </p>
              </div>
              {editingHotkey === 'toggleOverlay' ? (
                <div className="hotkey-edit-container">
                  <input
                    type="text"
                    className="hotkey-input"
                    value={hotkeyStorage.formatKey(tempKey)}
                    onKeyDown={handleHotkeyKeyDown}
                    onMouseDown={handleHotkeyMouseDown}
                    onMouseUp={handleHotkeyMouseUp}
                    placeholder="Нажмите клавишу..."
                    autoFocus
                    readOnly
                  />
                  <button className="hotkey-save-btn" onClick={() => handleHotkeySave('toggleOverlay')}>✓</button>
                  <button className="hotkey-cancel-btn" onClick={handleHotkeyCancel}>✕</button>
                </div>
              ) : (
                <div className="hotkey-display-container">
                  <span className="hotkey-display">{hotkeyStorage.formatKey(hotkeys.toggleOverlay)}</span>
                  <button className="hotkey-edit-btn" onClick={() => handleHotkeyEdit('toggleOverlay')}>
                    Изменить
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="setting-section">
            <h3>Game Overlay</h3>
            <div className="setting-item">
              <label className="setting-label">
                <span className="setting-text">PID игры</span>
                <input
                  type="number"
                  className="hotkey-input"
                  value={overlayPid}
                  onChange={(e) => setOverlayPid(e.target.value)}
                  placeholder="Например: 12345"
                />
              </label>
            </div>
            <div className="setting-item">
              <button className="hotkey-edit-btn" onClick={handleOverlayAttach}>Attach</button>
              <button className="hotkey-cancel-btn" onClick={handleOverlayDetach}>Detach</button>
            </div>
            <div className="setting-item">
              <p className="setting-description">
                Статус: {overlayStatus?.mode || 'n/a'} / {overlayStatus?.ok ? 'ok' : 'error'}
              </p>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="save-button" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
