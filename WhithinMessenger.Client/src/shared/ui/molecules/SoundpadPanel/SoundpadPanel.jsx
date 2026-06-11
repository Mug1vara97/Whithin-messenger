import React, { useEffect, useState } from 'react';
import { soundpadStorage } from '../../../lib/soundpad/soundpadStorage';
import { soundpadBridge } from '../../../lib/soundpad/soundpadBridge';
import hotkeyStorage from '../../../lib/utils/hotkeyStorage';
import { soundpadLog, soundpadError } from '../../../lib/soundpad/soundpadLogger';
import './SoundpadPanel.css';

const SoundpadPanel = () => {
  const [slots, setSlots] = useState(() => soundpadStorage.getConfig().slots);
  const [bridgeRunning, setBridgeRunning] = useState(false);
  const [visible, setVisible] = useState(() => soundpadStorage.getConfig().showPanel !== false);
  const [monitorEnabled, setMonitorEnabled] = useState(
    () => soundpadStorage.getConfig().monitorEnabled !== false
  );
  const [monitorVolume, setMonitorVolume] = useState(
    () => soundpadStorage.getConfig().monitorVolume ?? 1
  );

  useEffect(() => {
    const onConfigChange = () => {
      const config = soundpadStorage.getConfig();
      setSlots(config.slots);
      setVisible(config.showPanel !== false);
      setMonitorEnabled(config.monitorEnabled !== false);
      setMonitorVolume(config.monitorVolume ?? 1);
    };

    window.addEventListener('soundpadConfigChanged', onConfigChange);
    return () => window.removeEventListener('soundpadConfigChanged', onConfigChange);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const refreshStatus = async () => {
      if (!soundpadBridge.isElectronAvailable()) {
        if (!cancelled) setBridgeRunning(false);
        return;
      }
      try {
        const status = await soundpadBridge.getStatus();
        if (!cancelled) {
          const running = Boolean(status?.running);
          soundpadLog('SoundpadPanel: bridge running =', running, status);
          setBridgeRunning(running);
        }
      } catch (err) {
        soundpadError('SoundpadPanel: getStatus failed', err);
        if (!cancelled) setBridgeRunning(false);
      }
    };

    refreshStatus();
    const timer = window.setInterval(refreshStatus, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!soundpadBridge.isElectronAvailable() || !visible || slots.length === 0) {
    return null;
  }

  const inAppMode = soundpadBridge.usesInAppSoundpad();
  if (!inAppMode && !bridgeRunning) {
    return null;
  }

  return (
    <aside className="soundpad-panel" aria-label="Саундпад">
      <div className="soundpad-panel__header">
        <p className="soundpad-panel__title">Саундпад</p>
        <div className="soundpad-panel__monitor">
          <button
            type="button"
            className={`soundpad-panel__monitor-btn${monitorEnabled ? ' soundpad-panel__monitor-btn--on' : ''}`}
            title={monitorEnabled ? 'Прослушивание вкл.' : 'Прослушивание выкл.'}
            aria-pressed={monitorEnabled}
            onClick={() => soundpadBridge.setMonitorEnabled(!monitorEnabled)}
          >
            🎧
          </button>
          <input
            type="range"
            className="soundpad-panel__monitor-slider"
            min="0"
            max="2"
            step="0.05"
            value={monitorVolume}
            disabled={!monitorEnabled}
            title="Громкость прослушивания"
            aria-label="Громкость прослушивания"
            onChange={(e) => soundpadBridge.setMonitorVolume(Number(e.target.value))}
          />
        </div>
      </div>
      <div className="soundpad-panel__grid">
        {slots.map((slot) => {
          const hotkeyLabel = slot.hotkey ? hotkeyStorage.formatKey(slot.hotkey) : '';
          return (
            <button
              key={slot.id}
              type="button"
              className="soundpad-panel__btn"
              title={hotkeyLabel ? `${slot.label} (${hotkeyLabel})` : slot.label}
              onClick={() =>
                soundpadBridge.playSlot(slot.id).catch((err) => {
                  soundpadError('SoundpadPanel: play failed', slot.id, err);
                })
              }
            >
              <span className="soundpad-panel__btn-label">{slot.label}</span>
              {hotkeyLabel ? <span className="soundpad-panel__btn-hotkey">{hotkeyLabel}</span> : null}
            </button>
          );
        })}
      </div>
    </aside>
  );
};

export default SoundpadPanel;
