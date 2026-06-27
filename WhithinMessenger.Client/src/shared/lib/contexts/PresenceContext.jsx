import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getPresenceSnapshot, PRESENCE_STATUS } from '../utils/userStatus';
import { useAuthContext } from './AuthContext';
import { useConnectionContext } from './ConnectionContext';
import { useUserBlocks } from './UserBlockContext';

const PresenceContext = createContext(null);

const noopResolvePresence = (_userId, fallbackStatus) => fallbackStatus;
const noopGetPresence = (_userId, fallbackStatus) => getPresenceSnapshot(fallbackStatus);

export const PresenceProvider = ({ children }) => {
  const { user } = useAuthContext();
  const { getConnection } = useConnectionContext();
  const { shouldHidePresence } = useUserBlocks();
  const userId = user?.id || user?.userId || user?.Id;
  const [statusOverrides, setStatusOverrides] = useState({});
  const notificationConnectionRef = useRef(null);

  useEffect(() => {
    if (!userId || !getConnection) return undefined;
    let mounted = true;

    const setup = async () => {
      try {
        const notificationConnection = await getConnection('notificationhub', userId);
        if (!mounted) return;
        notificationConnectionRef.current = notificationConnection;

        const onUserStatusChanged = (payload) => {
          const changedUserId = payload?.userId ?? payload?.UserId;
          const changedStatus = payload?.status ?? payload?.Status;
          if (!changedUserId || changedStatus === undefined || changedStatus === null) {
            return;
          }

          setStatusOverrides((prev) => ({
            ...prev,
            [String(changedUserId)]: changedStatus,
          }));
        };

        notificationConnection.on('UserStatusChanged', onUserStatusChanged);
      } catch (error) {
        console.error('PresenceProvider: subscribe failed', error);
      }
    };

    setup();

    return () => {
      mounted = false;
      notificationConnectionRef.current?.off('UserStatusChanged');
      notificationConnectionRef.current = null;
    };
  }, [userId, getConnection]);

  const resolvePresence = useCallback(
    (memberUserId, fallbackStatus) => {
      const key = String(memberUserId ?? '');
      if (key && shouldHidePresence(key)) {
        return PRESENCE_STATUS.OFFLINE;
      }
      if (key && statusOverrides[key] !== undefined) {
        return statusOverrides[key];
      }
      return fallbackStatus;
    },
    [statusOverrides, shouldHidePresence],
  );

  const getPresence = useCallback(
    (memberUserId, fallbackStatus) =>
      getPresenceSnapshot(resolvePresence(memberUserId, fallbackStatus)),
    [resolvePresence],
  );

  const value = useMemo(
    () => ({ resolvePresence, getPresence, statusOverrides }),
    [resolvePresence, getPresence, statusOverrides],
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
};

export const usePresence = () => {
  const context = useContext(PresenceContext);
  if (!context) {
    return {
      resolvePresence: noopResolvePresence,
      getPresence: noopGetPresence,
      statusOverrides: {},
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
