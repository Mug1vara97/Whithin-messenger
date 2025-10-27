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
  const [microphoneGain, setMicrophoneGain] = useState(() => {
    const saved = localStorage.getItem('microphoneGain');
    return saved ? parseFloat(saved) : 2.0;
  });

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
    localStorage.setItem('microphoneGain', microphoneGain.toString());
    
    window.dispatchEvent(new CustomEvent('microphoneGainChanged', {
      detail: { gain: microphoneGain }
    }));
  }, [microphoneGain]);

  const handleNoiseSuppressionToggle = () => {
    setNoiseSuppression(!noiseSuppression);
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
              <label className="setting-label">
                <span className="setting-text">🎤 Усиление микрофона</span>
              </label>
              <div className="volume-control">
                <input
                  type="range"
                  min="0.5"
                  max="5.0"
                  step="0.1"
                  value={microphoneGain}
                  onChange={(e) => setMicrophoneGain(parseFloat(e.target.value))}
                  className="volume-slider"
                />
                <span className="volume-value">{Math.round(microphoneGain * 100)}%</span>
              </div>
              <p className="setting-description">
                Текущее: {Math.round(microphoneGain * 100)}% | По умолчанию: 200% | Если микрофон тихий, увеличьте до 300-500%
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
                <input type="checkbox" defaultChecked />
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
