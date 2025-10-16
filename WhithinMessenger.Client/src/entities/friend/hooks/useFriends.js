import { useState, useEffect, useCallback } from 'react';
import { friendApi } from '../api';

export const useFriends = () => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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








