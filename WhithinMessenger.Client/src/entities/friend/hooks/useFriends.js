import { useState, useEffect, useCallback, useRef } from 'react';
import { useConnectionContext } from '../../../shared/lib/contexts/ConnectionContext';
import { useAuthContext } from '../../../shared/lib/contexts/AuthContext';
import { PROFILE_UPDATED_EVENT } from '../../../shared/lib/contexts/ProfileModalContext';
import { patchFriendWithProfile } from '../../../shared/lib/utils/profilePatchHelpers';
import { normalizeFriend } from '../lib/friendHelpers';

export const useFriends = () => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { getConnection } = useConnectionContext();
  const { user } = useAuthContext();
  const connectionRef = useRef(null);

  const getFriendConnection = useCallback(async () => {
    if (!user?.id) {
      return null;
    }

    if (connectionRef.current) {
      return connectionRef.current;
    }

    const connection = await getConnection('friendhub', user.id);
    connectionRef.current = connection;
    return connection;
  }, [getConnection, user?.id]);

  const fetchFriends = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const connection = await getFriendConnection();
      if (!connection) {
        return;
      }
      const friendsData = await connection.invoke('GetFriends');

      const formattedFriends = (friendsData || [])
        .map(normalizeFriend)
        .filter(Boolean);

      setFriends(formattedFriends);
    } catch (err) {
      setError(err.message || 'Ошибка получения друзей');
      console.error('Error fetching friends:', err);
    } finally {
      setLoading(false);
    }
  }, [getFriendConnection, user?.id]);

  const removeFriend = useCallback(async (friendId) => {
    if (!user?.id) {
      return;
    }

    try {
      const connection = await getFriendConnection();
      if (!connection) {
        return;
      }
      await connection.invoke('RemoveFriend', friendId);
      setFriends(prev => prev.filter(friend => friend.userId !== friendId));
    } catch (err) {
      setError(err.message || 'Ошибка удаления друга');
      console.error('Error removing friend:', err);
    }
  }, [getFriendConnection, user?.id]);

  // Подписка на SignalR события друзей
  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;
    let unbind = null;

    const handleFriendAdded = () => {
      fetchFriends();
    };
    const handleFriendRemoved = (data) => {
      setFriends(prev => prev.filter(friend => friend.userId !== data.friendId));
    };
    const handleFriendRequestAccepted = () => {
      fetchFriends();
    };

    const setupRealtime = async () => {
      try {
        const connection = await getFriendConnection();
        if (!mounted || !connection) return;

        connection.on('FriendAdded', handleFriendAdded);
        connection.on('FriendRemoved', handleFriendRemoved);
        connection.on('FriendRequestAccepted', handleFriendRequestAccepted);

        // Соединение общее — снимаем только свои хендлеры (по ссылке).
        unbind = () => {
          connection.off('FriendAdded', handleFriendAdded);
          connection.off('FriendRemoved', handleFriendRemoved);
          connection.off('FriendRequestAccepted', handleFriendRequestAccepted);
        };
      } catch (err) {
        console.error('Error setting up friends realtime:', err);
      }
    };

    setupRealtime();

    return () => {
      mounted = false;
      if (unbind) unbind();
    };
  }, [user?.id, getFriendConnection, fetchFriends]);

  useEffect(() => {
    const handleProfileUpdated = (event) => {
      const patch = event.detail;
      if (!patch?.userId) {
        return;
      }

      setFriends((prev) => prev.map((friend) => patchFriendWithProfile(friend, patch)));
    };

    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetchFriends();
  }, [fetchFriends, user?.id]);

  return {
    friends,
    loading,
    error,
    fetchFriends,
    removeFriend
  };
};








