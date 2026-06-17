import { MEDIA_BASE_URL } from '../constants/apiEndpoints';

/** UI отключён; бэкенд и компонент UserNameplate — заготовка на будущее. */
export const NAMEPLATE_UI_ENABLED = false;

export const TEST_NAMEPLATE_PATH = '/video.webm';

export function resolveNameplateUrl(nameplate) {
  if (!nameplate) return null;
  if (nameplate.startsWith('http://') || nameplate.startsWith('https://')) {
    return nameplate;
  }
  if (nameplate.startsWith('/uploads')) {
    return `${MEDIA_BASE_URL}${nameplate}`;
  }
  return nameplate;
}

export function isNameplateVideo(nameplate) {
  if (!nameplate) return false;
  return /\.webm($|\?)/i.test(nameplate);
}

export function resolveMemberNameplate(member) {
  return member?.nameplate ?? member?.Nameplate ?? null;
}
