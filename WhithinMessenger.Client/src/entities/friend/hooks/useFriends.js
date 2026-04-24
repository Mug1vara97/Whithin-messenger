import { useState, useEffect, useCallback, useRef } from 'react';
import { useConnectionContext } from '../../../shared/lib/contexts/ConnectionContext';
import { useAuth } from '../../../shared/lib/hooks/useAuth';
import { MEDIA_BASE_URL } from '../../../shared/lib/constants/apiEndpoints';

export const useFriends = () => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { getConnection } = useConnectionContext();
  const { user } = useAuth();
  const connectionRef = useRef(null);

  const getFriendConnection = useCallback(async () => {
    if (!user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (connectionRef.current) {
      return connectionRef.current;
    }

    const connection = await getConnection('friendhub', user.id);
    connectionRef.current = connection;
    return connection;
  }, [getConnection, user?.id]);

  const fetchFriends = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const connection = await getFriendConnection();
      const friendsData = await connection.invoke('GetFriends');

      const formattedFriends = friendsData.map(friend => ({
        ...friend,
        avatar: friend.avatar
          ? (friend.avatar.startsWith('http') ? friend.avatar : `${MEDIA_BASE_URL}${friend.avatar}`)
          : null
      }));

      setFriends(formattedFriends);
    } catch (err) {
      setError(err.message || 'Ошибка получения друзей');
      console.error('Error fetching friends:', err);
    } finally {
      setLoading(false);
    }
  }, [getFriendConnection]);

  const removeFriend = useCallback(async (friendId) => {
    try {
      const connection = await getFriendConnection();
      await connection.invoke('RemoveFriend', friendId);
      setFriends(prev => prev.filter(friend => friend.userId !== friendId));
    } catch (err) {
      setError(err.message || 'Ошибка удаления друга');
      console.error('Error removing friend:', err);
    }
  }, [getFriendConnection]);

  // Подписка на SignalR события друзей
  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;

    const setupRealtime = async () => {
      try {
        const connection = await getFriendConnection();
        if (!mounted) return;

        connection.on('FriendAdded', (data) => {
          console.log('FriendAdded event:', data);
          fetchFriends();
        });

        connection.on('FriendRemoved', (data) => {
          console.log('FriendRemoved event:', data);
          setFriends(prev => prev.filter(friend => friend.userId !== data.friendId));
        });

        connection.on('FriendRequestAccepted', (data) => {
          console.log('FriendRequestAccepted event:', data);
          fetchFriends();
        });

        console.log('Friends realtime subscriptions set up');
      } catch (err) {
        console.error('Error setting up friends realtime:', err);
      }
    };

    setupRealtime();

    return () => {
      mounted = false;
      if (connectionRef.current) {
        connectionRef.current.off('FriendAdded');
        connectionRef.current.off('FriendRemoved');
        connectionRef.current.off('FriendRequestAccepted');
      }
    };
  }, [user?.id, getFriendConnection, fetchFriends]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  return {
    friends,
    loading,
    error,
    fetchFriends,
    removeFriend
  };
};








