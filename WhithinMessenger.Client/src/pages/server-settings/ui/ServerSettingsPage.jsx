import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { useAuthContext } from '../../../shared/lib/contexts/AuthContext';
import { BASE_URL, API_ENDPOINTS, HUB_ENDPOINTS } from '../../../shared/lib/constants/apiEndpoints';
import { RoleManagement } from '../../../widgets/role-management';
import { MemberManagement } from '../../../widgets/member-management';
import { ServerSettings } from '../../../widgets/server-settings';
import { Button } from '../../../shared/ui/atoms/Button';
import './ServerSettingsPage.css';

const ServerSettingsPage = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [server, setServer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [, setConnection] = useState(null);
  const connectionRef = useRef(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [userPermissions] = useState({});
  const [isServerOwner, setIsServerOwner] = useState(false);

  const initializeConnection = useCallback(async () => {
    if (!serverId || !user?.id) {
      console.warn('Missing serverId or user.id for connection initialization');
      return;
    }

    try {
      const newConnection = new HubConnectionBuilder()
        .withUrl(`${BASE_URL}${HUB_ENDPOINTS.SERVER_HUB}?userId=${user.id}`)
        .withAutomaticReconnect()
        .build();

      newConnection.onreconnected(async (connectionId) => {
        console.log('SignalR reconnected:', connectionId);
        try {
          await newConnection.invoke("JoinServerGroup", serverId);
          console.log('Rejoined server group after reconnect:', serverId);
        } catch (err) {
          console.error('Failed to rejoin server group:', err);
        }
      });

      await newConnection.start();
      console.log('Connected to ServerHub for settings');
      
      await newConnection.invoke("JoinServerGroup", serverId);
      console.log('Joined server group:', serverId);
      
      connectionRef.current = newConnection;
      setConnection(newConnection);

      newConnection.on('ServerUpdated', (updatedServer) => {
        console.log('Server updated:', updatedServer);
        setServer(updatedServer);
      });

      newConnection.on('Error', (errorMessage) => {
        console.error('SignalR Error:', errorMessage);
        setError(errorMessage);
      });

      return true;
    } catch (err) {
      console.error('Failed to initialize SignalR connection:', err);
      setError('Не удалось подключиться к серверу');
      return false;
    }
  }, [serverId, user?.id]);

  const fetchServerData = useCallback(async (retryCount = 0) => {
    if (!serverId) return;

    const maxRetries = 3;
    const retryDelay = 1000;

    try {
      setIsLoading(true);
      setError(null);

      if (connectionRef.current) {
        const serverInfo = await connectionRef.current.invoke("GetServerInfo", serverId);
        console.log('GetServerInfo response:', serverInfo);
        
        if (serverInfo && serverInfo.ownerId) {
          setServer(serverInfo);
          setIsServerOwner(serverInfo.ownerId === user?.id);
          setIsLoading(false);
        } else {
          console.warn('ServerInfo is null or missing ownerId:', serverInfo);
          
          if (retryCount < maxRetries) {
            console.log(`Retrying fetchServerData (attempt ${retryCount + 1}/${maxRetries})`);
            setTimeout(() => {
              fetchServerData(retryCount + 1);
            }, retryDelay);
            return;
          }
          
          setError('Сервер не найден или недоступен');
        }
      } else {
        console.warn('Connection not available for fetching server data');
        
        if (retryCount < maxRetries) {
          console.log(`Retrying fetchServerData due to no connection (attempt ${retryCount + 1}/${maxRetries})`);
          setTimeout(() => {
            fetchServerData(retryCount + 1);
          }, retryDelay);
          return;
        }
        
        setError('Соединение с сервером не установлено');
      }

    } catch (err) {
      console.error('Error fetching server data:', err);
      
      if (retryCount < maxRetries) {
        console.log(`Retrying fetchServerData due to error (attempt ${retryCount + 1}/${maxRetries})`);
        setTimeout(() => {
          fetchServerData(retryCount + 1);
        }, retryDelay);
        return;
      }
      
      setError('Не удалось загрузить данные сервера');
    } finally {
      if (retryCount >= maxRetries) {
        setIsLoading(false);
      }
    }
  }, [serverId, user?.id]);

  const handleServerUpdate = (updatedServer) => {
    setServer(updatedServer);
  };

  const handleNavigateToChat = (chatId) => {
    navigate(`/channels/@me/${chatId}`);
  };

  console.log('ServerSettingsPage - connectionRef.current:', connectionRef.current);
  console.log('ServerSettingsPage - serverId:', serverId);
  console.log('ServerSettingsPage - user:', user);

  useEffect(() => {
    const initializeAndFetch = async () => {
      try {
        const connectionSuccess = await initializeConnection();
        
        if (connectionSuccess && connectionRef.current) {
          setTimeout(() => {
            fetchServerData();
          }, 300);
        } else {
          setError('Не удалось установить соединение с сервером');
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to initialize and fetch:', err);
        setError('Ошибка инициализации');
        setIsLoading(false);
      }
    };

    initializeAndFetch();

    return () => {
      if (connectionRef.current) {
        connectionRef.current.stop();
      }
    };
  }, [serverId, user?.id]);

  if (isLoading) {
    return (
      <div className="server-settings-page">
        <div className="server-settings-loading">
          <div className="loading-spinner"></div>
          <h2>Загрузка настроек сервера...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="server-settings-page">
        <div className="server-settings-error">
          <h2>Ошибка загрузки</h2>
          <p>{error}</p>
          <Button 
            className="back-button"
            onClick={() => navigate(-1)}
          >
            ← Назад
          </Button>
        </div>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="server-settings-page">
        <div className="server-settings-error">
          <h2>Сервер не найден</h2>
          <p>Сервер с указанным ID не существует или у вас нет к нему доступа.</p>
          <Button 
            className="back-button"
            onClick={() => navigate(-1)}
          >
            ← Назад
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="server-settings-page">
      <div className="server-settings-sidebar">
        <div className="server-header">
          <div className="server-avatar">
            {server.avatar ? (
              <img 
                src={`${BASE_URL}${server.avatar}`}
                alt={server.name}
                className="avatar-image"
              />
            ) : (
              server.name?.charAt(0).toUpperCase() || 'С'
            )}
          </div>
          <h2 className="server-name">{server.name}</h2>
        </div>

        <nav className="settings-nav">
          <div className="nav-section">
            <button
              className={`settings-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2M21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 9H14V4H19V9Z"/>
              </svg>
              Профиль сервера
            </button>
          </div>

          <div className="nav-divider"></div>

          <div className="nav-section">
            <h3 className="nav-section-title">ЛЮДИ</h3>
            <button
              className={`settings-nav-item ${activeTab === 'members' ? 'active' : ''}`}
              onClick={() => setActiveTab('members')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 4C18.2 4 20 5.8 20 8S18.2 12 16 12 12 10.2 12 8 13.8 4 16 4M16 13C18.67 13 24 14.33 24 17V20H8V17C8 14.33 13.33 13 16 13M8 12C10.2 12 12 10.2 12 8S10.2 4 8 4 4 5.8 4 8 5.8 12 8 12M8 13C5.33 13 0 14.33 0 17V20H6V17C6 15.9 6.4 14.9 7 14.1C5.8 13.4 4.3 13 8 13Z"/>
              </svg>
              Участники
            </button>
            
            <button
              className={`settings-nav-item ${activeTab === 'roles' ? 'active' : ''}`}
              onClick={() => setActiveTab('roles')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2M21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 9H14V4H19V9Z"/>
              </svg>
              Роли
            </button>
          </div>

          <div className="nav-divider"></div>

          <div className="nav-section">
            <h3 className="nav-section-title">БЕЗОПАСНОСТЬ</h3>
            <button
              className={`settings-nav-item ${activeTab === 'audit-log' ? 'active' : ''}`}
              onClick={() => setActiveTab('audit-log')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
              </svg>
              Журнал аудита
            </button>
          </div>
          </nav>
        </div>

        <div className="server-settings-main">
        {activeTab === 'profile' && (
          <ServerSettings
            connection={connectionRef.current}
            serverId={serverId}
            userId={user?.id}
            server={server}
            onServerUpdate={handleServerUpdate}
            userPermissions={userPermissions}
            isServerOwner={isServerOwner}
          />
        )}

        {activeTab === 'roles' && (
          <RoleManagement
            connection={connectionRef.current}
            serverId={serverId}
            userId={user?.id}
            userPermissions={userPermissions}
            isServerOwner={isServerOwner}
          />
        )}

        {activeTab === 'members' && connectionRef.current && (
          <MemberManagement
            connection={connectionRef.current}
            serverId={serverId}
            userId={user?.id}
            userPermissions={userPermissions}
            isServerOwner={isServerOwner}
            onNavigateToChat={handleNavigateToChat}
          />
        )}

        {activeTab === 'audit-log' && (
          <div className="settings-content">
            <h1>Журнал аудита</h1>
            <p>Журнал аудита будет здесь</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(ServerSettingsPage);