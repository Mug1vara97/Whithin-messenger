import React, { useState, useEffect } from 'react';
import './SettingsModal.css';

const SettingsModal = ({ isOpen, onClose }) => {
  const [noiseSuppression, setNoiseSuppression] = useState(() => {
    const saved = localStorage.getItem('noiseSuppression');
    return saved ? JSON.parse(saved) : false;
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

  const handleNoiseSuppressionToggle = () => {
    setNoiseSuppression(!noiseSuppression);
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
        </div>

        <div className="modal-actions">
          <button className="save-button" onClick={onClose}>
            Сохранить
          </button>
          <button className="cancel-button" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
