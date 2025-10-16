import React, { useState, useEffect } from 'react';
import { chatApi } from '../../../../entities/chat/api/chatApi';
import { userApi } from '../../../../entities/user/api/userApi';
import { useConnectionContext } from '../../../../shared/lib/contexts/ConnectionContext';
import { useAuthContext } from '../../../../shared/lib/contexts/AuthContext';
import './CreateGroupChatModal.css';

const CreateGroupChatModal = ({ isOpen, onClose, onChatCreated }) => {
  const { getConnection } = useConnectionContext();
  const { user } = useAuthContext();
  const [connection, setConnection] = useState(null);
  const [chatName, setChatName] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Создаем соединение при открытии модального окна
  useEffect(() => {
    if (isOpen && user?.id) {
      const createConnection = async () => {
        try {
          const chatConnection = await getConnection('chatlisthub', user.id);
          setConnection(chatConnection);
        } catch (error) {
          console.error('Ошибка при создании соединения:', error);
        }
      };
      createConnection();
    }
  }, [isOpen, user?.id, getConnection]);

  useEffect(() => {
    if (isOpen && connection) {
      // Не вызываем loadUsers здесь, так как это будет сделано в useEffect для searchQuery
      console.log('Modal opened with connection, will load users via searchQuery effect');
    }
  }, [isOpen, connection]);

  useEffect(() => {
    if (connection) {
      console.log('Setting up search results handler for connection:', connection.state);
      const handleSearchResults = (results) => {
        console.log('Received search results:', results);
        console.log('Results count:', results?.length || 0);
        setUsers(results || []);
        setLoading(false);
      };

      const handleError = (error) => {
        console.error('SignalR error in CreateGroupChatModal:', error);
        setLoading(false);
      };

      connection.on("receivesearchresults", handleSearchResults);
      connection.on("error", handleError);

      return () => {
        console.log('Cleaning up search results handler');
        connection.off("receivesearchresults", handleSearchResults);
        connection.off("error", handleError);
      };
    }
  }, [connection]);

  // Очищаем соединение при закрытии модального окна
  useEffect(() => {
    if (!isOpen && connection) {
      setConnection(null);
    }
  }, [isOpen, connection]);


  const handleUserSelect = (userId) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!chatName.trim()) {
      alert('Пожалуйста, введите название чата');
      return;
    }

    if (selectedUserIds.length === 0) {
      alert('Пожалуйста, выберите хотя бы одного участника');
      return;
    }

    try {
      setLoading(true);
      const response = await chatApi.createGroupChat(chatName.trim(), selectedUserIds, connection);
      
      if (response.chatId) {
        onChatCreated(response.chatId);
        onClose();
        setChatName('');
        setSelectedUserIds([]);
      }
    } catch (error) {
      console.error('Ошибка при создании группового чата:', error);
      alert('Произошла ошибка при создании группового чата');
    } finally {
      setLoading(false);
    }
  };

  // Обновляем поиск при изменении запроса
  useEffect(() => {
    if (connection) {
      console.log('Search effect triggered, searchQuery:', searchQuery);
      setLoading(true);
      if (searchQuery === '') {
        // Если поиск пустой, загружаем пользователей с существующими чатами
        console.log('Loading users with existing chats (empty search)');
        connection.invoke("SearchUsers", "").catch(error => {
          console.error('Error invoking SearchUsers:', error);
          setLoading(false);
        });
      } else {
        // Если есть поисковый запрос, ищем по нему
        console.log('Searching users with query:', searchQuery);
        connection.invoke("SearchUsers", searchQuery).catch(error => {
          console.error('Error invoking SearchUsers:', error);
          setLoading(false);
        });
      }
    }
  }, [connection, searchQuery]);

  // Используем пользователей напрямую, так как фильтрация происходит на backend
  const filteredUsers = users;

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Выберите друзей</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-subtitle">
          Вы можете добавить ещё {10 - selectedUserIds.length} друзей.
        </div>

        {selectedUserIds.length > 0 && (
          <div className="selected-users">
            {selectedUserIds.map((userId, index) => {
              const user = users.find(u => u.userId === userId || u.id === userId);
              return (
                <div key={userId || index} className="selected-user-tag">
                  <span>{user?.username || user?.displayName}</span>
                  <button 
                    type="button"
                    onClick={() => handleUserSelect(userId)}
                    className="remove-user"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="users-search">
            <input
              type="text"
              placeholder="Поиск друзей..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="users-list">
            {loading ? (
              <div className="loading">Загрузка...</div>
            ) : (
              filteredUsers.map((user, index) => (
                <div key={user.userId || user.id || index} className="user-item">
                  <div className="user-avatar">
                    <img 
                      src={user.avatar || '/default-avatar.png'} 
                      alt={user.username}
                    />
                    <div className={`status-indicator ${user.isOnline ? 'online' : 'offline'}`} />
                  </div>
                  <div className="user-info">
                    <div className="user-name">{user.displayName || user.username}</div>
                    <div className="user-username">@{user.username}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedUserIds.includes(user.userId || user.id)}
                    onChange={() => handleUserSelect(user.userId || user.id)}
                    className="user-checkbox"
                  />
                </div>
              ))
            )}
          </div>

          <div className="group-name-section">
            <div className="group-avatar-placeholder">
              <span>✏️</span>
            </div>
            <div className="group-name-input">
              <label>Название группы (необязательно)</label>
              <input
                type="text"
                value={chatName}
                onChange={(e) => setChatName(e.target.value)}
                placeholder={selectedUserIds.length > 0 
                  ? selectedUserIds.map(id => users.find(u => u.id === id)?.username).join(', ')
                  : 'Введите название группы'
                }
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Отмена
            </button>
            <button 
              type="submit" 
              className="create-button"
              disabled={loading || !chatName.trim() || selectedUserIds.length === 0}
            >
              {loading ? 'Создание...' : 'Создать групповой чат'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupChatModal;
