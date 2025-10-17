import { useState, useEffect, useCallback } from 'react';
import { friendApi } from '../api';

export const useFriendRequests = () => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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








