import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { serverApi } from '../api';
import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import { HubConnectionBuilder } from '@microsoft/signalr';

export const useServers = (userId, onServerSelected = null, selectedServerId = null) => {
  const navigate = useNavigate();
  const [servers, setServers] = useState([]);
  const [publicServers, setPublicServers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connection, setConnection] = useState(null);
  
  const connectionRef = useRef(null);
  const isConnectingRef = useRef(false);
  const hasInitializedRef = useRef(false);

  const fetchServers = useCallback(async () => {
    if (!userId) return;

    try {
      console.log('useServers: Fetching servers via HTTP API');
      setIsLoading(true);
      setError(null);
      
      const serversData = await serverApi.getUserServers(userId);
      setServers(serversData);
    } catch (err) {
      console.error('Error fetching servers:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || hasInitializedRef.current || connectionRef.current) return;

    const connectToServerList = async () => {
      if (isConnectingRef.current) return;
      
      try {
        isConnectingRef.current = true;
        hasInitializedRef.current = true;
        
        console.log('useServers: Creating SignalR connection to serverlisthub');
        const connection = new HubConnectionBuilder()
          .withUrl(`${BASE_URL}/serverlisthub?userId=${userId}`)
          .withAutomaticReconnect()
          .build();

        await connection.start();
        connectionRef.current = connection;
        setConnection(connection);
        setIsConnected(true);
        console.log('useServers: SignalR connection established for user:', userId);

        await connection.invoke('JoinServerListGroup');
        console.log('useServers: Joined server list group');

        connection.on('ServerJoined', (serverData) => {
          console.log('useServers: ServerJoined event received:', serverData);
          setServers(prev => {
            const exists = prev.some(server => server.serverId === serverData.serverId);
            if (!exists) {
              console.log('useServers: Adding joined server to list smoothly:', serverData);
              return [...prev, serverData];
            }
            console.log('useServers: Server already exists in list');
            return prev;
          });
        });

        connection.on('YouWereAddedToServer', async (data) => {
          console.log('useServers: YouWereAddedToServer event received:', data);
          console.log('useServers: Current servers before update:', servers);
          
          try {
            const serversData = await serverApi.getUserServers(userId);
            console.log('useServers: Fetched updated servers:', serversData);
            setServers(serversData);
            console.log('useServers: Server list updated after being added to server');
          } catch (err) {
            console.error('useServers: Error updating server list after being added:', err);
            fetchServers();
          }
        });

        connection.on('ServerListUpdated', async () => {
          console.log('useServers: ServerListUpdated event received - getting updated server list');
          try {
            const serversData = await serverApi.getUserServers(userId);
            setServers(serversData);
            console.log('useServers: Server list updated smoothly');
          } catch (err) {
            console.error('useServers: Error updating server list:', err);
            fetchServers();
          }
        });

        connection.on('ServerLeft', async (serverId) => {
          console.log('useServers: ServerLeft event received:', serverId);
          setServers(prev => prev.filter(server => server.serverId !== serverId));
          console.log('useServers: Server removed from list');
          setTimeout(() => {
            navigate('/channels/@me');
          }, 100);
        });

        connection.on('ServerDeleted', async (serverId) => {
          console.log('useServers: ServerDeleted event received:', serverId);
          console.log('useServers: Connection state:', connection.state);
          console.log('useServers: Current servers before deletion:', servers);
          setServers(prev => {
            const filtered = prev.filter(server => server.serverId !== serverId);
            console.log('useServers: Servers after filtering:', filtered);
            return filtered;
          });
          console.log('useServers: Server removed from list');
          setTimeout(() => {
            console.log('useServers: Navigating to /channels/@me');
            navigate('/channels/@me');
          }, 100);
        });

        connection.on('UserServersLoaded', (serversData) => {
          console.log('useServers: UserServersLoaded event received:', serversData);
          setServers(serversData);
        });

        connection.onreconnecting(() => {
          console.log('useServers: SignalR reconnecting...');
        });

        connection.on('YouWereAddedToServer', (data) => {
          console.log('useServers: YouWereAddedToServer received (general handler):', data);
        });

        connection.on('*', (eventName, ...args) => {
          console.log('useServers: Received SignalR event:', eventName, args);
        });

        connection.onreconnected(() => {
          console.log('useServers: SignalR reconnected');
        });

        connection.onclose(() => {
          console.log('useServers: SignalR connection closed');
          setIsConnected(false);
        });

        connection.on('Error', (errorMessage) => {
          console.error('useServers: SignalR Error:', errorMessage);
          setError(errorMessage);
        });

        await fetchServers();

      } catch (err) {
        console.error('useServers: SignalR connection failed:', err);
        setConnection(null);
        setIsConnected(false);
        await fetchServers();
      } finally {
        isConnectingRef.current = false;
      }
    };

    connectToServerList();

    return () => {
      if (connectionRef.current) {
        console.log('useServers: Cleaning up SignalR connection');
        connectionRef.current.off('YouWereAddedToServer');
        connectionRef.current.off('ServerListUpdated');
        connectionRef.current.off('ServerLeft');
        connectionRef.current.off('ServerDeleted');
        connectionRef.current.off('UserServersLoaded');
        connectionRef.current.stop();
        connectionRef.current = null;
        setConnection(null);
        setIsConnected(false);
      }
    };
  }, [userId]);

  const createServer = useCallback(async (serverData) => {
    if (!userId || !connectionRef.current) {
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
            console.log('useServers: Server already exists in list, skipping addition');
            return prev;
          }
          console.log('useServers: Adding new server to list after creation:', newServer);
          return [...prev, newServer];
        });
      }
      
      return newServer;
    } catch (err) {
      console.error('Error creating server:', err);
      setError(err.message);
      throw err;
    }
  }, [userId]);

  const updateServer = useCallback(async (serverId, serverData) => {
    if (!userId) return;

    try {
      setError(null);
      const updatedServer = await serverApi.updateServer(serverId, serverData);
      setServers(prev => prev.map(server => 
        server.serverId === serverId ? updatedServer : server
      ));
      return updatedServer;
    } catch (err) {
      console.error('Error updating server:', err);
      setError(err.message);
      throw err;
    }
  }, [userId]);

  const deleteServer = useCallback(async (serverId) => {
    if (!userId) return;

    try {
      setError(null);
      await serverApi.deleteServer(serverId);
      setServers(prev => prev.filter(server => server.serverId !== serverId));
    } catch (err) {
      console.error('Error deleting server:', err);
      setError(err.message);
      throw err;
    }
  }, [userId]);

  const joinServer = useCallback(async (serverId) => {
    if (!userId) return;

    try {
      setError(null);
      const serverData = await serverApi.joinServer(serverId, userId);
      
      setServers(prev => {
        const exists = prev.some(server => server.serverId === serverId);
        if (!exists) {
          console.log('joinServer: Adding server locally:', serverData);
          return [...prev, serverData];
        }
        return prev;
      });
      
      if (connectionRef.current && connectionRef.current.state === 'Connected') {
        try {
          await connectionRef.current.invoke('NotifyServerListUpdated');
          console.log('joinServer: Notified server list updated via SignalR');
        } catch (signalrErr) {
          console.warn('joinServer: SignalR notification failed:', signalrErr);
        }
      }
      
      return serverData;
    } catch (err) {
      console.error('Error joining server:', err);
      setError(err.message);
      throw err;
    }
  }, [userId]);

  const leaveServer = useCallback(async (serverId) => {
    if (!userId) return;

    try {
      setError(null);
      await serverApi.leaveServer(serverId, userId);
      setServers(prev => prev.filter(server => server.serverId !== serverId));
    } catch (err) {
      console.error('Error leaving server:', err);
      setError(err.message);
      throw err;
    }
  }, [userId]);

  const reorderServers = useCallback(async (serverIds) => {
    if (!userId || !connectionRef.current) return;

    try {
      setError(null);
      await connectionRef.current.invoke('ReorderServers', serverIds);
      setServers(prev => {
        const reorderedServers = serverIds.map(id => 
          prev.find(server => server.serverId === id)
        ).filter(Boolean);
        return reorderedServers;
      });
    } catch (err) {
      console.error('Error reordering servers:', err);
      setError(err.message);
      throw err;
    }
  }, [userId]);

  const fetchPublicServers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${BASE_URL}/api/server/public`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch public servers');
      }
      
      const data = await response.json();
      setPublicServers(data);
    } catch (err) {
      console.error('Error fetching public servers:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const joinPublicServer = useCallback(async (serverId) => {
    console.log('joinPublicServer: userId =', userId);
    if (!userId) {
      throw new Error('User must be logged in to join a server');
    }

    try {
      setError(null);
      
      const response = await fetch(`${BASE_URL}/api/server/${serverId}/join`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to join server');
      }
      
      const serverData = await response.json();
      console.log('joinPublicServer: Server joined successfully:', serverData);
      
      setServers(prev => {
        const exists = prev.some(server => server.serverId === serverId);
        if (!exists) {
          console.log('joinPublicServer: Adding server locally:', serverData);
          return [...prev, serverData];
        }
        return prev;
      });
      
      if (connectionRef.current && connectionRef.current.state === 'Connected') {
        try {
          await connectionRef.current.invoke('NotifyServerListUpdated');
          console.log('joinPublicServer: Notified server list updated via SignalR');
        } catch (signalrErr) {
          console.warn('joinPublicServer: SignalR notification failed:', signalrErr);
        }
      }
      
      return true;
    } catch (err) {
      console.error('Error joining server:', err);
      setError(err.message);
      throw err;
    }
  }, [userId]);

  const isUserMember = useCallback((serverId) => {
    return servers.some(server => server.serverId === serverId);
  }, [servers]);

  return {
    servers,
    publicServers,
    isLoading,
    error,
    isConnected,
    connection,
    fetchServers,
    createServer,
    updateServer,
    deleteServer,
    joinServer,
    leaveServer,
    reorderServers,
    fetchPublicServers,
    joinPublicServer,
    isUserMember
  };
};