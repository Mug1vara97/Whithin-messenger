import { useState, useCallback } from 'react';
import { UserStatus, UserRole } from '../../constants/userTypes';

export const useUser = () => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const updateUser = useCallback((userData) => {
    setUser(prevUser => ({
      ...prevUser,
      ...userData,
      lastSeen: new Date().toISOString()
    }));
  }, []);

  const setUserStatus = useCallback((status) => {
    setUser(prevUser => ({
      ...prevUser,
      status,
      lastSeen: new Date().toISOString()
    }));
  }, []);

  const clearUser = useCallback(() => {
    setUser(null);
  }, []);

  const isAuthenticated = user !== null;
  const isOnline = user?.status === UserStatus.ONLINE;
  const isAdmin = user?.role === UserRole.ADMIN;

  return {
    user,
    isLoading,
    isAuthenticated,
    isOnline,
    isAdmin,
    updateUser,
    setUserStatus,
    clearUser,
    setIsLoading
  };
};
