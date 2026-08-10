import { HubConnectionState } from '@microsoft/signalr';

/**
 * Longer retry window for VPN / Wi-Fi / sleep resume.
 * Default SignalR policy gives up after ~4 attempts (~42s).
 */
export const SIGNALR_RECONNECT_DELAYS_MS = [
  0,
  1000,
  2000,
  3000,
  5000,
  5000,
  10000,
  10000,
  15000,
  30000,
  ...Array.from({ length: 30 }, () => 30000),
];

export const isHubConnected = (connection) =>
  connection?.state === HubConnectionState.Connected;

export const isHubBusy = (connection) => {
  const state = connection?.state;
  return (
    state === HubConnectionState.Connecting
    || state === HubConnectionState.Reconnecting
  );
};

export const isHubUsable = (connection) =>
  isHubConnected(connection) || isHubBusy(connection);

/**
 * Restart a hub that fell to Disconnected after reconnect exhausted
 * (common after VPN toggle). Safe to call repeatedly.
 */
export async function ensureHubStarted(connection, label = 'hub') {
  if (!connection) return false;
  if (isHubConnected(connection)) return true;
  if (isHubBusy(connection)) return false;

  try {
    await connection.start();
    return connection.state === HubConnectionState.Connected;
  } catch (error) {
    console.warn(`[signalr] ensureHubStarted(${label}) failed:`, error);
    return false;
  }
}

/**
 * Call onRecover when the browser comes back online or the tab becomes visible.
 * Debounced so VPN flaps don't spam restart.
 */
export function subscribeNetworkRecovery(onRecover, { debounceMs = 800 } = {}) {
  let timerId = null;

  const schedule = (reason) => {
    if (timerId) window.clearTimeout(timerId);
    timerId = window.setTimeout(() => {
      timerId = null;
      try {
        onRecover(reason);
      } catch (error) {
        console.warn('[signalr] network recovery handler failed:', error);
      }
    }, debounceMs);
  };

  const onOnline = () => schedule('online');
  const onVisibility = () => {
    if (!document.hidden) schedule('visible');
  };

  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    if (timerId) window.clearTimeout(timerId);
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
