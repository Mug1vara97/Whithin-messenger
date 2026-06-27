import React, { useEffect, useRef } from 'react';

import { PROFILE_UPDATED_EVENT } from './ProfileModalContext';
import { normalizeProfilePayload } from '../utils/profilePatchHelpers';
import { useAuthContext } from './AuthContext';
import { useConnectionContext } from './ConnectionContext';

export const ProfileRealtimeProvider = ({ children }) => {
  const { user } = useAuthContext();
  const { getConnection } = useConnectionContext();
  const userId = user?.id || user?.userId || user?.Id;
  const connectionRef = useRef(null);

  useEffect(() => {
    if (!userId || !getConnection) {
      return undefined;
    }

    let mounted = true;

    const setup = async () => {
      try {
        const connection = await getConnection('notificationhub', userId);
        if (!mounted) {
          return;
        }

        connectionRef.current = connection;

        const onUserProfileUpdated = (payload) => {
          const normalized = normalizeProfilePayload(payload);
          if (!normalized) {
            return;
          }

          window.dispatchEvent(
            new CustomEvent(PROFILE_UPDATED_EVENT, { detail: normalized }),
          );
        };

        connection.on('UserProfileUpdated', onUserProfileUpdated);
      } catch (error) {
        console.error('ProfileRealtimeProvider: subscribe failed', error);
      }
    };

    setup();

    return () => {
      mounted = false;
      connectionRef.current?.off('UserProfileUpdated');
      connectionRef.current = null;
    };
  }, [userId, getConnection]);

  return children;
};
