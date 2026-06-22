import { usePresence } from '../contexts/PresenceContext';

/**
 * Live user status overrides from notification hub (UserStatusChanged).
 */
export const usePresenceOverrides = () => {
  const { resolvePresence, statusOverrides } = usePresence();
  return { resolveStatus: resolvePresence, resolvePresence, statusOverrides };
};
