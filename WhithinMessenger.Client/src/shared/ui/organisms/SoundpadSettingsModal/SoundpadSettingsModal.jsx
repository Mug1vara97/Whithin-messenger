import React, { useCallback, useEffect, useState } from 'react';
import { soundpadBridge } from '../../../lib/soundpad/soundpadBridge';
import { soundpadStorage } from '../../../lib/soundpad/soundpadStorage';
import { audioDeviceStorage } from '../../../lib/soundpad/audioDeviceStorage';
import { soundpadLog, soundpadError } from '../../../lib/soundpad/soundpadLogger';
import './SoundpadSettingsModal.css';

const VB_CABLE_URL = 'https://vb-audio.com/Cable/';

const SoundpadSettingsModal = ({ isOpen, onClose }) => {
  const [availability, setAvailability] = useState({ available: false, platform: 'web' });
  const [devices, setDevices] = useState({ inputs: [], outputs: [] });
  const [browserInputs, setBrowserInputs] = useState([]);
  const [bridgeStatus, setBridgeStatus] = useState({ running: false });
  const [config, setConfig] = useState(() => audioDeviceStorage.getConfig());
  const [slots, setSlots] = useState(() => soundpadStorage.getConfig().slots);
  const [globalVolume, setGlobalVolume] = useState(() => soundpadStorage.getConfig().globalVolume);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingLabel, setPendingLabel] = useState('Новый звук');

  const refresh = useCallback(async () => {
    const nextAvailability = await soundpadBridge.getAvailability();
    setAvailability(nextAvailability);

    if (nextAvailability.available) {
      const listed = await soundpadBridge.listDevices();
      setDevices(listed);
      const status = await soundpadBridge.getStatus();
      setBridgeStatus(status);

      const { cableInput } = soundpadBridge.findCableDevices(listed);
      const current = audioDeviceStorage.getConfig();
      if (!current.renderDeviceId && cableInput) {
        const saved = audioDeviceStorage.saveConfig({ renderDeviceId: cableInput.id });
        setConfig(saved);
      }
    }

    if (navigator.mediaDevices?.enumerateDevices) {
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
        probe.getTracks().forEach((track) => track.stop());
      } catch {
        // Labels may stay empty until mic permission is granted.
      }

      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all.filter((d) => d.kind === 'audioinput');
      setBrowserInputs(inputs);

    }

    setSlots(soundpadStorage.getConfig().slots);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    document.body.style.overflow = 'hidden';
    refresh().catch((err) => {
      soundpadError('SoundpadSettingsModal: refresh failed', err);
      setError(err.message || String(err));
    });
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, refresh]);

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) onClose();
  };

  const saveDeviceConfig = (patch) => {
    const saved = audioDeviceStorage.saveConfig(patch);
    setConfig(saved);
    soundpadBridge.syncAudioConfigToElectron().catch((err) => {
      soundpadError('SoundpadSettingsModal: syncAudioConfig failed', err);
    });
  };

  const handleStartBridge = async () => {
    setBusy(true);
    setError('');
    try {
      const status = await soundpadBridge.startBridge();
      soundpadLog('SoundpadSettingsModal: bridge started', status);
      setBridgeStatus(status);
    } catch (err) {
      soundpadError('SoundpadSettingsModal: startBridge failed', err);
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleStopBridge = async () => {
    setBusy(true);
    setError('');
    try {
      await soundpadBridge.stopBridge();
      setBridgeStatus({ running: false });
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleUploadSound = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    setError('');
    try {
      const soundId = await soundpadStorage.saveSoundFile(file);
      soundpadLog('SoundpadSettingsModal: sound uploaded', { soundId, name: file.name, size: file.size, type: file.type });
      soundpadStorage.addSlot({
        label: pendingLabel || file.name,
        soundId,
        volume: 1,
      });
      setSlots(soundpadStorage.getConfig().slots);
      setPendingLabel('Новый звук');
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveSlot = async (slotId) => {
    const removed = soundpadStorage.removeSlot(slotId);
    if (removed?.soundId) {
      await soundpadStorage.deleteSound(removed.soundId);
    }
    setSlots(soundpadStorage.getConfig().slots);
  };

  const handlePlaySlot = async (slotId) => {
    setError('');
    try {
      const result = await soundpadBridge.playSlot(slotId);
      soundpadLog('SoundpadSettingsModal: play result', result);
    } catch (err) {
      soundpadError('SoundpadSettingsModal: play failed', err);
      setError(err.message || String(err));
    }
  };

  const handleGlobalVolume = (value) => {
    const parsed = Number(value);
    const next = Number.isFinite(parsed) ? parsed : 1;
    setGlobalVolume(next);
    soundpadStorage.saveConfig({ globalVolume: next });
  };

  if (!isOpen) return null;

  const { cableInput } = soundpadBridge.findCableDevices(devices);
  const cableOutput = browserInputs.find((d) => /cable output/i.test(d.label || ''));

  return (
    <div className="soundpad-modal-overlay" onClick={handleOverlayClick} role="presentation">
      <div className="soundpad-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="soundpad-modal__header">
          <h2>Саундпад (VB-Cable)</h2>
          <button type="button" className="soundpad-modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>

        <div className="soundpad-modal__content">
          <section className="soundpad-section">
            <h3>1. Режим саундпада</h3>
            <div className="soundpad-field">
              <label htmlFor="soundpad-mode">Как подмешивать звук</label>
              <select
                id="soundpad-mode"
                value={config.soundpadMode || 'inApp'}
                onChange={(e) => {
                  const soundpadMode = e.target.value;
                  saveDeviceConfig({
                    soundpadMode,
                    autoDefaultCableMic: soundpadMode === 'system',
                  });
                  if (soundpadMode === 'inApp') {
                    soundpadBridge.warmUpInAppMixer().catch(() => {});
                  } else {
                    soundpadBridge.warmUpSystemBridge().catch(() => {});
                  }
                }}
              >
                <option value="inApp">Физический микрофон (рекомендуется)</option>
                <option value="system">Везде в Windows через VB-Cable</option>
              </select>
            </div>
            <p className="soundpad-hint">
              {config.soundpadMode === 'system'
                ? 'Микрофон и саундпад идут через VB-Cable. Демонстрация экрана работает как обычно (system loopback).'
                : 'Звук миксуется с вашим обычным микрофоном в Whithin. Саундпад слышен даже при выключенном микрофоне в звонке. Для Telegram/игр выберите режим VB-Cable.'}
            </p>
          </section>

          {config.soundpadMode === 'system' && (
            <section className="soundpad-section">
              <h3>2. Установка VB-Cable</h3>
              <p className="soundpad-hint">
                Скачайте и установите{' '}
                <a href={VB_CABLE_URL} target="_blank" rel="noreferrer">
                  VB-Audio Virtual Cable
                </a>
                . Появятся <strong>CABLE Input</strong> и <strong>CABLE Output</strong>.
              </p>
            </section>
          )}

          {config.soundpadMode === 'system' && !availability.available && (
            <div className="soundpad-status soundpad-status--warn">
              Режим VB-Cable работает в десктоп-приложении Whithin (Electron) на Windows.
              {availability.platform !== 'win32' && ` Текущая платформа: ${availability.platform}.`}
            </div>
          )}

          {config.soundpadMode === 'system' && availability.available && (
            <>
              <section className="soundpad-section">
                <h3>3. Аудио-мост</h3>
                <p className="soundpad-hint">
                  Мост смешивает ваш микрофон и звуки саундпада и отправляет их на CABLE Input.
                  {!cableInput && ' CABLE Input не найден — установите VB-Cable и нажмите «Обновить».'}
                </p>

                <div className="soundpad-field">
                  <label htmlFor="capture-device">Физический микрофон (вход моста)</label>
                  <select
                    id="capture-device"
                    value={config.captureDeviceId}
                    onChange={(e) => saveDeviceConfig({ captureDeviceId: e.target.value })}
                  >
                    <option value="">По умолчанию</option>
                    {devices.inputs.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name}
                        {device.isDefault ? ' (по умолчанию)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="soundpad-field">
                  <label htmlFor="render-device">Выход моста (CABLE Input)</label>
                  <select
                    id="render-device"
                    value={config.renderDeviceId}
                    onChange={(e) => saveDeviceConfig({ renderDeviceId: e.target.value })}
                  >
                    <option value="">Авто (CABLE Input)</option>
                    {devices.outputs.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="soundpad-field">
                  <label htmlFor="virtual-mic">Микрофон для звонков Whithin (CABLE Output)</label>
                  <select
                    id="virtual-mic"
                    value={config.virtualMicDeviceId}
                    onChange={(e) => saveDeviceConfig({ virtualMicDeviceId: e.target.value })}
                  >
                    <option value="">Физический микрофон</option>
                    {browserInputs.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Микрофон ${device.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                  {!cableOutput && (
                    <p className="soundpad-hint">CABLE Output не найден в списке браузера — проверьте установку VB-Cable.</p>
                  )}
                </div>

                <label className="soundpad-checkbox">
                  <input
                    type="checkbox"
                    checked={config.autoDefaultCableMic !== false}
                    onChange={(e) => {
                      saveDeviceConfig({ autoDefaultCableMic: e.target.checked });
                    }}
                  />
                  <span>
                    Автоматически выбирать CABLE Output микрофоном Windows, пока Whithin открыт
                    (Telegram, Discord и др. будут использовать его без ручной настройки)
                  </span>
                </label>

                <div className={`soundpad-status ${bridgeStatus.running ? 'soundpad-status--ok' : 'soundpad-status--warn'}`}>
                  {bridgeStatus.running
                    ? `Мост активен: ${bridgeStatus.captureDevice || 'микрофон'} → ${bridgeStatus.renderDevice || 'CABLE Input'}`
                    : 'Мост выключен. Включите перед использованием саундпада.'}
                </div>

                <div className="soundpad-actions">
                  <button
                    type="button"
                    className="soundpad-btn soundpad-btn--primary"
                    disabled={busy || bridgeStatus.running}
                    onClick={handleStartBridge}
                  >
                    Включить мост
                  </button>
                  <button
                    type="button"
                    className="soundpad-btn soundpad-btn--secondary"
                    disabled={busy || !bridgeStatus.running}
                    onClick={handleStopBridge}
                  >
                    Выключить мост
                  </button>
                  <button type="button" className="soundpad-btn soundpad-btn--secondary" disabled={busy} onClick={refresh}>
                    Обновить устройства
                  </button>
                </div>
              </section>
            </>
          )}

          <section className="soundpad-section">
            <h3>{config.soundpadMode === 'system' ? '4' : '2'}. Библиотека звуков</h3>
                <div className="soundpad-field">
                  <label htmlFor="global-volume">Общая громкость саундпада</label>
                  <input
                    id="global-volume"
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={globalVolume}
                    onChange={(e) => handleGlobalVolume(e.target.value)}
                  />
                </div>

                <div className="soundpad-upload">
                  <input
                    type="text"
                    value={pendingLabel}
                    onChange={(e) => setPendingLabel(e.target.value)}
                    placeholder="Название кнопки"
                  />
                  <label className="soundpad-btn soundpad-btn--secondary">
                    Добавить звук
                    <input type="file" accept="audio/*" hidden onChange={handleUploadSound} />
                  </label>
                </div>

                <div className="soundpad-slots">
                  {slots.length === 0 && (
                    <p className="soundpad-hint">
                      {config.soundpadMode === 'system'
                        ? 'Добавьте mp3/wav/ogg — звук пойдёт через VB-Cable в любое приложение с микрофоном CABLE Output.'
                        : 'Добавьте mp3/wav/ogg — звук подмешивается к физическому микрофону в Whithin, даже если микрофон выключен.'}
                    </p>
                  )}
                  {slots.map((slot) => (
                    <div key={slot.id} className="soundpad-slot">
                      <input
                        type="text"
                        value={slot.label}
                        onChange={(e) => {
                          soundpadStorage.updateSlot(slot.id, { label: e.target.value });
                          setSlots(soundpadStorage.getConfig().slots);
                        }}
                      />
                      <input
                        type="number"
                        min="0"
                        max="2"
                        step="0.05"
                        value={slot.volume ?? 1}
                        onChange={(e) => {
                          soundpadStorage.updateSlot(slot.id, { volume: Number(e.target.value) });
                          setSlots(soundpadStorage.getConfig().slots);
                        }}
                        title="Громкость слота"
                      />
                      <button
                        type="button"
                        className="soundpad-btn soundpad-btn--primary"
                        onClick={() => handlePlaySlot(slot.id)}
                      >
                        ▶
                      </button>
                      <button
                        type="button"
                        className="soundpad-btn soundpad-btn--danger"
                        onClick={() => handleRemoveSlot(slot.id)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
          </section>

          {error && <div className="soundpad-status soundpad-status--warn">{error}</div>}
        </div>
      </div>
    </div>
  );
};

export default SoundpadSettingsModal;
