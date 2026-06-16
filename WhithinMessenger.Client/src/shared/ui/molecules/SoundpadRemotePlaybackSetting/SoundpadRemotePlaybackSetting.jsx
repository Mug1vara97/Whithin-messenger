import React, { useEffect, useState } from 'react';
import { soundpadStorage } from '../../../lib/soundpad/soundpadStorage';
import { useCallStore } from '../../../lib/stores/callStore';

const SoundpadRemotePlaybackSetting = ({
  checkboxClassName = 'soundpad-checkbox',
  hintClassName = 'soundpad-hint',
  labelTextClassName = '',
  showHint = true,
  variant = 'default',
}) => {
  const [remoteSoundpadEnabled, setRemoteSoundpadEnabled] = useState(
    () => soundpadStorage.getConfig().remoteSoundpadEnabled !== false
  );

  useEffect(() => {
    const onConfigChange = () => {
      setRemoteSoundpadEnabled(soundpadStorage.getConfig().remoteSoundpadEnabled !== false);
    };

    window.addEventListener('soundpadConfigChanged', onConfigChange);
    return () => window.removeEventListener('soundpadConfigChanged', onConfigChange);
  }, []);

  const handleChange = (checked) => {
    setRemoteSoundpadEnabled(checked);
    soundpadStorage.saveConfig({ remoteSoundpadEnabled: checked });
    useCallStore.getState().applyRemoteSoundpadVolumes();
  };

  const hint = showHint ? (
    <p className={hintClassName}>
      Отключает только звуки саундпада от других людей в звонке. Голос они по-прежнему слышны.
    </p>
  ) : null;

  if (variant === 'settings-row') {
    return (
      <div className="settings-row">
        <div className="settings-row__info">
          <span className="settings-row__title">Слышать саундпад других участников</span>
          {hint}
        </div>
        <label className="settings-switch">
          <input
            type="checkbox"
            checked={remoteSoundpadEnabled}
            onChange={(e) => handleChange(e.target.checked)}
          />
          <span className="settings-switch__slider" />
        </label>
      </div>
    );
  }

  return (
    <>
      {hint}
      <label className={checkboxClassName}>
        <input
          type="checkbox"
          checked={remoteSoundpadEnabled}
          onChange={(e) => handleChange(e.target.checked)}
        />
        <span className={labelTextClassName || undefined}>Слышать саундпад других участников</span>
      </label>
    </>
  );
};

export default SoundpadRemotePlaybackSetting;
