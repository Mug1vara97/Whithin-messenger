import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  getPresenceSnapshot,
  normalizeUserStatus,
  PRESENCE_STATUS,
} from '../utils/userStatus';
import { useAuthContext } from './AuthContext';
import { useConnectionContext } from './ConnectionContext';
import { useUserBlocks } from './UserBlockContext';

const PresenceContext = createContext(null);

const noopResolvePresence = (_userId, fallbackStatus) => fallbackStatus;
const noopGetPresence = (_userId, fallbackStatus) => getPresenceSnapshot(fallbackStatus);
const noopApplyLocalStatus = () => {};
const noopGetLastSeen = () => null;

export const PresenceProvider = ({ children }) => {
  const { user } = useAuthContext();
  const { getConnection } = useConnectionContext();
  const { shouldHidePresence } = useUserBlocks();
  const userId = user?.id || user?.userId || user?.Id;
  const [statusOverrides, setStatusOverrides] = useState({});
  const [lastSeenOverrides, setLastSeenOverrides] = useState({});
  const notificationConnectionRef = useRef(null);
  const statusHandlerRef = useRef(null);

  useEffect(() => {
    if (!userId || !getConnection) return undefined;
    let mounted = true;

    const onUserStatusChanged = (payload) => {
      const changedUserId = payload?.userId ?? payload?.UserId;
      const changedStatus = payload?.status ?? payload?.Status;
      const changedLastSeen = payload?.lastSeen ?? payload?.LastSeen;
      if (!changedUserId || changedStatus === undefined || changedStatus === null) {
        return;
      }

      const key = String(changedUserId);
      const normalized = normalizeUserStatus(changedStatus);

      setStatusOverrides((prev) => {
        if (prev[key] === normalized) return prev;
        return { ...prev, [key]: normalized };
      });

      if (changedLastSeen !== undefined && changedLastSeen !== null) {
        setLastSeenOverrides((prev) => {
          if (prev[key] === changedLastSeen) return prev;
          return { ...prev, [key]: changedLastSeen };
        });
      }
    };

    statusHandlerRef.current = onUserStatusChanged;

    const setup = async () => {
      try {
        const notificationConnection = await getConnection('notificationhub', userId);
        if (!mounted) return;
        notificationConnectionRef.current = notificationConnection;
        notificationConnection.on('UserStatusChanged', onUserStatusChanged);
      } catch (error) {
        console.error('PresenceProvider: subscribe failed', error);
      }
    };

    setup();

    return () => {
      mounted = false;
      const connection = notificationConnectionRef.current;
      const handler = statusHandlerRef.current;
      if (connection && handler) {
        connection.off('UserStatusChanged', handler);
      }
      notificationConnectionRef.current = null;
      statusHandlerRef.current = null;
    };
  }, [userId, getConnection]);

  const applyLocalStatus = useCallback((memberUserId, status, lastSeen = null) => {
    const key = String(memberUserId ?? '');
    if (!key) return;

    const normalized = normalizeUserStatus(status);
    setStatusOverrides((prev) => {
      if (prev[key] === normalized) return prev;
      return { ...prev, [key]: normalized };
    });

    if (lastSeen !== undefined && lastSeen !== null) {
      setLastSeenOverrides((prev) => {
        if (prev[key] === lastSeen) return prev;
        return { ...prev, [key]: lastSeen };
      });
    }
  }, []);

  const resolvePresence = useCallback(
    (memberUserId, fallbackStatus) => {
      const key = String(memberUserId ?? '');
      if (key && shouldHidePresence(key)) {
        return PRESENCE_STATUS.OFFLINE;
      }
      if (key && statusOverrides[key] !== undefined) {
        return statusOverrides[key];
      }
      return normalizeUserStatus(fallbackStatus);
    },
    [statusOverrides, shouldHidePresence],
  );

  const getPresence = useCallback(
    (memberUserId, fallbackStatus) =>
      getPresenceSnapshot(resolvePresence(memberUserId, fallbackStatus)),
    [resolvePresence],
  );

  const getLastSeen = useCallback(
    (memberUserId, fallbackLastSeen = null) => {
      const key = String(memberUserId ?? '');
      if (key && lastSeenOverrides[key] !== undefined) {
        return lastSeenOverrides[key];
      }
      return fallbackLastSeen;
    },
    [lastSeenOverrides],
  );

  const value = useMemo(
    () => ({
      resolvePresence,
      getPresence,
      getLastSeen,
      applyLocalStatus,
      statusOverrides,
      lastSeenOverrides,
    }),
    [
      resolvePresence,
      getPresence,
      getLastSeen,
      applyLocalStatus,
      statusOverrides,
      lastSeenOverrides,
    ],
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
};

export const usePresence = () => {
  const context = useContext(PresenceContext);
  if (!context) {
    return {
      resolvePresence: noopResolvePresence,
      getPresence: noopGetPresence,
      getLastSeen: noopGetLastSeen,
      applyLocalStatus: noopApplyLocalStatus,
      statusOverrides: {},
      lastSeenOverrides: {},
    };
  }
  return context;
};

export const useResolvedPresence = (memberUserId, fallbackStatus) => {
  const { getPresence, statusOverrides } = usePresence();

  return useMemo(
    () => getPresence(memberUserId, fallbackStatus),
    [getPresence, memberUserId, fallbackStatus, statusOverrides],
  );
};
