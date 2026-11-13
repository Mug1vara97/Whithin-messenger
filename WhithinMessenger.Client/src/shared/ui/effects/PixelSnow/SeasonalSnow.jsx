import React, { useEffect, useState } from 'react';
import PixelSnow from './PixelSnow';
import { getSnowEnabled, isSnowAvailable, SNOW_SETTINGS_EVENT } from '../../../lib/seasonal/snowSettings';

const SEASON_CHECK_MS = 60 * 60 * 1000;

export default function SeasonalSnow() {
  const [enabled, setEnabled] = useState(() => getSnowEnabled());
  const [available, setAvailable] = useState(() => isSnowAvailable());

  useEffect(() => {
    const onChange = () => setEnabled(getSnowEnabled());
    window.addEventListener(SNOW_SETTINGS_EVENT, onChange);
    window.addEventListener('storage', onChange);
    const timer = setInterval(() => setAvailable(isSnowAvailable()), SEASON_CHECK_MS);
    return () => {
      window.removeEventListener(SNOW_SETTINGS_EVENT, onChange);
      window.removeEventListener('storage', onChange);
      clearInterval(timer);
    };
  }, []);

  if (!available || !enabled) return null;
  return <PixelSnow />;
}
