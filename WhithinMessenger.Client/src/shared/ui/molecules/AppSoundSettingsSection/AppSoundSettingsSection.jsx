import React, { useCallback, useEffect, useState } from 'react';
import {
  APP_SOUND_DEFINITIONS,
  hasCustomAppSound,
  playAppSoundPreview,
  readCustomSoundFile,
  resetAllAppCustomSounds,
  resetAppCustomSound,
  setAppCustomSound,
} from '../../../lib/utils/appSoundSettings';
import './AppSoundSettingsSection.css';

export function AppSoundSettingsSection() {
  const [, setRevision] = useState(0);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const refresh = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    const onChanged = () => refresh();
    window.addEventListener('appSoundSettingsChanged', onChanged);
    return () => window.removeEventListener('appSoundSettingsChanged', onChanged);
  }, [refresh]);

  const handleFileChange = async (soundId, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusyId(soundId);
    setError(null);
    try {
      const dataUrl = await readCustomSoundFile(file);
      setAppCustomSound(soundId, dataUrl);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить звук');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="app-sound-settings">
      {error && (
        <div className="settings-alert settings-alert--error app-sound-settings__error">{error}</div>
      )}

      {APP_SOUND_DEFINITIONS.map((sound) => {
        const isCustom = hasCustomAppSound(sound.id);
        const isBusy = busyId === sound.id;

        return (
          <div key={sound.id} className="settings-row app-sound-settings__row">
            <div className="settings-row__info">
              <span className="settings-row__title">{sound.label}</span>
              <p className="settings-row__desc">{sound.description}</p>
              <span className={`app-sound-settings__status${isCustom ? ' is-custom' : ''}`}>
                {isCustom ? 'Свой звук' : 'Стандартный'}
              </span>
            </div>
            <div className="settings-row__control app-sound-settings__actions">
              <button
                type="button"
                className="settings-btn settings-btn--ghost"
                onClick={() => playAppSoundPreview(sound.id)}
              >
                Прослушать
              </button>
              <label className="settings-btn settings-btn--ghost app-sound-settings__file-btn">
                {isBusy ? 'Загрузка…' : 'Заменить'}
                <input
                  type="file"
                  accept="audio/*"
                  disabled={isBusy}
                  onChange={(event) => handleFileChange(sound.id, event)}
                />
              </label>
              {isCustom && (
                <button
                  type="button"
                  className="settings-btn settings-btn--ghost"
                  onClick={() => resetAppCustomSound(sound.id)}
                >
                  Сбросить
                </button>
              )}
            </div>
          </div>
        );
      })}

      <div className="settings-form-actions app-sound-settings__footer">
        <button
          type="button"
          className="settings-btn settings-btn--ghost"
          onClick={() => {
            resetAllAppCustomSounds();
            setError(null);
          }}
        >
          Сбросить все звуки
        </button>
      </div>
    </div>
  );
}
