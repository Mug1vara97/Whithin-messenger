import React, { useEffect, useState } from 'react';
import { soundpadStorage } from '../../../lib/soundpad/soundpadStorage';
import { useCallStore } from '../../../lib/stores/callStore';

const SoundpadRemotePlaybackSetting = ({
  checkboxClassName = 'soundpad-checkbox',
  hintClassName = 'soundpad-hint',
  labelTextClassName = '',
  showHint = true,
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

  return (
    <>
      {showHint && (
        <p className={hintClassName}>
          Отключает только звуки саундпада от других людей в звонке. Голос они по-прежнему слышны.
          Работает, если у них режим «Физический микрофон». В режиме VB-Cable саундпад смешан с голосом
          и отключить отдельно нельзя.
        </p>
      )}
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
