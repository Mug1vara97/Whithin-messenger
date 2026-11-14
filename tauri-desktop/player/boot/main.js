import {
  alignPreloaderLoopAnimations,
  createD20Scene,
} from '../../../WhithinMessenger.Client/src/shared/ui/organisms/StartupPreloader/d20Scene.js';
import preloaderCss from '../../../WhithinMessenger.Client/src/shared/ui/organisms/StartupPreloader/StartupPreloader.css?inline';

// Injected into the main webview on every page: shows the site's D20 preloader in the
// app theme on the shell page and keeps it over the site until the site's own preloader takes over.

const HOST_ID = 'whithin-boot-loader';
const THEME_CACHE_KEY = 'whithin.bootTheme';
const SITE_BOOT_DONE_KEY = 'whithin:startup-boot-done';
const RGB_VARS = ['--background', '--background-primary', '--surface', '--primary', '--server-list-background'];
const EXIT_MS = 420;
const SITE_TIMEOUT_MS = 20000;

const isShell = location.hostname === 'whithin-asset.localhost' || location.protocol === 'whithin-asset:';
const isSite = /^https?:$/.test(location.protocol) && !location.hostname.endsWith('.localhost');

function toHex(value) {
  if (!value || typeof value !== 'string') return null;
  const hex = value.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
    return `#${h.toLowerCase()}`;
  }
  const rgb = value.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (!rgb) return null;
  return `#${rgb.slice(1, 4).map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgbTriplet(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

function readCachedTheme() {
  try {
    return JSON.parse(localStorage.getItem(THEME_CACHE_KEY) || 'null');
  } catch {
    return null;
  }
}

function cacheTheme(theme) {
  try {
    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(theme));
  } catch {
    /* storage unavailable */
  }
}

function waitInvoke(timeoutMs) {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const invoke = window.__TAURI__?.core?.invoke;
      if (invoke) resolve(invoke);
      else if (Date.now() - started > timeoutMs) resolve(null);
      else setTimeout(tick, 25);
    };
    tick();
  });
}

async function fetchTheme() {
  const invoke = await waitInvoke(5000);
  if (!invoke) return null;
  try {
    return await invoke('music_get_theme');
  } catch {
    return null;
  }
}

function whenDocumentElement(cb) {
  if (document.documentElement) {
    cb();
    return;
  }
  const observer = new MutationObserver(() => {
    if (!document.documentElement) return;
    observer.disconnect();
    cb();
  });
  observer.observe(document, { childList: true });
}

const EXTRA_CSS = `
  :host { all: initial; }
  .startup-preloader {
    z-index: 0;
    font-family: var(--boot-font, 'gg sans', 'Segoe UI', system-ui, sans-serif);
    -webkit-font-smoothing: antialiased;
  }
  .boot-titlebar {
    position: fixed;
    inset: 0 0 auto 0;
    height: 32px;
    background: var(--server-list-background, #1e1f22);
    transition: opacity ${EXIT_MS}ms ease;
  }
  .is-exiting ~ .boot-titlebar { opacity: 0; }
`;

let current = null;

function applyThemeVars(host, theme) {
  const vars = theme?.vars || {};
  Object.entries(vars).forEach(([name, value]) => {
    if (typeof value === 'string' && value) host.style.setProperty(name, value);
  });
  RGB_VARS.forEach((name) => {
    const hex = toHex(vars[name]);
    if (hex) host.style.setProperty(`${name}-rgb`, hexToRgbTriplet(hex));
  });
  if (theme?.fontFamily) host.style.setProperty('--boot-font', theme.fontFamily);

  if (isShell) {
    const titlebar = toHex(vars['--server-list-background']);
    const root = document.documentElement.style;
    if (titlebar) {
      root.setProperty('--bg', titlebar);
      root.setProperty('--titlebar-bg', titlebar);
    }
    if (vars['--text']) root.setProperty('--titlebar-text', vars['--text']);
    if (vars['--icon']) root.setProperty('--titlebar-nav', vars['--icon']);
    if (vars['--icon-hover']) root.setProperty('--titlebar-nav-hover', vars['--icon-hover']);
    if (vars['--border']) root.setProperty('--border', vars['--border']);
  }
}

function mount(text) {
  if (current) {
    setText(text);
    return;
  }
  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = `position:fixed;inset:0;z-index:${isShell ? 9990 : 2147483000};`;
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>${preloaderCss}${EXTRA_CSS}</style>
    <div class="startup-preloader">
      <div class="startup-preloader__noise"></div>
      <div class="startup-preloader__scanlines"></div>
      <div class="startup-preloader__panel">
        <div class="startup-preloader__viewport" aria-hidden="true"></div>
        <h1 class="startup-preloader__title">Whithin</h1>
        <p class="startup-preloader__subtitle"></p>
        <div class="startup-preloader__progress"><span></span></div>
      </div>
    </div>
    ${isShell ? '' : '<div class="boot-titlebar"></div>'}
  `;
  const root = shadow.querySelector('.startup-preloader');
  shadow.querySelector('.startup-preloader__subtitle').textContent = text;

  const cached = readCachedTheme();
  if (cached) applyThemeVars(host, cached);
  else host.style.visibility = 'hidden';

  document.documentElement.appendChild(host);
  alignPreloaderLoopAnimations(shadow);

  const readVar = (name) => {
    const value = getComputedStyle(host).getPropertyValue(name).trim();
    return toHex(value) || value;
  };
  const scene = createD20Scene(shadow.querySelector('.startup-preloader__viewport'), { readVar });
  current = { host, shadow, root, scene, exiting: false };

  const reveal = setTimeout(() => {
    host.style.visibility = '';
  }, 400);
  fetchTheme().then((theme) => {
    clearTimeout(reveal);
    if (theme) {
      cacheTheme(theme);
      if (current?.host === host) {
        applyThemeVars(host, theme);
        scene.applyTheme();
      }
    }
    host.style.visibility = '';
  });
}

