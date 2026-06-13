import React from 'react';
import { AuthProvider } from '../../shared/lib/contexts/AuthContext';
import { ConnectionProvider } from '../../shared/lib/contexts/ConnectionContext';
import { NotificationProvider } from '../../shared/lib/contexts/NotificationContext';
import { ServerProvider } from '../../shared/lib/contexts/ServerContext.jsx';
import { CallProvider } from '../../shared/lib/contexts/CallContext';
import { ProfileModalProvider } from '../../shared/lib/contexts/ProfileModalContext';
import { useTokenRefresh } from '../../shared/lib/hooks/useTokenRefresh';

const AppProviders = ({ children }) => {
  // Инициализируем автоматическое обновление токенов
  useTokenRefresh();

  return (
    <ConnectionProvider>
      <AuthProvider>
        <NotificationProvider>
          <ProfileModalProvider>
            <ServerProvider>
              <CallProvider>
                {children}
              </CallProvider>
            </ServerProvider>
          </ProfileModalProvider>
        </NotificationProvider>
      </AuthProvider>
    </ConnectionProvider>
  );
};

export default AppProviders;
