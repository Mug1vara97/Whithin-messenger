import { usePresence } from '../contexts/PresenceContext';

/**
 * Live user status overrides from notification hub (UserStatusChanged).
 */
export const usePresenceOverrides = () => {
  const { resolvePresence, getPresence, getLastSeen, statusOverrides, lastSeenOverrides } =
    usePresence();
  return {
    resolveStatus: resolvePresence,
    resolvePresence,
    getPresence,
    getLastSeen,
    statusOverrides,
    lastSeenOverrides,
  };
};
