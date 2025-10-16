import React from 'react';
import { AuthProvider } from '../../shared/lib/contexts/AuthContext';
import { ConnectionProvider } from '../../shared/lib/contexts/ConnectionContext';
import { ServerProvider } from '../../shared/lib/contexts/ServerContext.jsx';

const AppProviders = ({ children }) => {
  return (
    <ConnectionProvider>
      <AuthProvider>
        <ServerProvider>
          {children}
        </ServerProvider>
      </AuthProvider>
    </ConnectionProvider>
  );
};

export default AppProviders;
