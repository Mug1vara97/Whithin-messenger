import React, { useEffect, useState } from 'react';
import { soundpadBridge } from '../../../lib/soundpad/soundpadBridge';
import { soundpadStorage } from '../../../lib/soundpad/soundpadStorage';
import { SoundpadRemotePlaybackSetting } from '../../molecules/SoundpadRemotePlaybackSetting';
import { SOUNDPAD_OPEN_MANAGER_EVENT } from '../../../lib/soundpad/soundpadPanelEvents';
import '../SoundpadSettingsModal/SoundpadSettingsModal.css';

const SoundpadConfigSection = ({ active }) => {
  const [showPanel, setShowPanel] = useState(() => soundpadStorage.getConfig().showPanel !== false);
  const [monitorEnabled, setMonitorEnabled] = useState(
    () => soundpadStorage.getConfig().monitorEnabled !== false
  );
  const [monitorVolume, setMonitorVolume] = useState(
    () => soundpadStorage.getConfig().monitorVolume ?? 1
  );

  useEffect(() => {
    if (!active) return;
    soundpadBridge.warmUpInAppMixer().catch(() => {});
  }, [active]);

  useEffect(() => {
    const onConfigChange = () => {
      const soundpadConfig = soundpadStorage.getConfig();
      setShowPanel(soundpadConfig.showPanel !== false);
      setMonitorEnabled(soundpadConfig.monitorEnabled !== false);
      setMonitorVolume(soundpadConfig.monitorVolume ?? 1);
    };

    window.addEventListener('soundpadConfigChanged', onConfigChange);
    return () => window.removeEventListener('soundpadConfigChanged', onConfigChange);
  }, []);

  return (
    <div className="soundpad-config-section">
      <section className="soundpad-section">
        <h3>Саундпад</h3>
        <p className="soundpad-hint">
          Звук подмешивается в микрофон внутри Whithin. Саундпад слышен в звонке даже при выключенном микрофоне.
        </p>
      </section>

      <section className="soundpad-section">
        <h3>Звуки и горячие клавиши</h3>
        <p className="soundpad-hint">
          Загрузка звуков, громкость слотов и привязка клавиш — в отдельном окне саундпада (F3).
        </p>
        <button
          type="button"
          className="soundpad-btn soundpad-btn--primary"
          onClick={() => window.dispatchEvent(new CustomEvent(SOUNDPAD_OPEN_MANAGER_EVENT))}
        >
          Открыть управление звуками
        </button>
      </section>

      <section className="soundpad-section">
        <label className="soundpad-checkbox">
          <input
            type="checkbox"
            checked={showPanel}
            onChange={(e) => {
              const next = e.target.checked;
              setShowPanel(next);
              soundpadStorage.saveConfig({ showPanel: next });
            }}
          />
          <span>Панель саундпада по горячей клавише (F3)</span>
        </label>
      </section>

      <section className="soundpad-section">
        <h3>Прослушивание у себя</h3>
        <p className="soundpad-hint">
          Отключается только воспроизведение в ваших наушниках или колонках. В звонке громкость не меняется.
        </p>
        <div className="soundpad-field soundpad-monitor-field">
          <label className="soundpad-checkbox soundpad-monitor-toggle">
            <input
              type="checkbox"
              checked={monitorEnabled}
              onChange={(e) => {
                const next = e.target.checked;
                setMonitorEnabled(next);
                soundpadBridge.setMonitorEnabled(next);
              }}
            />
            <span>Слышать саундпад у себя</span>
          </label>
          {monitorEnabled && (
            <>
              <label htmlFor="soundpad-config-monitor-volume" className="soundpad-monitor-volume-label">
                Громкость прослушивания
              </label>
              <input
                id="soundpad-config-monitor-volume"
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={monitorVolume}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setMonitorVolume(next);
                  soundpadBridge.setMonitorVolume(next);
                }}
              />
            </>
          )}
        </div>
      </section>

      <section className="soundpad-section">
        <h3>Саундпад других участников</h3>
        <SoundpadRemotePlaybackSetting />
      </section>
    </div>
  );
};

export default SoundpadConfigSection;
