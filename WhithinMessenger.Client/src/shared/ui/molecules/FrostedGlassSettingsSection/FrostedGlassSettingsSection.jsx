import React, { useCallback, useEffect, useState } from 'react';
import {
  clearBackgroundImage,
  FROSTED_GLASS_OVERLAY_TINT,
  FROSTED_GLASS_OVERLAY_TINT_OPTIONS,
  getAppBackgroundSettings,
  hasCustomBackgroundImage,
  pickBackgroundImageFromSystem,
  setAppBackgroundSettings,
  setBackgroundImageFromFile,
  subscribeAppBackgroundSettings,
} from '../../../lib/theme/appBackgroundSettings';

const isElectron = Boolean(typeof window !== 'undefined' && window.electronAPI?.isElectron);

export function FrostedGlassSettingsSection() {
  const [settings, setSettings] = useState(() => getAppBackgroundSettings());
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeAppBackgroundSettings(setSettings), []);

  const updateSettings = useCallback((partial) => {
    setError(null);
    setSettings(setAppBackgroundSettings(partial));
  }, []);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      await setBackgroundImageFromFile(file);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить изображение');
    } finally {
      setBusy(false);
    }
  };

  const handleElectronPick = async () => {
    setBusy(true);
    setError(null);
    try {
      await pickBackgroundImageFromSystem();
    } catch (err) {
      setError(err?.message || 'Не удалось выбрать изображение');
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    setError(null);
    try {
      await clearBackgroundImage();
    } catch (err) {
      setError(err?.message || 'Не удалось удалить фон');
    } finally {
      setBusy(false);
    }
  };

  const hasImage = hasCustomBackgroundImage();
  const overlayTintOption = FROSTED_GLASS_OVERLAY_TINT_OPTIONS.find(
    (option) => option.id === settings.overlayTint,
  ) || FROSTED_GLASS_OVERLAY_TINT_OPTIONS[0];

  return (
    <div className="frosted-glass-settings">
      {error && (
        <div className="settings-alert settings-alert--error">{error}</div>
      )}

      <div className="settings-row">
        <div className="settings-row__info">
          <label htmlFor="frosted-glass-enabled" className="settings-row__title">
            Прозрачность интерфейса
          </label>
          <p className="settings-row__desc">
            Панели серверов, каналов и чата становятся полупрозрачными — сквозь них видно
            фоновое изображение. Текст, иконки и кнопки остаются контрастными и читаемыми.
          </p>
        </div>
        <label
          className={`settings-switch${!hasImage || busy ? ' settings-switch--disabled' : ''}`}
          htmlFor="frosted-glass-enabled"
        >
          <input
            id="frosted-glass-enabled"
            type="checkbox"
            checked={settings.enabled}
            disabled={!hasImage || busy}
            onChange={(event) => updateSettings({ enabled: event.target.checked })}
          />
          <span className="settings-switch__slider" />
        </label>
      </div>

      {hasImage && (
        <div className="settings-row">
          <div className="settings-row__info">
            <label htmlFor="frosted-glass-overlay-tint" className="settings-row__title">
              Оттенок прозрачности
            </label>
            <p className="settings-row__desc">
              {overlayTintOption.description}
            </p>
          </div>
          <select
            id="frosted-glass-overlay-tint"
            className="settings-select"
            value={settings.overlayTint}
            disabled={busy}
            onChange={(event) => updateSettings({ overlayTint: event.target.value })}
          >
            {FROSTED_GLASS_OVERLAY_TINT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="settings-row settings-row--stacked">
        <div className="settings-row__info">
          <span className="settings-row__title">Фоновое изображение</span>
          <p className="settings-row__desc">
            Достаточно выбрать картинку — параметры прозрачности подставятся автоматически.
          </p>
        </div>
        <div className="settings-row__control settings-row__control--wide">
          <div className="frosted-glass-settings__actions">
            {isElectron && (
              <button
                type="button"
                className="settings-btn settings-btn--ghost"
                disabled={busy}
                onClick={handleElectronPick}
              >
                {busy ? 'Загрузка…' : 'Выбрать файл…'}
              </button>
            )}
            <label className="settings-btn settings-btn--ghost frosted-glass-settings__file-btn">
              {busy ? 'Загрузка…' : isElectron ? 'Или загрузить…' : 'Загрузить…'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={busy}
                onChange={handleFileChange}
              />
            </label>
            {hasImage && (
              <button
                type="button"
                className="settings-btn settings-btn--ghost"
                disabled={busy}
                onClick={handleClear}
              >
                Удалить
              </button>
            )}
          </div>
        </div>
      </div>

      {settings.imageDataUrl && (
        <div className="settings-row settings-row--stacked">
          <div
            className="frosted-glass-settings__preview"
            data-frosted-overlay-tint={
              settings.overlayTint === FROSTED_GLASS_OVERLAY_TINT.DEFAULT
                ? FROSTED_GLASS_OVERLAY_TINT.DEFAULT
                : FROSTED_GLASS_OVERLAY_TINT.THEME
            }
          >
            <div
              className="frosted-glass-settings__preview-image"
              style={{ backgroundImage: `url("${settings.imageDataUrl}")` }}
            />
            <div className="frosted-glass-settings__preview-sidebar" />
            <div className="frosted-glass-settings__preview-chat" />
          </div>
        </div>
      )}

      <p className="frosted-glass-settings__hint">
        Лучше всего с тёмной темой. В Electron при первом включении перезапустите приложение.
      </p>
    </div>
  );
}

export default FrostedGlassSettingsSection;
