import React, { useState, useEffect, useMemo } from 'react';
import hotkeyStorage from '../../../lib/utils/hotkeyStorage';
import { soundpadBridge } from '../../../lib/soundpad/soundpadBridge';
import { useAuthContext } from '../../../lib/contexts/AuthContext';
import { userApi } from '../../../../entities/user/api/userApi';
import { SoundpadConfigSection } from '../SoundpadConfigSection';
import './SettingsModal.css';

const BASE_TABS = [
  { id: 'account', label: 'Аккаунт' },
  { id: 'audio', label: 'Аудио' },
  { id: 'soundpad', label: 'Саундпад', electronOnly: true },
  { id: 'interface', label: 'Интерфейс' },
  { id: 'notifications', label: 'Уведомления' },
  { id: 'hotkeys', label: 'Горячие клавиши' },
];

const SettingsModal = ({ isOpen, onClose, initialTab = 'account' }) => {
  const { user } = useAuthContext();
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

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);

  const isElectron = soundpadBridge.isElectronAvailable();
  const tabs = useMemo(
    () => BASE_TABS.filter((tab) => !tab.electronOnly || isElectron),
    [isElectron]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const valid = tabs.some((tab) => tab.id === initialTab);
      setActiveTab(valid ? initialTab : 'account');
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, initialTab, tabs]);

  useEffect(() => {
    localStorage.setItem('noiseSuppression', JSON.stringify(noiseSuppression));
    window.dispatchEvent(new CustomEvent('noiseSuppressionChanged', {
      detail: { enabled: noiseSuppression },
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
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
    setTempKey(hotkeyStorage.parseKeyEvent(e));
  };

  const handleHotkeyMouseDown = (e) => {
    if (e.button === 3 || e.button === 4 || e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      setTempKey(hotkeyStorage.parseMouseEvent(e));
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

  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMessage('');
    setPasswordError('');

    if (newPassword.length < 6) {
      setPasswordError('Новый пароль должен быть не короче 6 символов');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Пароли не совпадают');
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await userApi.changePassword({ currentPassword, newPassword });
      const confirmationEmail =
        response?.confirmationEmail || response?.ConfirmationEmail || user?.email || user?.Email;
      setPasswordMessage(
        response?.message ||
          `Письмо с подтверждением отправлено на ${confirmationEmail || 'ваш email'}`
      );
      resetPasswordForm();
    } catch (error) {
      setPasswordError(error.message || 'Не удалось сменить пароль');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleChangeEmail = async (e) => {
    e.preventDefault();
    setEmailMessage('');
    setEmailError('');

    if (!newEmail.trim()) {
      setEmailError('Укажите новый email');
      return;
    }

    setIsChangingEmail(true);
    try {
      const response = await userApi.changeEmail({
        newEmail: newEmail.trim(),
        currentPassword: emailPassword,
      });
      const pendingEmail = response?.pendingEmail || response?.PendingEmail || newEmail.trim();
      setEmailMessage(
        response?.message || `Письмо с подтверждением отправлено на ${pendingEmail}`
      );
      setNewEmail('');
      setEmailPassword('');
    } catch (error) {
      setEmailError(error.message || 'Не удалось сменить email');
    } finally {
      setIsChangingEmail(false);
    }
  };

  const getActionName = (action) => {
    const actionNames = {
      toggleMic: 'Переключить микрофон',
      toggleAudio: 'Переключить наушники',
    };
    return actionNames[action] || action;
  };

  const renderHotkeyRow = (action, title, description) => (
    <div className="setting-item" key={action}>
      <div className="setting-item-info">
        <span className="setting-text">{title}</span>
        <p className="setting-description">{description}</p>
      </div>
      {editingHotkey === action ? (
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
          <button className="hotkey-save-btn" type="button" onClick={() => handleHotkeySave(action)}>
            ✓
          </button>
          <button className="hotkey-cancel-btn" type="button" onClick={handleHotkeyCancel}>
            ✕
          </button>
        </div>
      ) : (
        <div className="hotkey-display-container">
          <span className="hotkey-display">{hotkeyStorage.formatKey(hotkeys[action])}</span>
          <button className="hotkey-edit-btn" type="button" onClick={() => handleHotkeyEdit(action)}>
            Изменить
          </button>
        </div>
      )}
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'account':
        return (
          <div className="setting-section">
            <h3>Аккаунт</h3>
            <div className="setting-item account-info">
              <span className="setting-text">Текущий email</span>
              <span className="account-email-value">{user?.email || user?.Email || '—'}</span>
            </div>
            <form className="account-form" onSubmit={handleChangeEmail}>
              <p className="setting-description account-form-title">Смена email</p>
              <label className="account-field">
                <span>Новый email</span>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="new@example.com"
                  autoComplete="email"
                />
              </label>
              <label className="account-field">
                <span>Текущий пароль</span>
                <input
                  type="password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  placeholder="Подтвердите паролем"
                  autoComplete="current-password"
                />
              </label>
              {emailError && <div className="account-error">{emailError}</div>}
              {emailMessage && <div className="account-success">{emailMessage}</div>}
              <button type="submit" className="account-submit-btn" disabled={isChangingEmail}>
                {isChangingEmail ? 'Отправка...' : 'Сменить email'}
              </button>
            </form>
            <form className="account-form" onSubmit={handleChangePassword}>
              <p className="setting-description account-form-title">Смена пароля</p>
              <label className="account-field">
                <span>Текущий пароль</span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <label className="account-field">
                <span>Новый пароль</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <label className="account-field">
                <span>Повторите новый пароль</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              {passwordError && <div className="account-error">{passwordError}</div>}
              {passwordMessage && <div className="account-success">{passwordMessage}</div>}
              <button type="submit" className="account-submit-btn" disabled={isChangingPassword}>
                {isChangingPassword ? 'Отправка...' : 'Сменить пароль'}
              </button>
            </form>
          </div>
        );

      case 'audio':
        return (
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
                Автоматически удаляет фоновый шум из микрофона. В режиме VB-Cable отключается —
                используется поток CABLE Output без дополнительной обработки.
              </p>
            </div>
          </div>
        );

      case 'soundpad':
        return <SoundpadConfigSection active={isOpen && activeTab === 'soundpad'} />;

      case 'interface':
        return (
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
        );

      case 'notifications':
        return (
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
        );

      case 'hotkeys':
        return (
          <div className="setting-section">
            <h3>Горячие клавиши</h3>
            {renderHotkeyRow('toggleMic', '🎤 Переключить микрофон', 'Включение/выключение микрофона')}
            {renderHotkeyRow('toggleAudio', '🔊 Переключить наушники', 'Включение/выключение звука в наушниках')}
            <div className="setting-item">
              <div className="setting-item-info">
                <span className="setting-text">🔄 Сбросить горячие клавиши</span>
                <p className="setting-description">Вернуть F1 и F2 по умолчанию</p>
              </div>
              <button className="hotkey-reset-btn" type="button" onClick={handleHotkeyReset}>
                Сбросить
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal settings-modal--tabbed" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Настройки</h2>
          <button type="button" className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="settings-layout">
          <nav className="settings-tabs" aria-label="Разделы настроек">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`settings-tab${activeTab === tab.id ? ' settings-tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="settings-content settings-content--tabbed">
            {renderTabContent()}
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="save-button" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
