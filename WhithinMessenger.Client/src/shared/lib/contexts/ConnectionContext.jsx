import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { BASE_URL } from '../constants/apiEndpoints';
import tokenManager from '../services/tokenManager';
import {
  SIGNALR_RECONNECT_DELAYS_MS,
  ensureHubStarted,
  isHubUsable,
  subscribeNetworkRecovery,
} from '../signalr/reconnectPolicy';

const ConnectionContext = createContext();

export const useConnectionContext = () => {
  const context = useContext(ConnectionContext);
  if (!context) {
    console.warn('useConnectionContext must be used within a ConnectionProvider, returning null');
    return null;
  }
  return context;
};

export const ConnectionProvider = ({ children }) => {
  const [connections, setConnections] = useState({});
  const connectionRefs = useRef({});
  const pendingConnections = useRef(new Set());
  const restartingKeys = useRef(new Set());

  const restartConnectionIfNeeded = useCallback(async (connectionKey) => {
    const connection = connectionRefs.current[connectionKey];
    if (!connection || restartingKeys.current.has(connectionKey)) return;

    if (connection.state === HubConnectionState.Connected) return;
    if (connection.state === HubConnectionState.Connecting
      || connection.state === HubConnectionState.Reconnecting) {
      return;
    }

    restartingKeys.current.add(connectionKey);
    try {
      await ensureHubStarted(connection, connectionKey);
    } finally {
      restartingKeys.current.delete(connectionKey);
    }
  }, []);

  const recoverAllConnections = useCallback(async () => {
    const keys = Object.keys(connectionRefs.current);
    await Promise.all(keys.map((key) => restartConnectionIfNeeded(key)));
  }, [restartConnectionIfNeeded]);

  const getConnection = useCallback(async (hubName, userId) => {
    const connectionKey = `${hubName}_${userId}`;

    if (connectionRefs.current[connectionKey]) {
      const existingConnection = connectionRefs.current[connectionKey];
      if (isHubUsable(existingConnection)) {
        return existingConnection;
      }

      if (existingConnection.state === HubConnectionState.Disconnected) {
        const restarted = await ensureHubStarted(existingConnection, connectionKey);
        if (restarted) {
          return existingConnection;
        }
      }

      try {
        await existingConnection.stop();
      } catch (error) {
        console.error(`Error stopping existing connection ${connectionKey}:`, error);
      }
      delete connectionRefs.current[connectionKey];
      setConnections((prev) => {
        const next = { ...prev };
        delete next[connectionKey];
        return next;
      });
    }

    if (pendingConnections.current.has(connectionKey)) {
      while (pendingConnections.current.has(connectionKey)) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (connectionRefs.current[connectionKey]) {
        return connectionRefs.current[connectionKey];
      }
    }

    pendingConnections.current.add(connectionKey);

    try {
      const url = `${BASE_URL}/${hubName}?userId=${userId}`;

      const connection = new HubConnectionBuilder()
        .withUrl(url, {
          accessTokenFactory: () => tokenManager.getToken() || '',
        })
        .withAutomaticReconnect(SIGNALR_RECONNECT_DELAYS_MS)
        .configureLogging(LogLevel.Error)
        .build();

      connection.onclose(() => {
        // VPN / network drop after retries exhausted — try again when possible.
        window.setTimeout(() => {
          void restartConnectionIfNeeded(connectionKey);
        }, 1500);
      });

      await connection.start();
      connectionRefs.current[connectionKey] = connection;

      if (hubName.toLowerCase() === 'chatlisthub') {
        connection.on('chatunreadupdated', () => {});
      }

      setConnections((prev) => ({ ...prev, [connectionKey]: connection }));
      return connection;
    } catch (error) {
      console.error(`Error establishing connection ${connectionKey}:`, error);
      throw error;
    } finally {
      pendingConnections.current.delete(connectionKey);
    }
  }, [restartConnectionIfNeeded]);

  const closeConnection = useCallback(async (hubName, userId) => {
    const connectionKey = `${hubName}_${userId}`;
    if (connectionRefs.current[connectionKey]) {
      try {
        await connectionRefs.current[connectionKey].stop();
      } catch (error) {
        console.error(`Error stopping connection ${connectionKey}:`, error);
      } finally {
        delete connectionRefs.current[connectionKey];
        setConnections((prev) => {
          const next = { ...prev };
          delete next[connectionKey];
          return next;
        });
      }
    }
  }, []);

  useEffect(() => {
    return subscribeNetworkRecovery(() => {
      void recoverAllConnections();
    });
  }, [recoverAllConnections]);

  useEffect(() => {
    return () => {
      for (const key in connectionRefs.current) {
        if (connectionRefs.current[key]) {
          connectionRefs.current[key].stop();
        }
      }
    };
  }, []);

  return (
    <ConnectionContext.Provider
      value={{ getConnection, closeConnection, connections, recoverAllConnections }}
    >
      {children}
    </ConnectionContext.Provider>
  );
};
