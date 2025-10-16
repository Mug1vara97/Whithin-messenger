import React, { useState, useEffect } from 'react';
import { Search, PersonAdd, Close } from '@mui/icons-material';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import './AddUserModal.css';

const AddUserModal = ({ open, onClose, chatId, onUserAdded, connection }) => {
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [addingUsers, setAddingUsers] = useState(new Set());


  useEffect(() => {
    if (open && chatId && connection) {
      loadAvailableUsers();
    } else if (open && chatId && !connection) {
    }
  }, [open, chatId, connection]);

  // Настраиваем обработчики SignalR
  useEffect(() => {
    if (!connection) {
      return;
    }

    const handleReceiveAvailableUsers = (users) => {
      if (users && Array.isArray(users)) {
        setAvailableUsers(users);
      } else {
        setAvailableUsers([]);
      }
      setLoading(false);
    };

    const handleError = (error) => {
      console.error('AddUserModal SignalR error:', error);
      setAvailableUsers([]);
      setLoading(false);
    };

    const handleUserAddedToGroup = (userId) => {
      // Удаляем пользователя из списка доступных
      setAvailableUsers(prev => prev.filter(user => user.userId !== userId));
      
      // Уведомляем родительский компонент
      if (onUserAdded) {
        onUserAdded(userId);
      }
      
      // Показываем уведомление об успешном добавлении
    };

    connection.on('ReceiveAvailableUsers', handleReceiveAvailableUsers);
    connection.on('UserAddedToGroup', handleUserAddedToGroup);
    connection.on('Error', handleError);

    return () => {
      connection.off('ReceiveAvailableUsers', handleReceiveAvailableUsers);
      connection.off('UserAddedToGroup', handleUserAddedToGroup);
      connection.off('Error', handleError);
    };
  }, [connection]);

  const loadAvailableUsers = async () => {
    try {
      setLoading(true);
      
      await connection.invoke('GetAvailableUsers', chatId);
    } catch (error) {
      console.error('❌ AddUserModal - Error loading available users via SignalR:', error);
      setAvailableUsers([]);
      setLoading(false);
    }
  };

  const handleAddUser = async (userId) => {
    try {
      setAddingUsers(prev => new Set([...prev, userId]));
      
      await connection.invoke('AddUserToGroup', chatId, userId);
    } catch (error) {
      console.error('❌ AddUserModal - Error adding user via SignalR:', error);
      alert('Ошибка при добавлении пользователя: ' + error.message);
    } finally {
      setAddingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const filteredUsers = availableUsers.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusText = (status) => {
    switch (status) {
      case 'online': return 'В сети';
      case 'away': return 'Отошел';
      default: return 'Не в сети';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return '#43b581';
      case 'away': return '#faa61a';
      default: return '#72767d';
    }
  };

  if (!open) return null;

  return (
    <div className="add-user-modal-overlay">
      <div className="add-user-modal">
        <div className="add-user-modal-header">
          <h3 className="add-user-modal-title">Добавить участника</h3>
          <button className="add-user-modal-close" onClick={onClose}>
            <Close />
          </button>
        </div>

        <div className="add-user-modal-content">
          <div className="add-user-search">
            <div className="add-user-search-input-container">
              <Search className="add-user-search-icon" />
              <input
                type="text"
                placeholder="Поиск пользователей..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="add-user-search-input"
              />
            </div>
          </div>

          <div className="add-user-list">
            {loading ? (
              <div className="add-user-loading">
                <span>Загрузка пользователей...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="add-user-empty">
                <span>
                  {searchTerm ? 'Пользователи не найдены' : 'Нет доступных пользователей для добавления'}
                </span>
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div key={user.userId} className="add-user-item">
                  <div className="add-user-avatar">
                    <span>{user.username?.charAt(0) || 'U'}</span>
                  </div>
                  <div className="add-user-info">
                    <span className="add-user-name">{user.username || 'Пользователь'}</span>
                    <div className="add-user-status">
                      <div 
                        className="add-user-status-dot"
                        style={{ backgroundColor: getStatusColor(user.userStatus) }}
                      />
                      <span className="add-user-status-text">{getStatusText(user.userStatus)}</span>
                    </div>
                  </div>
                  <button
                    className="add-user-add-btn"
                    onClick={() => handleAddUser(user.userId)}
                    disabled={addingUsers.has(user.userId)}
                  >
                    {addingUsers.has(user.userId) ? (
                      <span>Добавление...</span>
                    ) : (
                      <>
                        <PersonAdd />
                        <span>Добавить</span>
                      </>
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddUserModal;
