import React, { useState, useEffect } from 'react';
import { useCallStore } from '../../../lib/stores/callStore';
import styles from './AudioDeviceSelector.module.css';

/**
 * Компонент для выбора аудио устройства вывода для голосов участников
 * Помогает предотвратить эхо при демонстрации окна
 */
export const AudioDeviceSelector = ({ className = '' }) => {
  const [devices, setDevices] = useState([]);
  const [currentDevice, setCurrentDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState(null);
  
  const isInCall = useCallStore((state) => state.isInCall);
  const isAudioDeviceSelectionSupported = useCallStore(
    (state) => state.isAudioDeviceSelectionSupported
  );
  const getAudioOutputDevices = useCallStore((state) => state.getAudioOutputDevices);
  const setParticipantsAudioDevice = useCallStore(
    (state) => state.setParticipantsAudioDevice
  );
  const getCurrentAudioDevice = useCallStore((state) => state.getCurrentAudioDevice);
  const autoSelectHeadphones = useCallStore((state) => state.autoSelectHeadphones);

  // Загрузка устройств
  const loadDevices = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Проверяем поддержку
      const isSupported = isAudioDeviceSelectionSupported();
      setSupported(isSupported);
      
      if (!isSupported) {
        setLoading(false);
        return;
      }
      
      // Получаем список устройств
      const deviceList = await getAudioOutputDevices();
      setDevices(deviceList);
      
      // Получаем текущее устройство
      const current = await getCurrentAudioDevice();
      setCurrentDevice(current);
      
    } catch (err) {
      console.error('Failed to load audio devices:', err);
      setError('Не удалось загрузить список устройств');
    } finally {
      setLoading(false);
    }
  };

  // Загружаем устройства при монтировании и при входе в звонок
  useEffect(() => {
    if (isInCall) {
      loadDevices();
    }
  }, [isInCall]);

  // Обработчик изменения устройства
  const handleDeviceChange = async (deviceId) => {
    try {
      setLoading(true);
      await setParticipantsAudioDevice(deviceId);
      
      // Обновляем текущее устройство
      const current = await getCurrentAudioDevice();
      setCurrentDevice(current);
      
      console.log('✅ Audio device changed to:', current.label);
    } catch (err) {
      console.error('Failed to change audio device:', err);
      setError('Не удалось изменить устройство');
    } finally {
      setLoading(false);
    }
  };

  // Автовыбор наушников
  const handleAutoSelect = async () => {
    try {
      setLoading(true);
      const headphones = await autoSelectHeadphones();
      
      if (headphones) {
        // Обновляем текущее устройство
        const current = await getCurrentAudioDevice();
        setCurrentDevice(current);
        console.log('🎧 Auto-selected headphones:', headphones.label);
      } else {
        setError('Наушники не найдены');
      }
    } catch (err) {
      console.error('Failed to auto-select headphones:', err);
      setError('Не удалось выбрать наушники');
    } finally {
      setLoading(false);
    }
  };

  // Если не в звонке - не показываем
  if (!isInCall) {
    return null;
  }

  // Если не поддерживается setSinkId (Safari)
  if (!supported) {
    return (
      <div className={`${styles.container} ${className}`}>
        <div className={styles.warning}>
          <span className={styles.warningIcon}>⚠️</span>
          <div className={styles.warningText}>
            <div className={styles.warningTitle}>
              Выбор аудио устройства не поддерживается
            </div>
            <div className={styles.warningDescription}>
              Ваш браузер не поддерживает API выбора аудио устройства.
              При демонстрации окна используйте наушники вручную.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.header}>
        <label className={styles.label}>
          <span className={styles.labelIcon}>🔊</span>
          Устройство для голосов участников
        </label>
        <button
          className={styles.autoButton}
          onClick={handleAutoSelect}
          disabled={loading}
          title="Автоматически выбрать наушники"
        >
          <span className={styles.autoIcon}>🎧</span>
          Авто
        </button>
      </div>

      <div className={styles.selectContainer}>
        <select
          className={styles.select}
          value={currentDevice?.deviceId || 'default'}
          onChange={(e) => handleDeviceChange(e.target.value)}
          disabled={loading || devices.length === 0}
        >
          {devices.length === 0 ? (
            <option value="default">Загрузка устройств...</option>
          ) : (
            devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Устройство ${device.deviceId.substring(0, 8)}`}
              </option>
            ))
          )}
        </select>
        
        {loading && <div className={styles.loader} />}
      </div>

      {currentDevice && (
        <div className={styles.currentDevice}>
          <span className={styles.currentIcon}>✓</span>
          <span className={styles.currentText}>
            {currentDevice.label || 'Системное устройство'}
          </span>
        </div>
      )}

      {error && (
        <div className={styles.error}>
          <span className={styles.errorIcon}>⚠️</span>
          {error}
        </div>
      )}

      <div className={styles.hint}>
        <span className={styles.hintIcon}>💡</span>
        <span className={styles.hintText}>
          Направьте голоса на наушники, чтобы избежать эха при демонстрации окна
        </span>
      </div>
    </div>
  );
};

export default AudioDeviceSelector;

