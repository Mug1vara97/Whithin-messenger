import { invoke, listen } from './tauri';

let applied = [];
let frosted = false;
let wallpaperUrl = null;

/** Frosted glass needs both the site's mode flag and an actual wallpaper. */
const syncFrosted = () => {
  const root = document.documentElement;
  if (frosted && wallpaperUrl) {
    root.setAttribute('data-frosted', '');
    root.style.setProperty('--wallpaper', `url("${wallpaperUrl}")`);
  } else {
    root.removeAttribute('data-frosted');
    root.style.removeProperty('--wallpaper');
  }
};

/** Applies the site's theme snapshot (CSS variables + font) pushed by the bridge. */
const applyTheme = (theme) => {
  if (!theme?.vars) return;
  const root = document.documentElement;
  applied.forEach((name) => root.style.removeProperty(name));
  applied = [];
  const vars = { ...theme.vars, ...(theme.frosted || {}) };
  Object.entries(vars).forEach(([name, value]) => {
    if (!value) return;
    root.style.setProperty(name, value);
    applied.push(name);
  });
  if (theme.fontFamily) {
    root.style.setProperty('--font', theme.fontFamily);
    applied.push('--font');
  }
  frosted = Boolean(theme.frosted);
  syncFrosted();
};

const loadWallpaper = async () => {
  const bytes = await invoke('music_get_wallpaper').catch(() => null);
  if (wallpaperUrl) URL.revokeObjectURL(wallpaperUrl);
  wallpaperUrl = bytes && bytes.byteLength ? URL.createObjectURL(new Blob([bytes])) : null;
  syncFrosted();
};

export const initTheme = () => {
  invoke('music_get_theme').then(applyTheme).catch(() => {});
  listen('music-theme', applyTheme);
  loadWallpaper();
  listen('music-wallpaper', loadWallpaper);
};
