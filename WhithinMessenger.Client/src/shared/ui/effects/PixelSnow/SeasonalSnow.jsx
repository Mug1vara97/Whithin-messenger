import React, { useEffect, useState } from 'react';
import PixelSnow from './PixelSnow';
import {
  isDesktopApp,
  isSnowActive,
  isSnowHotkey,
  SNOW_SETTINGS_EVENT,
  toggleSnowSecret,
} from '../../../lib/seasonal/snowSettings';
import { appToast } from '../../../lib/utils/appToast';

const SEASON_CHECK_MS = 60 * 60 * 1000;

/** Tauri events shared with the desktop music player webview. */
const SNOW_STATE_EVENT = 'snow-state';
const SNOW_TOGGLE_EVENT = 'snow-toggle';
const SNOW_STATE_REQUEST_EVENT = 'snow-state-request';

const tauriEvents = () => window.__TAURI__?.event;

export default function SeasonalSnow() {
  const [active, setActive] = useState(() => isSnowActive());
  const [playerOpen, setPlayerOpen] = useState(false);

  useEffect(() => {
    if (!isDesktopApp()) return undefined;

    const refresh = () => setActive(isSnowActive());
    const toggle = () => {
      const next = toggleSnowSecret();
      appToast.info(next ? 'Снег включён' : 'Снег выключен', { title: 'Зимнее оформление', duration: 1500 });
    };
    const onKeyDown = (event) => {
      if (!isSnowHotkey(event)) return;
      event.preventDefault();
      toggle();
    };

    window.addEventListener(SNOW_SETTINGS_EVENT, refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('keydown', onKeyDown, true);
    const timer = setInterval(refresh, SEASON_CHECK_MS);

    const unlisten = [];
    const events = tauriEvents();
    if (events) {
      Promise.all([
        events.listen(SNOW_TOGGLE_EVENT, toggle),
        events.listen(SNOW_STATE_REQUEST_EVENT, () => events.emit(SNOW_STATE_EVENT, isSnowActive())),
        events.listen('music-visibility', (event) => setPlayerOpen(Boolean(event.payload))),
      ])
        .then((fns) => unlisten.push(...fns))
        .catch(() => {});
    }

    return () => {
      window.removeEventListener(SNOW_SETTINGS_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('keydown', onKeyDown, true);
      clearInterval(timer);
      unlisten.forEach((fn) => fn());
    };
  }, []);

  useEffect(() => {
    tauriEvents()?.emit(SNOW_STATE_EVENT, active).catch(() => {});
  }, [active]);

  return active && !playerOpen ? <PixelSnow /> : null;
}
