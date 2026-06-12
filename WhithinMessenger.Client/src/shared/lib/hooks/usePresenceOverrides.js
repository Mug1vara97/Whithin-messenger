import { useCallback, useEffect, useRef, useState } from 'react';
import { useConnectionContext } from '../contexts/ConnectionContext';

/**
 * Live user status overrides from notification hub (UserStatusChanged).
 */
export const usePresenceOverrides = (userId) => {
  const connectionContext = useConnectionContext();
  const getConnection = connectionContext?.getConnection;
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
          if (!changedUserId || changedStatus === undefined) return;

          setStatusOverrides((prev) => ({
            ...prev,
            [String(changedUserId)]: changedStatus,
          }));
        };

        notificationConnection.on('UserStatusChanged', onUserStatusChanged);
      } catch (error) {
        console.error('usePresenceOverrides: subscribe failed', error);
      }
    };

    setup();

    return () => {
      mounted = false;
      notificationConnectionRef.current?.off('UserStatusChanged');
    };
  }, [userId, getConnection]);

  const resolveStatus = useCallback(
    (memberUserId, fallbackStatus) => {
      const key = String(memberUserId ?? '');
      if (key && statusOverrides[key] !== undefined) {
        return statusOverrides[key];
      }
      return fallbackStatus;
    },
    [statusOverrides]
  );

  return { resolveStatus, statusOverrides };
};
