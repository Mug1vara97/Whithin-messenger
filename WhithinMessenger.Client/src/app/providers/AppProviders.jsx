import React from 'react';
import { AuthProvider } from '../../shared/lib/contexts/AuthContext';
import { ConnectionProvider } from '../../shared/lib/contexts/ConnectionContext';
import { ServerProvider } from '../../shared/lib/contexts/ServerContext.jsx';
import { CallProvider } from '../../shared/lib/contexts/CallContext';

const AppProviders = ({ children }) => {
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
