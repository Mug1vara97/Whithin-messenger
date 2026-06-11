import React, { useEffect, useState } from 'react';
import { soundpadStorage } from '../../../lib/soundpad/soundpadStorage';
import { soundpadBridge } from '../../../lib/soundpad/soundpadBridge';
import hotkeyStorage from '../../../lib/utils/hotkeyStorage';
import { SOUNDPAD_PANEL_TOGGLE_EVENT } from '../../../lib/soundpad/soundpadPanelEvents';
import { soundpadLog, soundpadError } from '../../../lib/soundpad/soundpadLogger';
import './SoundpadPanel.css';

const SoundpadPanel = () => {
  const [slots, setSlots] = useState(() => soundpadStorage.getConfig().slots);
  const [bridgeRunning, setBridgeRunning] = useState(false);
  const [panelEnabled, setPanelEnabled] = useState(() => soundpadStorage.getConfig().showPanel !== false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const onConfigChange = () => {
      const config = soundpadStorage.getConfig();
      setSlots(config.slots);
      setPanelEnabled(config.showPanel !== false);
    };

    window.addEventListener('soundpadConfigChanged', onConfigChange);
    return () => window.removeEventListener('soundpadConfigChanged', onConfigChange);
  }, []);

  useEffect(() => {
    const onToggle = () => {
      if (soundpadStorage.getConfig().showPanel === false) {
        return;
      }
      setIsOpen((open) => !open);
    };

    window.addEventListener(SOUNDPAD_PANEL_TOGGLE_EVENT, onToggle);
    return () => window.removeEventListener(SOUNDPAD_PANEL_TOGGLE_EVENT, onToggle);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

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

  if (
    !isOpen ||
    !panelEnabled ||
    !soundpadBridge.isElectronAvailable() ||
    slots.length === 0
  ) {
    return null;
  }

  const inAppMode = soundpadBridge.usesInAppSoundpad();
  if (!inAppMode && !bridgeRunning) {
    return null;
  }

  const panelHotkey = hotkeyStorage.formatKey(hotkeyStorage.getHotkey('toggleSoundpadPanel'));

  return (
    <div
      className="soundpad-panel-overlay"
      onClick={() => setIsOpen(false)}
      role="presentation"
    >
      <aside
        className="soundpad-panel"
        aria-label="Саундпад"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="soundpad-panel__header">
          <p className="soundpad-panel__title">Саундпад</p>
          <button
            type="button"
            className="soundpad-panel__close"
            onClick={() => setIsOpen(false)}
            aria-label="Закрыть"
            title={panelHotkey ? `Закрыть (${panelHotkey})` : 'Закрыть'}
          >
            ×
          </button>
        </header>
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
    </div>
  );
};

export default SoundpadPanel;
