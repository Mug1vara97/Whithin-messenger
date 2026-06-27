export const OPEN_DISCOVERY_EVENT = 'whithin-open-discovery';

export function openDiscovery({ tab = 'servers' } = {}) {
  window.dispatchEvent(
    new CustomEvent(OPEN_DISCOVERY_EVENT, { detail: { tab } }),
  );
}
