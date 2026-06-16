import React, { useState, useEffect, useMemo } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import HeadsetIcon from '@mui/icons-material/Headset';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import TuneIcon from '@mui/icons-material/Tune';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import KeyboardOutlinedIcon from '@mui/icons-material/KeyboardOutlined';
import { Mic, Headset, GraphicEq, RestartAlt, Check } from '@mui/icons-material';
import hotkeyStorage from '../../../lib/utils/hotkeyStorage';
import { soundpadBridge } from '../../../lib/soundpad/soundpadBridge';
import { useAuthContext } from '../../../lib/contexts/AuthContext';
import { userApi } from '../../../../entities/user/api/userApi';
import { SoundpadConfigSection } from '../SoundpadConfigSection';
import { SoundpadRemotePlaybackSetting } from '../../molecules/SoundpadRemotePlaybackSetting';
import { ParticipantVolumeSettings } from '../../molecules/ParticipantVolumeSettings';
import { ProfileCustomizeSection } from '../../molecules/ProfileCustomizeSection';
import {
  getThemePresetId,
  persistThemePreset,
  THEME_PRESET_LIST,
} from '../../../lib/theme/appTheme';
import {
  getInAppNotificationsEnabled,
  setInAppNotificationsEnabled,
  getNotificationPosition,
  setNotificationPosition,
  getSoundNotificationsEnabled,
  setSoundNotificationsEnabled,
  getNotificationSoundVolume,
  setNotificationSoundVolume,
  NOTIFICATION_POSITION_OPTIONS,
} from '../../../lib/utils/inAppNotificationSettings';
import { syncDesktopNotificationSettings, dismissAllDesktopNotifications } from '../../../lib/utils/desktopNotificationBridge';
import {
  getActiveCallOverlayEnabled,
  setActiveCallOverlayEnabled,
  getActiveCallOverlayCoords,
  setActiveCallOverlayCoords,
} from '../../../lib/utils/activeCallOverlaySettings';
import { syncDesktopActiveCallOverlaySettings } from '../../../lib/utils/desktopActiveCallOverlayBridge';
import { AppSoundSettingsSection } from '../../molecules/AppSoundSettingsSection/AppSoundSettingsSection';
import { ActiveCallOverlayPositionPicker } from '../../molecules/ActiveCallOverlayPositionPicker/ActiveCallOverlayPositionPicker';
import './SettingsModal.css';

const BASE_TABS = [
  { id: 'account', label: 'Аккаунт', icon: PersonOutlineIcon },
  { id: 'appearance', label: 'Оформление', icon: PaletteOutlinedIcon },
  { id: 'audio', label: 'Аудио', icon: HeadsetIcon },
  { id: 'soundpad', label: 'Саундпад', icon: GraphicEqIcon, electronOnly: true },
  { id: 'interface', label: 'Интерфейс', icon: TuneIcon },
  { id: 'notifications', label: 'Уведомления', icon: NotificationsOutlinedIcon },
  { id: 'hotkeys', label: 'Горячие клавиши', icon: KeyboardOutlinedIcon },
];

const SettingsPanel = ({ title, description, children }) => (
  <section className="settings-panel">
    {title && <h3 className="settings-panel__title">{title}</h3>}
    {description && <p className="settings-panel__desc">{description}</p>}
    <div className="settings-panel__card">{children}</div>
  </section>
);

const SettingsRow = ({ title, description, children, icon }) => (
  <div className="settings-row">
    <div className="settings-row__info">
      {title && (
        <span className={`settings-row__title${icon ? ' settings-row__title--with-icon' : ''}`}>
          {icon}
          {title}
        </span>
      )}
      {description && <p className="settings-row__desc">{description}</p>}
    </div>
    {children && <div className="settings-row__control">{children}</div>}
  </div>
);

const SettingsToggle = ({ id, checked, onChange, label, description, disabled = false }) => (
  <div className="settings-row">
    <div className="settings-row__info">
      <label htmlFor={id} className="settings-row__title">
        {label}
      </label>
      {description && <p className="settings-row__desc">{description}</p>}
    </div>
    <label className={`settings-switch${disabled ? ' settings-switch--disabled' : ''}`} htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      <span className="settings-switch__slider" />
    </label>
  </div>
);

