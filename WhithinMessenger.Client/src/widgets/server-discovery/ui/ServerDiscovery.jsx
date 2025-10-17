import React, { useState, useEffect, useCallback } from 'react';
import { ServerIcon } from '../../../shared/ui';
import { useServerContext } from '../../../shared/lib/contexts/useServerContext';
import { useAuthContext } from '../../../shared/lib/contexts/AuthContext';
import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import './ServerDiscovery.css';

const ServerDiscovery = ({ onServerSelected, onClose }) => {
  const { user } = useAuthContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredServers, setFilteredServers] = useState([]);
  const [joiningServer, setJoiningServer] = useState(null);
  
  const {
    publicServers,
    isLoading,
    error,
    joinPublicServer,
    isUserMember,
    fetchPublicServers
  } = useServerContext();
  
  useEffect(() => {
    console.log('ServerDiscovery: user =', user);
    console.log('ServerDiscovery: user.id =', user?.id);
    fetchPublicServers();
  }, [fetchPublicServers, user]);

  useEffect(() => {
    if (!publicServers) return;
    
    const filtered = publicServers.filter(server => {
      const matchesSearch = searchQuery === '' || 
        server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (server.description && server.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesSearch;
    });
    
    setFilteredServers(filtered);
  }, [publicServers, searchQuery]);

  useEffect(() => {
    if (publicServers.length === 0) {
      
    }
  }, [publicServers]);

  const handleJoinServer = useCallback(async (server) => {
    try {
      setJoiningServer(server.serverId);
      await joinPublicServer(server.serverId);
      console.log('ServerDiscovery: Successfully joined server:', server.serverId);
      
      if (onServerSelected) {
        onServerSelected(server);
      }
      
      if (onClose) {
        onClose();
      }
      
    } catch (error) {
      console.error('Error joining server:', error);
      alert('Ошибка при присоединении к серверу: ' + error.message);
    } finally {
      setJoiningServer(null);
    }
  }, [joinPublicServer, onServerSelected, onClose]);

  const handleSearchChange = useCallback((e) => {
    setSearchQuery(e.target.value);
  }, []);

  if (isLoading) {
    return (
      <div className="server-discovery">
        <div className="server-discovery-loading">Загрузка серверов...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="server-discovery">
        <div className="server-discovery-error">Ошибка: {error}</div>
      </div>
    );
  }

  return (
    <div className="server-discovery">
      <div className="server-discovery-header">
        <h1>Обнаружить серверы</h1>
        <p>От одного сообщества к другому, есть место для каждого.</p>
        
        <div className="search-container">
          <input 
            type="text" 
            placeholder="Поиск серверов..." 
            className="search-input"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      <div className="servers-grid">
        {filteredServers.length > 0 ? (
          filteredServers.map((server) => (
            <div key={server.serverId} className="server-card">
              <div 
                className="server-discovery-banner"
                style={{
                  backgroundImage: server.banner ? `url(${BASE_URL}${server.banner})` : 'none',
                  backgroundColor: server.bannerColor || '#3f3f3f'
                }}
              >
                {!server.banner && (
                  <div className="server-name-placeholder">
                    {server.avatar ? (
                      <img 
                        src={`${BASE_URL}${server.avatar}`}
                        alt={server.name}
                        className="server-avatar"
                      />
                    ) : (
                      <div className="server-initials">
                        {server.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="server-info">
                <h3 className="server-name">{server.name}</h3>
                {server.description && (
                  <p className="server-description">{server.description}</p>
                )}
                <div className="server-stats">
                  <span className="member-count">
                    {server.memberCount || 0} участников
                  </span>
                  {server.isPublic && (
                    <span className="server-type">Публичный</span>
                  )}
                </div>
              </div>
              
              <div className="server-actions">
                {isUserMember(server.serverId) ? (
                  <button 
                    className="joined-button"
                    disabled
                  >
                    Присоединен
                  </button>
                ) : joiningServer === server.serverId ? (
                  <button 
                    className="join-button"
                    disabled
                  >
                    Присоединяемся...
                  </button>
                ) : (
                  <button 
                    className="join-button"
                    onClick={() => handleJoinServer(server)}
                  >
                    Присоединиться
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="no-servers">
            <h3>Серверы не найдены</h3>
            <p>Попробуйте изменить поисковый запрос</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServerDiscovery;
