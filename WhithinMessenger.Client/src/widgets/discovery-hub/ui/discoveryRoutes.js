import { DISCOVERY_TAB } from './discoveryConstants';

export const DISCOVERY_BASE_PATH = '/discovery';

export function isDiscoveryPath(pathname) {
  return pathname === DISCOVERY_BASE_PATH || pathname.startsWith(`${DISCOVERY_BASE_PATH}/`);
}

export function parseDiscoveryTab(pathname) {
  if (!isDiscoveryPath(pathname)) {
    return null;
  }

  const section = pathname.slice(DISCOVERY_BASE_PATH.length).replace(/^\//, '');

  if (!section || section === DISCOVERY_TAB.SERVERS) {
    return DISCOVERY_TAB.SERVERS;
  }

  if (Object.values(DISCOVERY_TAB).includes(section)) {
    return section;
  }

  return DISCOVERY_TAB.SERVERS;
}

export function getDiscoveryPath(tab = DISCOVERY_TAB.SERVERS) {
  if (!tab || tab === DISCOVERY_TAB.SERVERS) {
    return DISCOVERY_BASE_PATH;
  }

  return `${DISCOVERY_BASE_PATH}/${tab}`;
}