const SettingsModal = ({ isOpen, onClose, initialTab = 'account', onProfileUpdated }) => {
  const { user } = useAuthContext();
  const userId = user?.id || user?.Id;
  const username = user?.username || user?.Username || user?.userName || 'Пользователь';
  const userEmail = user?.email || user?.Email;

  const [noiseSuppression, setNoiseSuppression] = useState(() => {
    const saved = localStorage.getItem('noiseSuppression');
    return saved ? JSON.parse(saved) : false;
  });

  const [hotkeys, setHotkeys] = useState(() => hotkeyStorage.getHotkeys());
  const [editingHotkey, setEditingHotkey] = useState(null);
  const [tempKey, setTempKey] = useState('');
  const [soundNotificationsEnabled, setSoundNotificationsEnabledState] = useState(() => getSoundNotificationsEnabled());
  const [notificationSoundVolume, setNotificationSoundVolumeState] = useState(() => getNotificationSoundVolume());
  const [inAppNotificationsEnabled, setInAppNotificationsEnabledState] = useState(() => getInAppNotificationsEnabled());
  const [notificationPosition, setNotificationPositionState] = useState(() => getNotificationPosition());
  const [activeCallOverlayEnabled, setActiveCallOverlayEnabledState] = useState(() => getActiveCallOverlayEnabled());
  const [activeCallOverlayCoords, setActiveCallOverlayCoordsState] = useState(() => getActiveCallOverlayCoords());

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
  const [themePresetId, setThemePresetId] = useState(() => getThemePresetId());

  const isElectron = soundpadBridge.isElectronAvailable();
  const tabs = useMemo(
    () => BASE_TABS.filter((tab) => !tab.electronOnly || isElectron),
    [isElectron]
  );

  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) || tabs[0];

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
    if (!isOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    localStorage.setItem('noiseSuppression', JSON.stringify(noiseSuppression));
    window.dispatchEvent(
      new CustomEvent('noiseSuppressionChanged', {
        detail: { enabled: noiseSuppression },
      })
    );
  }, [noiseSuppression]);

  useEffect(() => {
    setSoundNotificationsEnabled(soundNotificationsEnabled);
  }, [soundNotificationsEnabled]);

  useEffect(() => {
    setNotificationSoundVolume(notificationSoundVolume);
  }, [notificationSoundVolume]);

  useEffect(() => {
    setInAppNotificationsEnabled(inAppNotificationsEnabled);
    if (!inAppNotificationsEnabled) {
      dismissAllDesktopNotifications();
    }
  }, [inAppNotificationsEnabled]);

  useEffect(() => {
    setNotificationPosition(notificationPosition);
    syncDesktopNotificationSettings();
  }, [notificationPosition]);

  useEffect(() => {
    setActiveCallOverlayEnabled(activeCallOverlayEnabled);
  }, [activeCallOverlayEnabled]);

  useEffect(() => {
    setActiveCallOverlayCoords(activeCallOverlayCoords);
    syncDesktopActiveCallOverlaySettings();
  }, [activeCallOverlayCoords]);

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
        response?.confirmationEmail || response?.ConfirmationEmail || userEmail;
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
      toggleSoundpadPanel: 'Панель саундпада',
    };
    return actionNames[action] || action;
  };

  const renderHotkeyRow = (action, icon, title, description) => (
    <SettingsRow key={action} title={title} description={description} icon={icon}>
      {editingHotkey === action ? (
        <>
          <input
            type="text"
            className="settings-hotkey-input"
            value={hotkeyStorage.formatKey(tempKey)}
            onKeyDown={handleHotkeyKeyDown}
            onMouseDown={handleHotkeyMouseDown}
            onMouseUp={handleHotkeyMouseUp}
            placeholder="Нажмите клавишу..."
            autoFocus
            readOnly
          />
          <button
            className="settings-icon-btn settings-icon-btn--save"
            type="button"
            onClick={() => handleHotkeySave(action)}
            aria-label="Сохранить"
          >
            <Check fontSize="small" />
          </button>
          <button
            className="settings-icon-btn settings-icon-btn--cancel"
            type="button"
            onClick={handleHotkeyCancel}
            aria-label="Отмена"
          >
            <CloseIcon fontSize="small" />
          </button>
        </>
      ) : (
        <>
          <span className="settings-hotkey">{hotkeyStorage.formatKey(hotkeys[action])}</span>
          <button
            className="settings-btn settings-btn--ghost"
            type="button"
            onClick={() => handleHotkeyEdit(action)}
          >
            Изменить
          </button>
        </>
      )}
    </SettingsRow>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'account':
        return (
          <>
            <SettingsPanel title="Email">
              <SettingsRow title="Текущий email">
                <span className="settings-row__value">{userEmail || '—'}</span>
              </SettingsRow>
            </SettingsPanel>

            <SettingsPanel
              title="Смена email"
              description="На новый адрес придёт письмо с подтверждением."
            >
              <form onSubmit={handleChangeEmail}>
                {emailError && <div className="settings-alert settings-alert--error">{emailError}</div>}
                {emailMessage && (
                  <div className="settings-alert settings-alert--success">{emailMessage}</div>
                )}
                <div className="settings-field">
                  <label htmlFor="settings-new-email">Новый email</label>
                  <input
                    id="settings-new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="new@example.com"
                    autoComplete="email"
                  />
                </div>
                <div className="settings-field">
                  <label htmlFor="settings-email-password">Текущий пароль</label>
                  <input
                    id="settings-email-password"
                    type="password"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    placeholder="Подтвердите паролем"
                    autoComplete="current-password"
                  />
                </div>
                <div className="settings-form-actions">
                  <button type="submit" className="settings-btn settings-btn--primary" disabled={isChangingEmail}>
                    {isChangingEmail ? 'Отправка…' : 'Сменить email'}
                  </button>
                </div>
              </form>
            </SettingsPanel>

            <SettingsPanel
              title="Смена пароля"
              description="После смены пароля потребуется подтверждение по email."
            >
              <form onSubmit={handleChangePassword}>
                {passwordError && (
                  <div className="settings-alert settings-alert--error">{passwordError}</div>
                )}
                {passwordMessage && (
                  <div className="settings-alert settings-alert--success">{passwordMessage}</div>
                )}
                <div className="settings-field">
                  <label htmlFor="settings-current-password">Текущий пароль</label>
                  <input
                    id="settings-current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <div className="settings-field">
                  <label htmlFor="settings-new-password">Новый пароль</label>
                  <input
                    id="settings-new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="settings-field">
                  <label htmlFor="settings-confirm-password">Повторите новый пароль</label>
                  <input
                    id="settings-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="settings-form-actions">
                  <button
                    type="submit"
                    className="settings-btn settings-btn--primary"
                    disabled={isChangingPassword}
                  >
                    {isChangingPassword ? 'Отправка…' : 'Сменить пароль'}
                  </button>
                </div>
              </form>
            </SettingsPanel>
          </>
        );

      case 'appearance':
        return (
          <ProfileCustomizeSection
            userId={userId}
            username={username}
            active={isOpen && activeTab === 'appearance'}
            onProfileUpdated={onProfileUpdated}
          />
        );

      case 'audio':
        return (
          <>
            <SettingsPanel title="Микрофон">
              <SettingsToggle
                id="settings-noise-suppression"
                checked={noiseSuppression}
                onChange={() => setNoiseSuppression((prev) => !prev)}
                label="Подавление шума"
                description="Убирает фоновый шум с микрофона во время звонков."
              />
            </SettingsPanel>

            <SettingsPanel title="Звонки">
              <SoundpadRemotePlaybackSetting variant="settings-row" />
            </SettingsPanel>

            <SettingsPanel
              title="Громкость участников"
              description="Сохранённые уровни применяются при следующем звонке с участником."
            >
              <div className="settings-embedded-block">
                <ParticipantVolumeSettings />
              </div>
            </SettingsPanel>

            <SettingsPanel title="Звуковые эффекты">
              <AppSoundSettingsSection />
            </SettingsPanel>
          </>
        );

      case 'soundpad':
        return <SoundpadConfigSection active={isOpen && activeTab === 'soundpad'} />;

      case 'interface':
        return (
          <>
            <SettingsPanel
              title="Тема"
              description="Внешний вид интерфейса приложения."
            >
              <SettingsRow title="Тема оформления">
                <select
                  className="settings-select"
                  value={themePresetId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setThemePresetId(nextId);
                    persistThemePreset(nextId);
                  }}
                >
                  {THEME_PRESET_LIST.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </SettingsRow>
              {THEME_PRESET_LIST.find((preset) => preset.id === themePresetId)?.description && (
                <div className="settings-row">
                  <p className="settings-row__desc" style={{ margin: 0 }}>
                    {THEME_PRESET_LIST.find((preset) => preset.id === themePresetId).description}
                  </p>
                </div>
              )}
            </SettingsPanel>

            {isElectron && (
              <SettingsPanel
                title="Оверлей звонка"
                description="Компактная панель участников, когда приложение свёрнуто или в фоне."
              >
                <SettingsToggle
                  id="settings-active-call-overlay"
                  checked={activeCallOverlayEnabled}
                  onChange={() => setActiveCallOverlayEnabledState((prev) => !prev)}
                  label="Панель участников звонка"
                  description="Аватар, ник, индикаторы микрофона и наушников."
                />
                <div className="settings-row settings-row--stacked">
                  <div className="settings-row__info">
                    <span className="settings-row__title">Позиция на экране</span>
                    <p className="settings-row__desc">
                      Выберите место — нажмите или перетащите маркер по схеме.
                    </p>
                  </div>
                  <div className="settings-row__control settings-row__control--wide">
                    <ActiveCallOverlayPositionPicker
                      coords={activeCallOverlayCoords}
                      onChange={setActiveCallOverlayCoordsState}
                      disabled={!activeCallOverlayEnabled}
                    />
                  </div>
                </div>
              </SettingsPanel>
            )}
          </>
        );

      case 'notifications':
        return (
          <SettingsPanel title="Уведомления">
            <SettingsToggle
              id="settings-in-app-notifications"
              checked={inAppNotificationsEnabled}
              onChange={() => setInAppNotificationsEnabledState((prev) => !prev)}
              label="Уведомления в приложении"
              description="Всплывающие карточки о новых сообщениях. В десктопе — отдельные окна поверх рабочего стола."
            />
            <SettingsRow
              title="Позиция уведомлений"
              description="Где на экране показывать всплывающие уведомления."
            >
              <select
                className="settings-select"
                value={notificationPosition}
                onChange={(e) => setNotificationPositionState(e.target.value)}
                disabled={!inAppNotificationsEnabled}
              >
                {NOTIFICATION_POSITION_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </SettingsRow>
            <SettingsToggle
              id="settings-sound-notifications"
              checked={soundNotificationsEnabled}
              onChange={() => setSoundNotificationsEnabledState((prev) => !prev)}
              label="Звук уведомлений"
              description="Звуковой сигнал при новых сообщениях."
              disabled={!inAppNotificationsEnabled}
            />
            <SettingsRow
              title="Громкость уведомлений"
              description="Насколько громко воспроизводить звук нового сообщения."
            >
              <div className="settings-volume-control">
                <input
                  id="settings-notification-sound-volume"
                  className="settings-volume-control__range"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={notificationSoundVolume}
                  disabled={!inAppNotificationsEnabled || !soundNotificationsEnabled}
                  onChange={(e) => setNotificationSoundVolumeState(Number(e.target.value))}
                />
                <span className="settings-volume-control__value">{notificationSoundVolume}%</span>
              </div>
            </SettingsRow>
          </SettingsPanel>
        );

      case 'hotkeys':
        return (
          <SettingsPanel
            title="Горячие клавиши"
            description={
              isElectron
                ? 'В десктоп-приложении сочетания работают глобально, даже когда окно в фоне. Назначенные клавиши (F1 и др.) продолжают работать в играх и других программах.'
                : undefined
            }
          >
              {renderHotkeyRow(
                'toggleMic',
                <Mic className="settings-row__title-icon" fontSize="small" />,
                'Переключить микрофон',
                'Включение и выключение микрофона'
              )}
              {renderHotkeyRow(
                'toggleAudio',
                <Headset className="settings-row__title-icon" fontSize="small" />,
                'Переключить наушники',
                'Включение и выключение звука в наушниках'
              )}
              {isElectron &&
                renderHotkeyRow(
                  'toggleSoundpadPanel',
                  <GraphicEq className="settings-row__title-icon" fontSize="small" />,
                  'Панель саундпада',
                  'Открыть или закрыть окно с кнопками звуков'
                )}
              <SettingsRow
                title="Сбросить горячие клавиши"
                description={
                  isElectron ? 'Вернуть F1, F2 и F3 по умолчанию' : 'Вернуть F1 и F2 по умолчанию'
                }
                icon={<RestartAlt className="settings-row__title-icon" fontSize="small" />}
              >
                <button className="settings-btn settings-btn--danger" type="button" onClick={handleHotkeyReset}>
                  Сбросить
                </button>
              </SettingsRow>
          </SettingsPanel>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-modal" role="dialog" aria-modal="true" aria-label="Настройки">
      <button type="button" className="settings-modal__backdrop" onClick={onClose} aria-label="Закрыть" />
      <div className="settings-modal__shell" onClick={(e) => e.stopPropagation()}>
        <aside className="settings-modal__sidebar">
          <div className="settings-modal__sidebar-head">
            <h2>Настройки</h2>
          </div>
          <nav className="settings-modal__nav" aria-label="Разделы настроек">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`settings-modal__tab${
                    activeTab === tab.id ? ' settings-modal__tab--active' : ''
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <TabIcon />
                  {tab.label}
                </button>
              );
            })}
          </nav>
          <div className="settings-modal__sidebar-foot">
            <div className="settings-modal__user">
              <div className="settings-modal__user-avatar">
                {username.charAt(0).toUpperCase()}
              </div>
              <div className="settings-modal__user-meta">
                <div className="settings-modal__user-name">{username}</div>
                <div className="settings-modal__user-hint">ESC — закрыть</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="settings-modal__main">
          <header className="settings-modal__page-header">
            <h1>{activeTabMeta?.label || 'Настройки'}</h1>
            <button type="button" className="settings-modal__close" onClick={onClose} aria-label="Закрыть">
              <CloseIcon fontSize="small" />
            </button>
          </header>
          <div className="settings-modal__content">{renderTabContent()}</div>
        </main>
      </div>
    </div>
  );
};

export default SettingsModal;
