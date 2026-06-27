import React from 'react';
import { AuthProvider } from '../../shared/lib/contexts/AuthContext';
import { ConnectionProvider } from '../../shared/lib/contexts/ConnectionContext';
import { NotificationProvider } from '../../shared/lib/contexts/NotificationContext';
import { ServerProvider } from '../../shared/lib/contexts/ServerContext.jsx';
import { CallProvider } from '../../shared/lib/contexts/CallContext';
import { PresenceProvider } from '../../shared/lib/contexts/PresenceContext';
import { UserBlockProvider } from '../../shared/lib/contexts/UserBlockContext';
import { ProfileRealtimeProvider } from '../../shared/lib/contexts/ProfileRealtimeContext';
import { StartupBootProvider } from '../../shared/lib/contexts/StartupBootContext';
import { useTokenRefresh } from '../../shared/lib/hooks/useTokenRefresh';

const AppProviders = ({ children }) => {
  // Инициализируем автоматическое обновление токенов
  useTokenRefresh();

  return (
    <ConnectionProvider>
      <AuthProvider>
        <UserBlockProvider>
        <PresenceProvider>
          <ProfileRealtimeProvider>
          <NotificationProvider>
              <ServerProvider>
                <StartupBootProvider>
                  <CallProvider>
                    {children}
                  </CallProvider>
                </StartupBootProvider>
              </ServerProvider>
          </NotificationProvider>
          </ProfileRealtimeProvider>
        </PresenceProvider>
        </UserBlockProvider>
      </AuthProvider>
    </ConnectionProvider>
  );
};

export default AppProviders;
