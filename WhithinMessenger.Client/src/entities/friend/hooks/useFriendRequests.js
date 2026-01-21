import { useState, useEffect, useCallback, useRef } from 'react';
import { friendApi } from '../api';
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

  const fetchFriendRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const requestsData = await friendApi.getFriendRequests();
      setPendingRequests(requestsData.pendingRequests || []);
      setSentRequests(requestsData.sentRequests || []);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching friend requests:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const acceptRequest = useCallback(async (friendshipId) => {
    try {
      await friendApi.acceptFriendRequest(friendshipId);
      setPendingRequests(prev => prev.filter(req => req.id !== friendshipId));
    } catch (err) {
      setError(err.message);
      console.error('Error accepting friend request:', err);
    }
  }, []);

  const declineRequest = useCallback(async (friendshipId) => {
    try {
      await friendApi.declineFriendRequest(friendshipId);
      setPendingRequests(prev => prev.filter(req => req.id !== friendshipId));
    } catch (err) {
      setError(err.message);
      console.error('Error declining friend request:', err);
    }
  }, []);

  const sendRequest = useCallback(async (targetUserId) => {
    try {
      await friendApi.sendFriendRequest(targetUserId);
      await fetchFriendRequests();
    } catch (err) {
      setError(err.message);
      console.error('Error sending friend request:', err);
    }
  }, [fetchFriendRequests]);

  // Подписка на SignalR события запросов в друзья
  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;

    const setupRealtime = async () => {
      try {
        const connection = await getConnection('notificationhub', user.id);
        if (!mounted) return;
        
        connectionRef.current = connection;

        // FriendRequestReceived - когда получен новый запрос в друзья
        connection.on('FriendRequestReceived', (data) => {
          console.log('FriendRequestReceived event:', data);
          // Обновляем список запросов
          fetchFriendRequests();
        });

        // FriendRequestDeclined - когда наш запрос отклонен
        connection.on('FriendRequestDeclined', (data) => {
          console.log('FriendRequestDeclined event:', data);
          setSentRequests(prev => prev.filter(req => req.id !== data.requestId));
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
      }
    };
  }, [user?.id, getConnection, fetchFriendRequests]);

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








