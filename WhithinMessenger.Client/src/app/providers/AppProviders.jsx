import React from 'react';
import { AuthProvider } from '../../shared/lib/contexts/AuthContext';
import { ConnectionProvider } from '../../shared/lib/contexts/ConnectionContext';
import { NotificationProvider } from '../../shared/lib/contexts/NotificationContext';
import { ServerProvider } from '../../shared/lib/contexts/ServerContext.jsx';
import { CallProvider } from '../../shared/lib/contexts/CallContext';
import { ProfileModalProvider } from '../../shared/lib/contexts/ProfileModalContext';
import { PresenceProvider } from '../../shared/lib/contexts/PresenceContext';
import { useTokenRefresh } from '../../shared/lib/hooks/useTokenRefresh';

const AppProviders = ({ children }) => {
  // Инициализируем автоматическое обновление токенов
  useTokenRefresh();

  return (
    <ConnectionProvider>
      <AuthProvider>
        <PresenceProvider>
          <NotificationProvider>
            <ProfileModalProvider>
              <ServerProvider>
                <CallProvider>
                  {children}
                </CallProvider>
              </ServerProvider>
            </ProfileModalProvider>
          </NotificationProvider>
        </PresenceProvider>
      </AuthProvider>
    </ConnectionProvider>
  );
};

export default AppProviders;
