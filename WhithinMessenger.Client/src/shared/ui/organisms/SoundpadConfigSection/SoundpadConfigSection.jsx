import React, { useCallback, useEffect, useState } from 'react';
import { soundpadBridge } from '../../../lib/soundpad/soundpadBridge';
import { audioDeviceStorage } from '../../../lib/soundpad/audioDeviceStorage';
import { soundpadStorage } from '../../../lib/soundpad/soundpadStorage';
import { soundpadLog, soundpadError } from '../../../lib/soundpad/soundpadLogger';
import { SoundpadRemotePlaybackSetting } from '../../molecules/SoundpadRemotePlaybackSetting';
import '../SoundpadSettingsModal/SoundpadSettingsModal.css';

const VB_CABLE_URL = 'https://vb-audio.com/Cable/';

const SoundpadConfigSection = ({ active }) => {
  const [availability, setAvailability] = useState({ available: false, platform: 'web' });
  const [devices, setDevices] = useState({ inputs: [], outputs: [] });
  const [browserInputs, setBrowserInputs] = useState([]);
  const [bridgeStatus, setBridgeStatus] = useState({ running: false });
  const [config, setConfig] = useState(() => audioDeviceStorage.getConfig());
  const [showPanel, setShowPanel] = useState(() => soundpadStorage.getConfig().showPanel !== false);
  const [monitorEnabled, setMonitorEnabled] = useState(
    () => soundpadStorage.getConfig().monitorEnabled !== false
  );
  const [monitorVolume, setMonitorVolume] = useState(
    () => soundpadStorage.getConfig().monitorVolume ?? 1
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
        // labels may be empty until permission
      }
      const all = await navigator.mediaDevices.enumerateDevices();
      setBrowserInputs(all.filter((d) => d.kind === 'audioinput'));
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    refresh().catch((err) => {
      soundpadError('SoundpadConfigSection: refresh failed', err);
      setError(err.message || String(err));
    });
  }, [active, refresh]);

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

  const saveDeviceConfig = (patch) => {
    const saved = audioDeviceStorage.saveConfig(patch);
    setConfig(saved);
    soundpadBridge.syncAudioConfigToElectron().catch((err) => {
      soundpadError('SoundpadConfigSection: sync failed', err);
    });
  };

  const handleStartBridge = async () => {
    setBusy(true);
    setError('');
    try {
      const status = await soundpadBridge.startBridge();
      soundpadLog('SoundpadConfigSection: bridge started', status);
      setBridgeStatus(status);
    } catch (err) {
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

  const { cableInput } = soundpadBridge.findCableDevices(devices);
  const cableOutput = browserInputs.find((d) => /cable output/i.test(d.label || ''));

  return (
    <div className="soundpad-config-section">
      <section className="soundpad-section">
        <h3>Режим саундпада</h3>
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
            ? 'Микрофон и саундпад идут через VB-Cable. В звонке Whithin выберите CABLE Output как микрофон. Шумоподавление в этом режиме не применяется.'
            : 'Звук миксуется с микрофоном в Whithin. Саундпад слышен даже при выключенном микрофоне в звонке.'}
        </p>
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
          Звук в звонке и через VB-Cable не меняется — отключается только воспроизведение в ваших наушниках или колонках.
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

      {config.soundpadMode === 'system' && (
        <section className="soundpad-section">
          <h3>VB-Cable</h3>
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
          Режим VB-Cable доступен только в десктоп-приложении Whithin на Windows.
          {availability.platform !== 'win32' && ` Платформа: ${availability.platform}.`}
        </div>
      )}

      {config.soundpadMode === 'system' && availability.available && (
        <section className="soundpad-section">
          <h3>Аудио-мост</h3>
          <p className="soundpad-hint">
            Мост смешивает физический микрофон и саундпад на CABLE Input.
            {!cableInput && ' CABLE Input не найден — установите VB-Cable.'}
          </p>

          <div className="soundpad-field">
            <label htmlFor="capture-device">Физический микрофон (вход моста)</label>
            <select
              id="capture-device"
              value={config.captureDeviceId}
              onChange={(e) => saveDeviceConfig({ captureDeviceId: e.target.value })}
            >
              <option value="">Авто (физический микрофон, не CABLE Output)</option>
              {devices.inputs
                .filter((device) => !/cable\s*output/i.test(device.name || ''))
                .map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                    {device.isDefault ? ' (по умолчанию Windows)' : ''}
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
              <p className="soundpad-hint">CABLE Output не найден — проверьте установку VB-Cable.</p>
            )}
          </div>

          <label className="soundpad-checkbox">
            <input
              type="checkbox"
              checked={config.autoDefaultCableMic !== false}
              onChange={(e) => saveDeviceConfig({ autoDefaultCableMic: e.target.checked })}
            />
            <span>
              Автоматически выбирать CABLE Output микрофоном Windows, пока Whithin открыт
            </span>
          </label>

          <div className={`soundpad-status ${bridgeStatus.running ? 'soundpad-status--ok' : 'soundpad-status--warn'}`}>
            {bridgeStatus.running
              ? `Мост активен: ${bridgeStatus.captureDevice || 'микрофон'} → ${bridgeStatus.renderDevice || 'CABLE Input'}`
              : 'Мост выключен. Включите перед использованием в режиме VB-Cable.'}
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
      )}

      {error && <div className="soundpad-status soundpad-status--warn">{error}</div>}
    </div>
  );
};

export default SoundpadConfigSection;
