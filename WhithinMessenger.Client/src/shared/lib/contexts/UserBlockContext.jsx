import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { friendApi } from '../../../entities/friend/api/friendApi';
import { useAuthContext } from './AuthContext';
import { useConnectionContext } from './ConnectionContext';
import { PRESENCE_STATUS } from '../utils/userStatus';

const UserBlockContext = createContext(null);

const normalizeBlockedUser = (user) => ({
  userId: user?.userId ?? user?.UserId,
  username: user?.username ?? user?.Username ?? 'Пользователь',
  avatar: user?.avatar ?? user?.Avatar ?? null,
  avatarColor: user?.avatarColor ?? user?.AvatarColor ?? null,
  blockedAt: user?.blockedAt ?? user?.BlockedAt ?? null,
});

export const UserBlockProvider = ({ children }) => {
  const { user } = useAuthContext();
  const { getConnection } = useConnectionContext();
  const userId = user?.id || user?.userId || user?.Id;

  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedByUserIds, setBlockedByUserIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const connectionRef = useRef(null);

  const blockedUserIds = useMemo(
    () => new Set(blockedUsers.map((item) => String(item.userId))),
    [blockedUsers],
  );

  const blockedByIds = useMemo(
    () => new Set(blockedByUserIds.map((id) => String(id))),
    [blockedByUserIds],
  );

  const refreshBlockedUsers = useCallback(async () => {
    if (!userId) {
      setBlockedUsers([]);
      setBlockedByUserIds([]);
      return;
    }

    try {
      setLoading(true);
      const data = await friendApi.getBlockedUsers();
      const users = (data?.blockedUsers ?? data?.BlockedUsers ?? [])
        .map(normalizeBlockedUser)
        .filter((item) => item.userId);
      const blockedBy = (data?.blockedByUserIds ?? data?.BlockedByUserIds ?? []).map(String);
      setBlockedUsers(users);
      setBlockedByUserIds(blockedBy);
    } catch (error) {
      console.error('Failed to load blocked users', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const blockUser = useCallback(async (targetUserId) => {
    if (!targetUserId) return { success: false };
    await friendApi.blockUser(targetUserId);
    await refreshBlockedUsers();
    return { success: true };
  }, [refreshBlockedUsers]);

  const unblockUser = useCallback(async (targetUserId) => {
    if (!targetUserId) return { success: false };
    await friendApi.unblockUser(targetUserId);
    await refreshBlockedUsers();
    return { success: true };
  }, [refreshBlockedUsers]);

  const isUserBlocked = useCallback(
    (targetUserId) => blockedUserIds.has(String(targetUserId ?? '')),
    [blockedUserIds],
  );

  const isBlockedByUser = useCallback(
    (targetUserId) => blockedByIds.has(String(targetUserId ?? '')),
    [blockedByIds],
  );

  const shouldHidePresence = useCallback(
    (targetUserId) => {
      const key = String(targetUserId ?? '');
      if (!key) return false;
      return blockedUserIds.has(key) || blockedByIds.has(key);
    },
    [blockedUserIds, blockedByIds],
  );

  const resolvePresenceForUser = useCallback(
    (targetUserId, fallbackStatus) => {
      if (shouldHidePresence(targetUserId)) {
        return PRESENCE_STATUS.OFFLINE;
      }
      return fallbackStatus;
    },
    [shouldHidePresence],
  );

  useEffect(() => {
    refreshBlockedUsers();
  }, [refreshBlockedUsers]);

  useEffect(() => {
    if (!userId || !getConnection) return undefined;

    let mounted = true;

    const setup = async () => {
      try {
        const connection = await getConnection('friendhub', userId);
        if (!mounted) return;
        connectionRef.current = connection;

        connection.on('UserBlocked', () => refreshBlockedUsers());
        connection.on('UserUnblocked', () => refreshBlockedUsers());
        connection.on('BlockedByUser', () => refreshBlockedUsers());
        connection.on('UnblockedByUser', () => refreshBlockedUsers());
      } catch (error) {
        console.error('UserBlockProvider: subscribe failed', error);
      }
    };

    setup();

    return () => {
      mounted = false;
      if (connectionRef.current) {
        connectionRef.current.off('UserBlocked');
        connectionRef.current.off('UserUnblocked');
        connectionRef.current.off('BlockedByUser');
        connectionRef.current.off('UnblockedByUser');
      }
      connectionRef.current = null;
    };
  }, [userId, getConnection, refreshBlockedUsers]);

  const value = useMemo(
    () => ({
      blockedUsers,
      blockedUserIds,
      blockedByUserIds: blockedByIds,
      loading,
      refreshBlockedUsers,
      blockUser,
      unblockUser,
      isUserBlocked,
      isBlockedByUser,
      shouldHidePresence,
      resolvePresenceForUser,
    }),
    [
      blockedUsers,
      blockedUserIds,
      blockedByIds,
      loading,
      refreshBlockedUsers,
      blockUser,
      unblockUser,
      isUserBlocked,
      isBlockedByUser,
      shouldHidePresence,
      resolvePresenceForUser,
    ],
  );

  return <UserBlockContext.Provider value={value}>{children}</UserBlockContext.Provider>;
};

export const useUserBlocks = () => {
  const context = useContext(UserBlockContext);
  if (!context) {
    return {
      blockedUsers: [],
      blockedUserIds: new Set(),
      blockedByUserIds: new Set(),
      loading: false,
      refreshBlockedUsers: async () => {},
      blockUser: async () => ({ success: false }),
      unblockUser: async () => ({ success: false }),
      isUserBlocked: () => false,
      isBlockedByUser: () => false,
      shouldHidePresence: () => false,
      resolvePresenceForUser: (_userId, fallbackStatus) => fallbackStatus,
    };
  }
  return context;
};
