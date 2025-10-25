import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { BASE_URL } from '../constants/apiEndpoints';
import tokenManager from '../services/tokenManager';

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

  const getConnection = useCallback(async (hubName, userId) => {
    const connectionKey = `${hubName}_${userId}`;
    
    // Проверяем существующее подключение
    if (connectionRefs.current[connectionKey]) {
      const existingConnection = connectionRefs.current[connectionKey];
      if (existingConnection.state === 'Connected' || existingConnection.state === 'Connecting') {
        console.log(`Connection ${connectionKey} already exists with state ${existingConnection.state}, returning existing connection`);
        return existingConnection;
      } else {
        // Подключение существует, но не активно - закрываем его
        console.log(`Connection ${connectionKey} exists but not active (state: ${existingConnection.state}), closing it`);
        try {
          await existingConnection.stop();
        } catch (error) {
          console.error(`Error stopping existing connection ${connectionKey}:`, error);
        }
        delete connectionRefs.current[connectionKey];
      }
    }

    // Проверяем, не создается ли уже подключение
    if (pendingConnections.current.has(connectionKey)) {
      console.log(`Connection ${connectionKey} is already being created, waiting...`);
      // Ждем завершения создания подключения
      while (pendingConnections.current.has(connectionKey)) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      // Возвращаем созданное подключение
      if (connectionRefs.current[connectionKey]) {
        return connectionRefs.current[connectionKey];
      }
    }

    // Создаем новое подключение
    console.log(`Creating new connection for ${connectionKey}`);
    pendingConnections.current.add(connectionKey);

    try {
      // Получаем JWT токен для аутентификации
      const token = tokenManager.getToken();
      const isValid = tokenManager.isTokenValid();
      console.log(`ConnectionContext: Token for ${hubName}:`, token ? 'Token exists' : 'No token');
      console.log(`ConnectionContext: Token valid:`, isValid);
      
      const url = token && isValid 
        ? `${BASE_URL}/${hubName}?userId=${userId}&access_token=${token}`
        : `${BASE_URL}/${hubName}?userId=${userId}`;
      
      console.log(`ConnectionContext: SignalR URL:`, url);

      const connection = new HubConnectionBuilder()
        .withUrl(url)
        .withAutomaticReconnect()
        .build();

      await connection.start();
      connectionRefs.current[connectionKey] = connection;
      setConnections(prev => ({ ...prev, [connectionKey]: connection }));
      console.log(`Connection ${connectionKey} established successfully`);
      return connection;
    } catch (error) {
      console.error(`Error establishing connection ${connectionKey}:`, error);
      throw error;
    } finally {
      pendingConnections.current.delete(connectionKey);
    }
  }, []);

  const closeConnection = useCallback(async (hubName, userId) => {
    const connectionKey = `${hubName}_${userId}`;
    if (connectionRefs.current[connectionKey]) {
      try {
        await connectionRefs.current[connectionKey].stop();
        console.log(`Connection ${connectionKey} stopped successfully`);
      } catch (error) {
        console.error(`Error stopping connection ${connectionKey}:`, error);
      } finally {
        delete connectionRefs.current[connectionKey];
        setConnections(prev => {
          const newConnections = { ...prev };
          delete newConnections[connectionKey];
          return newConnections;
        });
      }
    }
  }, []);

  // Cleanup connections on unmount
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
    <ConnectionContext.Provider value={{ getConnection, closeConnection, connections }}>
      {children}
    </ConnectionContext.Provider>
  );
};