import { useState, useEffect, useCallback, useRef } from 'react';
import { friendApi } from '../api';
import { useConnectionContext } from '../../../shared/lib/contexts/ConnectionContext';
import { useAuth } from '../../../shared/lib/hooks/useAuth';

export const useFriends = () => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { getConnection } = useConnectionContext();
  const { user } = useAuth();
  const connectionRef = useRef(null);

  const fetchFriends = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const friendsData = await friendApi.getFriends();
      setFriends(friendsData);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching friends:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const removeFriend = useCallback(async (friendId) => {
    try {
      await friendApi.removeFriend(friendId);
      setFriends(prev => prev.filter(friend => friend.userId !== friendId));
    } catch (err) {
      setError(err.message);
      console.error('Error removing friend:', err);
    }
  }, []);

  // Подписка на SignalR события друзей
  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;

    const setupRealtime = async () => {
      try {
        const connection = await getConnection('notificationhub', user.id);
        if (!mounted) return;
        
        connectionRef.current = connection;

        // FriendAdded - когда кто-то принял наш запрос или мы приняли чужой
        connection.on('FriendAdded', (data) => {
          console.log('FriendAdded event:', data);
          // Обновляем список друзей
          fetchFriends();
        });

        // FriendRemoved - когда друг удален
        connection.on('FriendRemoved', (data) => {
          console.log('FriendRemoved event:', data);
          setFriends(prev => prev.filter(friend => friend.userId !== data.friendId));
        });

        // FriendRequestAccepted - когда наш запрос принят
        connection.on('FriendRequestAccepted', (data) => {
          console.log('FriendRequestAccepted event:', data);
          // Обновляем список друзей
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
  }, [user?.id, getConnection, fetchFriends]);

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








