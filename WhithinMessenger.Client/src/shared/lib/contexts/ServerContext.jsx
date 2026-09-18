import React, { useState, useCallback, useRef, useEffect } from 'react';
import { HubConnectionState } from '@microsoft/signalr';
import { hasStartupBootCompleted } from '../startup/startupBoot';
import { ServerContext } from './ServerContext';
import { useConnectionContext } from './ConnectionContext';

export const ServerProvider = ({ children }) => {
  const connectionContext = useConnectionContext();
  const getSharedConnection = connectionContext?.getConnection;
  const acquireGroup = connectionContext?.acquireGroup;
  const subscribeReconnected = connectionContext?.onReconnected;
  const subscribeReconnecting = connectionContext?.onReconnecting;
  const subscribeClosed = connectionContext?.onClose;

  const [servers, setServers] = useState([]);
  const [publicServers, setPublicServers] = useState([]);
  const [initialServersLoaded, setInitialServersLoaded] = useState(() => hasStartupBootCompleted());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connection, setConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const connectionRef = useRef(null);
  const isConnectingRef = useRef(false);
  const attachedUserIdRef = useRef(null);
  /** Освобождение хендлеров/подписок/группы текущего attach. */
  const detachRef = useRef(null);

  const fetchServers = useCallback(async () => {
    const conn = connectionRef.current;
    if (!conn || conn.state !== HubConnectionState.Connected) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const serversData = await conn.invoke('GetUserServers');
      setServers(Array.isArray(serversData) ? serversData : []);
    } catch (err) {
      console.error('ServerContext: Error fetching servers via SignalR:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
      setInitialServersLoaded(true);
    }
  }, []);

  const detach = useCallback(() => {
    if (detachRef.current) {
      const fn = detachRef.current;
      detachRef.current = null;
      fn();
    }
    connectionRef.current = null;
    attachedUserIdRef.current = null;
    setConnection(null);
    setIsConnected(false);
  }, []);

  /**
   * Подключиться к общему хабу и подписаться на события списка серверов.
   * Имя сохранено для совместимости (HomePage вызывает createConnection(user.id)).
   */
  const createConnection = useCallback(async (userId) => {
    if (!userId || !getSharedConnection || !acquireGroup) return;
    if (isConnectingRef.current) return;
    if (attachedUserIdRef.current === String(userId) && connectionRef.current) return;

    isConnectingRef.current = true;
    try {
      detach();

      const conn = await getSharedConnection('hub', userId);

      const handleServerCreated = (serverData) => {
        setServers((prev) => {
          if (prev.some((server) => server.serverId === serverData.serverId)) {
            return prev;
          }
          return [...prev, serverData];
        });
        window.dispatchEvent(new CustomEvent('serverCreated', { detail: serverData }));
      };

      const handleServerJoined = (serverData) => {
        setServers((prev) => {
          if (prev.some((server) => server.serverId === serverData.serverId)) {
            return prev;
          }
          return [...prev, serverData];
        });
      };

      const handleYouWereAddedToServer = () => {
        void fetchServers();
      };

      const handleServerLeft = (serverId) => {
        setServers((prev) => prev.filter((server) => server.serverId !== serverId));
      };

      const handleServerDeleted = (serverId) => {
        setServers((prev) => prev.filter((server) => server.serverId !== serverId));
      };

      const handleServerListUpdated = () => {
        void fetchServers();
      };

      const handlers = [
        ['ServerCreated', handleServerCreated],
        ['ServerJoined', handleServerJoined],
        ['YouWereAddedToServer', handleYouWereAddedToServer],
        ['ServerLeft', handleServerLeft],
        ['ServerDeleted', handleServerDeleted],
        ['ServerListUpdated', handleServerListUpdated],
      ];
      for (const [eventName, handler] of handlers) {
        conn.on(eventName, handler);
      }

      const unsubscribers = [];
      if (subscribeReconnecting) {
        unsubscribers.push(subscribeReconnecting(() => setIsConnected(false)));
      }
      if (subscribeClosed) {
        unsubscribers.push(subscribeClosed(() => setIsConnected(false)));
      }
      if (subscribeReconnected) {
        unsubscribers.push(subscribeReconnected(() => {
          setIsConnected(true);
          void fetchServers();
        }));
      }

      // Группа serverlist:{userId} — переподписка после реконнекта в ConnectionContext.
      const releaseGroup = acquireGroup('serverlist', userId);

      detachRef.current = () => {
        for (const [eventName, handler] of handlers) {
          conn.off(eventName, handler);
        }
        for (const unsubscribe of unsubscribers) {
          unsubscribe();
        }
        releaseGroup();
      };

      connectionRef.current = conn;
      attachedUserIdRef.current = String(userId);
      setConnection(conn);
      setIsConnected(conn.state === HubConnectionState.Connected);

      await fetchServers();
    } catch (err) {
      console.error('ServerContext: Error connecting to hub (server list):', err);
      setError(err.message);
      setIsConnected(false);
      setInitialServersLoaded(true);
    } finally {
      isConnectingRef.current = false;
    }
  }, [acquireGroup, detach, fetchServers, getSharedConnection, subscribeClosed, subscribeReconnected, subscribeReconnecting]);

  useEffect(() => () => detach(), [detach]);

  useEffect(() => {
    console.log('ServerContext: Servers state updated:', servers);
  }, [servers]);

  const createServer = useCallback(async (serverData) => {
    if (!connectionRef.current) {
      throw new Error('SignalR connection not available');
    }

    try {
      setError(null);
      const newServer = await connectionRef.current.invoke('CreateServer', 
        serverData.serverName, 
        serverData.isPublic || false, 
        serverData.description || null
      );
      
      if (newServer) {
        setServers(prev => {
          const exists = prev.some(server => server.serverId === newServer.serverId);
          if (exists) {
            console.log('ServerContext: Server already exists in list, skipping addition');
            return prev;
          }
          console.log('ServerContext: Adding new server to list after creation:', newServer);
          return [...prev, newServer];
        });
      }
      
      return newServer;
    } catch (err) {
      console.error('ServerContext: Error creating server:', err);
      setError(err.message);
      throw err;
    }
  }, []);

  const updateServer = useCallback(async (serverId, serverData) => {
    if (!connectionRef.current) return;

    try {
      await connectionRef.current.invoke('UpdateServer', serverId, serverData);
    } catch (err) {
      console.error('ServerContext: Error updating server:', err);
      setError(err.message);
    }
  }, []);

  const deleteServer = useCallback(async (serverId) => {
    if (!connectionRef.current) return;

    try {
      await connectionRef.current.invoke('DeleteServer', serverId);
    } catch (err) {
      console.error('ServerContext: Error deleting server:', err);
      setError(err.message);
    }
  }, []);

  const leaveServer = useCallback(async (serverId) => {
    if (!connectionRef.current) return;

    try {
      await connectionRef.current.invoke('LeaveServer', serverId);
    } catch (err) {
      console.error('ServerContext: Error leaving server:', err);
      setError(err.message);
    }
  }, []);

  const reorderServers = useCallback(async (serverIds) => {
    if (!Array.isArray(serverIds) || serverIds.length === 0) return;

    // Optimistic reorder для моментального UX.
    setServers((prev) => {
      const byId = new Map(prev.map((server) => [server.serverId, server]));
      const reordered = serverIds
        .map((id) => byId.get(id))
        .filter(Boolean);

      // Добавляем хвостом серверы, которых нет в serverIds (защита от рассинхрона).
      const reorderedSet = new Set(serverIds);
      const untouched = prev.filter((server) => !reorderedSet.has(server.serverId));
      return [...reordered, ...untouched];
    });

    if (!connectionRef.current) return;

    try {
      await connectionRef.current.invoke('ReorderServers', serverIds);
    } catch (err) {
      // Не блокируем локальный reorder, даже если синхронизация не удалась.
      console.error('ServerContext: Error reordering servers:', err);
    }
  }, []);

  const fetchPublicServers = useCallback(async () => {
    if (!connectionRef.current) {
      console.log('ServerContext: No SignalR connection available for fetching public servers');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log('ServerContext: Fetching public servers via SignalR Hub');
      
      const publicServersData = await connectionRef.current.invoke('GetPublicServers');
      setPublicServers(publicServersData);
      console.log('ServerContext: Public servers loaded via SignalR:', publicServersData);
    } catch (err) {
      console.error('ServerContext: Error fetching public servers via SignalR:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const joinPublicServer = useCallback(async (serverId) => {
    if (!connectionRef.current) {
      throw new Error('SignalR connection not available');
    }

    try {
      setError(null);
      console.log('ServerContext: Attempting to join public server via SignalR Hub');
      
      const result = await connectionRef.current.invoke('JoinServer', serverId);
      
      if (result && result.message) {
        console.log('ServerContext: Successfully joined public server via SignalR');
        const updatedServers = await connectionRef.current.invoke('GetUserServers');
        setServers(updatedServers);
        console.log('ServerContext: Server list updated after joining server');
      } else {
        throw new Error('Ошибка при присоединении к серверу');
      }
      
      return result;
    } catch (err) {
      console.error('ServerContext: Error joining public server:', err);
      setError(err.message);
      throw err;
    }
  }, []);

  const isUserMember = useCallback((serverId) => {
    return servers.some(server => server.serverId === serverId);
  }, [servers]);

  const value = {
    servers,
    publicServers,
    initialServersLoaded,
    isLoading,
    error,
    connection,
    isConnected,
    createConnection,
    fetchServers,
    createServer,
    updateServer,
    deleteServer,
    leaveServer,
    reorderServers,
    fetchPublicServers,
    joinPublicServer,
    isUserMember
  };

  return (
    <ServerContext.Provider value={value}>
      {children}
    </ServerContext.Provider>
  );
};