import { createRoot } from 'react-dom/client';
import sliderCss from '../src/elastic-slider.css?inline';
import css from './titlebar.css?inline';
import { TitlebarPlayer } from './TitlebarPlayer';

/*
 * Injected into the site webview (initialization script): shows the playing track in the
 * titlebar with a drop-down remote. All state comes from the player webview over Tauri events.
 */
const HOST_ID = 'whithin-titlebar-player';

function mount() {
  if (document.getElementById(HOST_ID)) return;
  const host = document.createElement('div');
  host.id = HOST_ID;
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = sliderCss + css;
  const root = document.createElement('div');
  shadow.append(style, root);
  createRoot(root).render(<TitlebarPlayer />);
}

function start() {
  const ready = () => window.__TAURI__?.event?.emitTo && document.getElementById('electron-window-controls');
  const timer = setInterval(() => {
    if (!ready()) return;
    clearInterval(timer);
    mount();
  }, 300);
}

if (/^https?:$/.test(location.protocol) && !location.hostname.endsWith('.localhost') && window.top === window) {
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
}
