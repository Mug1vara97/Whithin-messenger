import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HubConnectionBuilder } from '@microsoft/signalr';
import {
  ArrowBack,
  Badge,
  Description,
  People,
  Security,
} from '@mui/icons-material';
import { useAuthContext } from '../../../shared/lib/contexts/AuthContext';
import { BASE_URL, API_ENDPOINTS, HUB_ENDPOINTS } from '../../../shared/lib/constants/apiEndpoints';
import { RoleManagement } from '../../../widgets/role-management';
import { MemberManagement } from '../../../widgets/member-management';
import { ServerSettings } from '../../../widgets/server-settings';
import { AuditLogPanel } from '../../../widgets/audit-log';
import { Button } from '../../../shared/ui/atoms/Button';
import { canManageRoles, canManageServer } from '../../../entities/role/lib/serverPermissions';
import './ServerSettingsPage.css';

const TAB_META = {
  profile: {
    title: 'Профиль сервера',
    description: 'Название, значок и баннер — то, как сервер выглядит для участников.',
  },
  members: {
    title: 'Участники',
    description: 'Список участников сервера, роли и действия с ними.',
  },
  roles: {
    title: 'Роли',
    description: 'Создавайте роли и настраивайте права доступа.',
  },
  'audit-log': {
    title: 'Журнал аудита',
    description: 'История изменений на сервере.',
  },
};

const ServerSettingsPage = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [server, setServer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [, setConnection] = useState(null);
  const connectionRef = useRef(null);
  const [activeTab, setActiveTab] = useState('members');
  const [userPermissions, setUserPermissions] = useState({});
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

      newConnection.on('UserPermissionsUpdated', (updatedUserId, permissions) => {
        if (String(updatedUserId) === String(user?.id)) {
          setUserPermissions(permissions || {});
        }
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
          setUserPermissions(serverInfo.permissions || {});
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

  const userCanManageServer = canManageServer(userPermissions, isServerOwner);
  const userCanManageRoles = canManageRoles(userPermissions, isServerOwner);

  useEffect(() => {
    if (activeTab === 'profile' && !userCanManageServer) {
      setActiveTab('members');
    } else if (activeTab === 'roles' && !userCanManageRoles) {
      setActiveTab('members');
    } else if (activeTab === 'audit-log' && !userCanManageServer) {
      setActiveTab('members');
    }
  }, [activeTab, userCanManageServer, userCanManageRoles]);

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

  const handleBackToServer = () => {
    navigate(`/server/${serverId}`);
  };

  const pageMeta = TAB_META[activeTab] || TAB_META.members;

  return (
    <div className="server-settings-page">
      <aside className="server-settings-sidebar">
        <div className="server-header">
          <div className="server-avatar">
            {server.avatar ? (
              <img 
                src={`${BASE_URL}${server.avatar}`}
                alt={server.name}
                className="avatar-image"
                onError={(e) => {
                  // Если аватар не загрузился, показываем инициалы
                  e.target.style.display = 'none';
                  const parent = e.target.parentElement;
                  if (parent && !parent.querySelector('.avatar-fallback')) {
                    const fallback = document.createElement('span');
                    fallback.className = 'avatar-fallback';
                    fallback.textContent = server.name?.charAt(0)?.toUpperCase() || 'С';
                    parent.appendChild(fallback);
                  }
                }}
              />
            ) : (
              server.name?.charAt(0).toUpperCase() || 'С'
            )}
          </div>
          <h2 className="server-name">{server.name}</h2>
        </div>

        <button
          type="button"
          className="back-to-server-btn"
          onClick={handleBackToServer}
        >
          <ArrowBack />
          Вернуться на сервер
        </button>

        <nav className="settings-nav">
          {userCanManageServer && (
            <div className="nav-section">
              <h3 className="nav-section-title">Сервер</h3>
              <button
                type="button"
                className={`settings-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                <Badge />
                Профиль сервера
              </button>
            </div>
          )}

          <div className="nav-section">
            <h3 className="nav-section-title">Люди</h3>
            <button
              type="button"
              className={`settings-nav-item ${activeTab === 'members' ? 'active' : ''}`}
              onClick={() => setActiveTab('members')}
            >
              <People />
              Участники
            </button>
            {userCanManageRoles && (
              <button
                type="button"
                className={`settings-nav-item ${activeTab === 'roles' ? 'active' : ''}`}
                onClick={() => setActiveTab('roles')}
              >
                <Security />
                Роли
              </button>
            )}
          </div>

          {userCanManageServer && (
            <div className="nav-section">
              <h3 className="nav-section-title">Безопасность</h3>
              <button
                type="button"
                className={`settings-nav-item ${activeTab === 'audit-log' ? 'active' : ''}`}
                onClick={() => setActiveTab('audit-log')}
              >
                <Description />
                Журнал аудита
              </button>
            </div>
          )}
        </nav>
      </aside>

      <div className="server-settings-main">
        {activeTab !== 'roles' && (
        <header className="server-settings-page-header">
          <h1>{pageMeta.title}</h1>
        </header>
        )}

        <div className="server-settings-scroll">
        {activeTab === 'profile' && userCanManageServer && (
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

        {activeTab === 'roles' && userCanManageRoles && (
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

        {activeTab === 'audit-log' && userCanManageServer && connectionRef.current && (
          <AuditLogPanel connection={connectionRef.current} serverId={serverId} />
        )}
        </div>
      </div>
    </div>
  );
};

export default memo(ServerSettingsPage);