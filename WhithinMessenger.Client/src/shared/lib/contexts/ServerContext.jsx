import React, { useState, useCallback, useRef, useEffect } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { BASE_URL } from '../constants/apiEndpoints';
import { ServerContext } from './ServerContext';

export const ServerProvider = ({ children }) => {
  const [servers, setServers] = useState([]);
  const [publicServers, setPublicServers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connection, setConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const connectionRef = useRef(null);
  const isConnectingRef = useRef(false);
  const hasInitializedRef = useRef(false);

  const fetchServers = useCallback(async () => {
    if (!connectionRef.current) {
      console.log('ServerContext: No SignalR connection available for fetching servers');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log('ServerContext: Fetching servers via SignalR Hub');
      
      const serversData = await connectionRef.current.invoke('GetUserServers');
      setServers(serversData);
      console.log('ServerContext: Servers loaded via SignalR:', serversData);
    } catch (err) {
      console.error('ServerContext: Error fetching servers via SignalR:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createConnection = useCallback(async (userId) => {
    if (!userId) return;
    
    if (connectionRef.current && connectionRef.current.state === 'Connected') {
      console.log('ServerContext: Connection already exists and is connected, skipping...');
      return;
    }
    
    if (hasInitializedRef.current || connectionRef.current) {
      console.log('ServerContext: Connection already initialized or exists, skipping...');
      return;
    }

    const connectToServerList = async () => {
      if (isConnectingRef.current) return;
      
      try {
        isConnectingRef.current = true;
        hasInitializedRef.current = true;
        
        console.log('ServerContext: Creating SignalR connection to serverlisthub');
        const connection = new HubConnectionBuilder()
          .withUrl(`${BASE_URL}/serverlisthub?userId=${userId}`)
          .withAutomaticReconnect()
          .build();

        await connection.start();
        connectionRef.current = connection;
        setConnection(connection);
        setIsConnected(true);
        console.log('ServerContext: SignalR connection established for user:', userId);

        await connection.invoke('JoinServerListGroup');
        console.log('ServerContext: Joined server list group');

        connection.on('ServerCreated', (serverData) => {
          console.log('ServerContext: ServerCreated event received:', serverData);
          setServers(prev => {
            const exists = prev.some(server => server.serverId === serverData.serverId);
            if (exists) {
              console.log('ServerContext: Server already exists, skipping addition');
              return prev;
            }
            console.log('ServerContext: Adding new server to list:', serverData);
            return [...prev, serverData];
          });
          
          console.log('ServerContext: Server created, dispatching event:', serverData.serverId);
          window.dispatchEvent(new CustomEvent('serverCreated', { detail: serverData }));
        });

        connection.on('ServerJoined', (serverData) => {
          console.log('ServerContext: ServerJoined event received:', serverData);
          setServers(prev => {
            const exists = prev.some(server => server.serverId === serverData.serverId);
            if (exists) {
              console.log('ServerContext: Server already exists, skipping addition');
              return prev;
            }
            console.log('ServerContext: Adding server to list:', serverData);
            return [...prev, serverData];
          });
        });

        connection.on('YouWereAddedToServer', async (data) => {
          console.log('ServerContext: YouWereAddedToServer event received:', data);
          try {
            const updatedServers = await connection.invoke('GetUserServers');
            setServers(updatedServers);
            console.log('ServerContext: Server list updated after being added to server');
          } catch (err) {
            console.error('ServerContext: Error fetching updated server list:', err);
          }
        });

        connection.on('ServerLeft', async (serverId) => {
          console.log('ServerContext: ServerLeft event received:', serverId);
          setServers(prev => prev.filter(server => server.serverId !== serverId));
          console.log('ServerContext: Server removed from list');
        });

        connection.on('ServerDeleted', async (serverId) => {
          console.log('ServerContext: ServerDeleted event received:', serverId);
          console.log('ServerContext: Connection state:', connection.state);
          setServers(prev => {
            const filtered = prev.filter(server => server.serverId !== serverId);
            console.log('ServerContext: Servers after filtering:', filtered);
            return filtered;
          });
          console.log('ServerContext: Server removed from list');
        });

        connection.on('ServerListUpdated', async () => {
          console.log('ServerContext: ServerListUpdated event received, fetching updated servers');
          try {
            const updatedServers = await connection.invoke('GetUserServers');
            setServers(updatedServers);
            console.log('ServerContext: Server list updated after ServerListUpdated event');
          } catch (err) {
            console.error('ServerContext: Error fetching updated servers:', err);
          }
        });

        await fetchServers();

      } catch (err) {
        console.error('ServerContext: Error connecting to server list hub:', err);
        setError(err.message);
        setIsConnected(false);
      } finally {
        isConnectingRef.current = false;
      }
    };

    connectToServerList();
  }, [fetchServers]); // Возвращаем fetchServers, но мемоизируем его

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
    if (!connectionRef.current) return;

    try {
      await connectionRef.current.invoke('ReorderServers', serverIds);
    } catch (err) {
      console.error('ServerContext: Error reordering servers:', err);
      setError(err.message);
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

  useEffect(() => {
    return () => {
      if (connectionRef.current) {
        connectionRef.current.off('ServerCreated');
        connectionRef.current.off('ServerJoined');
        connectionRef.current.off('YouWereAddedToServer');
        connectionRef.current.off('ServerLeft');
        connectionRef.current.off('ServerDeleted');
        connectionRef.current.off('ServerListUpdated');
        
        connectionRef.current.stop();
        connectionRef.current = null;
      }
    };
  }, []);

  const value = {
    servers,
    publicServers,
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