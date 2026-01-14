import React from 'react';
import { AuthProvider } from '../../shared/lib/contexts/AuthContext';
import { ConnectionProvider } from '../../shared/lib/contexts/ConnectionContext';
import { ServerProvider } from '../../shared/lib/contexts/ServerContext.jsx';
import { CallProvider } from '../../shared/lib/contexts/CallContext';
import { useTokenRefresh } from '../../shared/lib/hooks/useTokenRefresh';

const AppProviders = ({ children }) => {
  // Инициализируем автоматическое обновление токенов
  useTokenRefresh();

  return (
    <ConnectionProvider>
      <AuthProvider>
        <ServerProvider>
          <CallProvider>
            {children}
          </CallProvider>
        </ServerProvider>
      </AuthProvider>
    </ConnectionProvider>
  );
};

export default AppProviders;
