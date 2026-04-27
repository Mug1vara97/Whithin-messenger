import React, { useState, useEffect } from 'react';
import hotkeyStorage from '../../../lib/utils/hotkeyStorage';
import { useCallStore } from '../../../lib/stores/callStore';
import './SettingsModal.css';

const CALL_OUTPUT_DEVICE_KEY = 'callOutputDeviceId';
const SCREEN_SHARE_OUTPUT_DEVICE_KEY = 'screenShareOutputDeviceId';

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
  const [audioOutputs, setAudioOutputs] = useState([]);
  const [callOutputDeviceId, setCallOutputDeviceId] = useState(() => (
    localStorage.getItem(CALL_OUTPUT_DEVICE_KEY) || 'default'
  ));
  const [screenShareOutputDeviceId, setScreenShareOutputDeviceId] = useState(() => (
    localStorage.getItem(SCREEN_SHARE_OUTPUT_DEVICE_KEY) || 'default'
  ));

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
    const loadAudioOutputs = async () => {
      if (!navigator?.mediaDevices?.enumerateDevices) return;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputs = devices.filter((device) => device.kind === 'audiooutput');
        setAudioOutputs(outputs);
      } catch (error) {
        console.warn('Failed to enumerate audio output devices:', error);
      }
    };

    loadAudioOutputs();
    navigator?.mediaDevices?.addEventListener?.('devicechange', loadAudioOutputs);
    return () => {
      navigator?.mediaDevices?.removeEventListener?.('devicechange', loadAudioOutputs);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(CALL_OUTPUT_DEVICE_KEY, callOutputDeviceId);
    useCallStore.getState().applyAudioOutputSettings?.();
  }, [callOutputDeviceId]);

  useEffect(() => {
    localStorage.setItem(SCREEN_SHARE_OUTPUT_DEVICE_KEY, screenShareOutputDeviceId);
    useCallStore.getState().applyAudioOutputSettings?.();
  }, [screenShareOutputDeviceId]);

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

  const getActionName = (action) => {
    const actionNames = {
      toggleMic: 'Переключить микрофон',
      toggleAudio: 'Переключить наушники'
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

            <div className="setting-item">
              <label className="setting-label setting-select-label">
                <span className="setting-text">Выход звонка</span>
                <select
                  className="setting-select"
                  value={callOutputDeviceId}
                  onChange={(e) => setCallOutputDeviceId(e.target.value)}
                >
                  <option value="default">Системный (по умолчанию)</option>
                  {audioOutputs.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Устройство ${device.deviceId.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
              </label>
              <p className="setting-description">
                Куда выводить голоса участников звонка
              </p>
            </div>

            <div className="setting-item">
              <label className="setting-label setting-select-label">
                <span className="setting-text">Выход звука демонстрации</span>
                <select
                  className="setting-select"
                  value={screenShareOutputDeviceId}
                  onChange={(e) => setScreenShareOutputDeviceId(e.target.value)}
                >
                  <option value="default">Системный (по умолчанию)</option>
                  {audioOutputs.map((device) => (
                    <option key={`screen-${device.deviceId}`} value={device.deviceId}>
                      {device.label || `Устройство ${device.deviceId.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
              </label>
              <p className="setting-description">
                Рекомендуется выбрать наушники (мониторинг) или virtual cable
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
                  Вернуть все горячие клавиши к значениям по умолчанию (F1, F2)
                </p>
              </div>
              <button 
                className="hotkey-reset-btn"
                onClick={handleHotkeyReset}
              >
                Сбросить
              </button>
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
