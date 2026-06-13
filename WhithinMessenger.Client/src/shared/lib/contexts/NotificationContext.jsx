import React, { createContext, useContext } from 'react';
import { useNotifications as useNotificationsState } from '../../../entities/notification/hooks/useNotifications';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const value = useNotificationsState();

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }
  return context;
}
