import React, { useState, useEffect } from 'react';
import styles from './ElectronIndicator.module.css';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import { Tooltip } from '@mui/material';
import { getElectronEchoCanceller } from '../../../lib/utils/electronEchoCanceller';

/**
 * Индикатор Electron режима с информацией о echo cancellation
 */
const ElectronIndicator = () => {
  const [isElectron, setIsElectron] = useState(false);
  const [echoCancellerActive, setEchoCancellerActive] = useState(false);
  const [echoCancellerStatus, setEchoCancellerStatus] = useState(null);

  useEffect(() => {
    // Проверяем, в Electron ли мы
    const checkElectron = async () => {
      if (window.electronAPI && typeof window.electronAPI.isElectron === 'function') {
        try {
          const result = await window.electronAPI.isElectron();
          setIsElectron(result);
        } catch (error) {
          setIsElectron(false);
        }
      }
    };

    checkElectron();

    // Проверяем статус echo canceller каждую секунду
    const interval = setInterval(() => {
      try {
        const canceller = getElectronEchoCanceller();
        const status = canceller.getStatus();
        
        setEchoCancellerActive(status.isActive);
        setEchoCancellerStatus(status);
      } catch (error) {
        setEchoCancellerActive(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!isElectron) {
    return null; // Не показываем индикатор в браузере
  }

  const tooltipContent = echoCancellerActive
    ? 'Electron режим: Echo Cancellation активно\nГолоса участников не будут захвачены при демонстрации окна/игры'
    : 'Electron режим: Echo Cancellation готово\nБудет активировано при демонстрации экрана';

  return (
    <Tooltip title={tooltipContent} arrow placement="top">
      <div className={`${styles.indicator} ${echoCancellerActive ? styles.active : ''}`}>
        <DesktopWindowsIcon className={styles.icon} />
        <span className={styles.text}>Electron</span>
        {echoCancellerActive && (
          <CheckCircleIcon className={styles.activeIcon} />
        )}
        {!echoCancellerActive && (
          <InfoIcon className={styles.infoIcon} />
        )}
      </div>
    </Tooltip>
  );
};

export default ElectronIndicator;

