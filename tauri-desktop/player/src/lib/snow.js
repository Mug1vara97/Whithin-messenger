import { mountPixelSnow } from '../../../../WhithinMessenger.Client/src/shared/ui/effects/PixelSnow/pixelSnowEngine.js';
import { listen, tauri } from './tauri';

/** The site owns the snow setting; the player mirrors it and forwards the hotkey. */
export const initSnow = () => {
  let unmount = null;
  const apply = (active) => {
    if (active && !unmount) unmount = mountPixelSnow(document.body);
    if (!active && unmount) {
      unmount();
      unmount = null;
    }
  };

  listen('snow-state', (active) => apply(Boolean(active)));
  tauri().then((t) => t.event.emit('snow-state-request').catch(() => {}));

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.code !== 'KeyS' || !(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey) return;
      e.preventDefault();
      tauri().then((t) => t.event.emit('snow-toggle').catch(() => {}));
    },
    true,
  );
};
