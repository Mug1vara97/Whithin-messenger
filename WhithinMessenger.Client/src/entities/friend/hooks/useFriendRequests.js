import { useState, useEffect, useCallback, useRef } from 'react';
import { useConnectionContext } from '../../../shared/lib/contexts/ConnectionContext';
import { useAuth } from '../../../shared/lib/hooks/useAuth';

export const useFriendRequests = () => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
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

  const fetchFriendRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const connection = await getFriendConnection();
      const requestsData = await connection.invoke('GetFriendRequests');
      setPendingRequests(requestsData.pendingRequests || []);
      setSentRequests(requestsData.sentRequests || []);
    } catch (err) {
      setError(err.message || 'Ошибка получения запросов в друзья');
      console.error('Error fetching friend requests:', err);
    } finally {
      setLoading(false);
    }
  }, [getFriendConnection]);

  const acceptRequest = useCallback(async (friendshipId) => {
    try {
      const connection = await getFriendConnection();
      await connection.invoke('AcceptFriendRequest', friendshipId);
      setPendingRequests(prev => prev.filter(req => req.id !== friendshipId));
    } catch (err) {
      setError(err.message || 'Ошибка принятия запроса');
      console.error('Error accepting friend request:', err);
    }
  }, [getFriendConnection]);

  const declineRequest = useCallback(async (friendshipId) => {
    try {
      const connection = await getFriendConnection();
      await connection.invoke('DeclineFriendRequest', friendshipId);
      setPendingRequests(prev => prev.filter(req => req.id !== friendshipId));
    } catch (err) {
      setError(err.message || 'Ошибка отклонения запроса');
      console.error('Error declining friend request:', err);
    }
  }, [getFriendConnection]);

  const sendRequest = useCallback(async (targetUserId) => {
    try {
      const connection = await getFriendConnection();
      await connection.invoke('SendFriendRequest', targetUserId);
      await fetchFriendRequests();
    } catch (err) {
      setError(err.message || 'Ошибка отправки запроса');
      console.error('Error sending friend request:', err);
    }
  }, [fetchFriendRequests, getFriendConnection]);

  // Подписка на SignalR события запросов в друзья
  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;

    const setupRealtime = async () => {
      try {
        const connection = await getFriendConnection();
        if (!mounted) return;

        connection.on('FriendRequestReceived', (data) => {
          console.log('FriendRequestReceived event:', data);
          fetchFriendRequests();
        });

        connection.on('FriendRequestDeclined', (data) => {
          console.log('FriendRequestDeclined event:', data);
          setSentRequests(prev => prev.filter(req => req.id !== data.requestId));
        });

        connection.on('FriendRequestAccepted', () => {
          fetchFriendRequests();
        });

        connection.on('FriendAdded', () => {
          fetchFriendRequests();
        });

        console.log('Friend requests realtime subscriptions set up');
      } catch (err) {
        console.error('Error setting up friend requests realtime:', err);
      }
    };

    setupRealtime();

    return () => {
      mounted = false;
      if (connectionRef.current) {
        connectionRef.current.off('FriendRequestReceived');
        connectionRef.current.off('FriendRequestDeclined');
        connectionRef.current.off('FriendRequestAccepted');
        connectionRef.current.off('FriendAdded');
      }
    };
  }, [user?.id, getFriendConnection, fetchFriendRequests]);

  useEffect(() => {
    fetchFriendRequests();
  }, [fetchFriendRequests]);

  return {
    pendingRequests,
    sentRequests,
    loading,
    error,
    fetchFriendRequests,
    acceptRequest,
    declineRequest,
    sendRequest
  };
};