function setText(text) {
  const subtitle = current?.shadow.querySelector('.startup-preloader__subtitle');
  if (subtitle && text) subtitle.textContent = text;
}

function unmount({ fade = true } = {}) {
  const entry = current;
  if (!entry || entry.exiting) return;
  entry.exiting = true;
  current = null;
  const remove = () => {
    entry.scene.destroy();
    entry.host.remove();
  };
  if (!fade) {
    remove();
    return;
  }
  entry.root.classList.add('is-exiting');
  setTimeout(remove, EXIT_MS + 30);
}

function watchSiteHandoff() {
  const started = Date.now();
  let rootFilledAt = 0;
  const timer = setInterval(() => {
    if (!current) {
      clearInterval(timer);
      return;
    }
    const sitePreloader = document.querySelector('.startup-preloader');
    if (sitePreloader) {
      clearInterval(timer);
      if (sitePreloader.classList.contains('is-exiting')) {
        unmount();
        return;
      }
      // Let the site's WebGL canvas paint its first frames before uncovering it.
      setTimeout(() => unmount({ fade: false }), 180);
      return;
    }
    const appRoot = document.getElementById('root');
    if (appRoot && appRoot.childElementCount > 0) {
      rootFilledAt ||= Date.now();
      if (Date.now() - rootFilledAt > 400) {
        clearInterval(timer);
        unmount();
        return;
      }
    }
    if (Date.now() - started > SITE_TIMEOUT_MS) {
      clearInterval(timer);
      unmount();
    }
  }, 40);
}

function siteBootAlreadyDone() {
  try {
    return sessionStorage.getItem(SITE_BOOT_DONE_KEY) === '1';
  } catch {
    return false;
  }
}

if (window.top === window && !window.WhithinBootLoader && (isShell || isSite)) {
  window.WhithinBootLoader = { mount, unmount, setText };
  if (isShell) {
    whenDocumentElement(() => mount('Подключение к Whithin'));
  } else if (!siteBootAlreadyDone()) {
    whenDocumentElement(() => {
      mount('Синхронизация данных');
      watchSiteHandoff();
    });
  }
}
