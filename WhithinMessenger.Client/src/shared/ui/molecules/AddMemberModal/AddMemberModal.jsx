import React, { useState, useEffect } from 'react';
import { Close, Search, PersonAdd } from '@mui/icons-material';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import tokenManager from '../../../lib/services/tokenManager';
import './AddMemberModal.css';

const AddMemberModal = ({ isOpen, onClose, serverId, onMemberAdded, connection }) => {
  const [friends, setFriends] = useState([]);
  const [serverMembers, setServerMembers] = useState([]);
  const [availableFriends, setAvailableFriends] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && serverId) {
      loadData();
    }
  }, [isOpen, serverId]);

  const loadData = async () => {
    setIsLoading(true);
    setError('');

    try {
      const token = tokenManager.getToken();
      const authHeaders = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };

      // Загружаем друзей и участников сервера параллельно
      const [friendsResponse, membersResponse] = await Promise.all([
        fetch(`${BASE_URL}/api/friends`, {
          method: 'GET',
          headers: authHeaders,
          credentials: 'include',
        }),
        fetch(`${BASE_URL}/api/server/${serverId}/members`, {
          method: 'GET',
          headers: authHeaders,
          credentials: 'include',
        })
      ]);

      if (!friendsResponse.ok || !membersResponse.ok) {
        throw new Error('Ошибка при загрузке данных');
      }

      const friendsData = await friendsResponse.json();
      const membersData = await membersResponse.json();

      setFriends(friendsData);
      setServerMembers(membersData);

      // Фильтруем друзей, исключая тех, кто уже на сервере
      const memberIds = membersData.map(member => member.userId);
      const available = friendsData.filter(friend => !memberIds.includes(friend.userId));
      setAvailableFriends(available);

    } catch (err) {
      setError('Ошибка при загрузке данных');
      console.error('Load data error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    loadData();
  };

  const handleAddMember = async (userId) => {
    setIsAdding(true);
    setError('');

    try {
      if (!connection || connection.state !== 'Connected') {
        throw new Error('Нет подключения к серверу');
      }

      // Используем SignalR для добавления участника
      await connection.invoke('AddMember', serverId, userId);
      
      // Обновляем список доступных друзей
      const updatedAvailableFriends = availableFriends.filter(friend => friend.userId !== userId);
      setAvailableFriends(updatedAvailableFriends);
      
      if (onMemberAdded) {
        onMemberAdded({ userId, serverId });
      }
      
    } catch (err) {
      setError(err.message);
      console.error('Add member error:', err);
    } finally {
      setIsAdding(false);
    }
  };


  if (!isOpen) return null;

  return (
    <div className="add-member-modal-overlay">
      <div className="add-member-modal-container">
        <div className="add-member-modal-header">
          <h3>Добавить участника</h3>
          <button className="add-member-close-button" onClick={onClose}>
            <Close />
          </button>
        </div>

        <div className="add-member-modal-content">
          <div className="add-member-header-section">
            <div className="add-member-info">
              <h4>Добавить друзей на сервер</h4>
              <p>Выберите друзей, которых хотите добавить на сервер</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="add-member-refresh-button"
            >
              {isLoading ? 'Загрузка...' : 'Обновить'}
            </button>
          </div>

          {error && (
            <div className="add-member-error">
              {error}
            </div>
          )}

          <div className="add-member-results">
            {isLoading ? (
              <div className="add-member-loading">
                <div className="add-member-loading-spinner"></div>
                <div className="add-member-loading-text">Загрузка друзей...</div>
              </div>
            ) : availableFriends.length > 0 ? (
              <div className="add-member-results-list">
                {availableFriends.map((friend) => (
                  <div key={friend.userId} className="add-member-result-item">
                    <div className="add-member-user-info">
                      <div 
                        className="add-member-user-avatar"
                        style={{ backgroundColor: friend.avatarColor || '#5865f2' }}
                      >
                        {friend.avatar ? (
                          <img 
                            src={`${BASE_URL}${friend.avatar}`} 
                            alt={friend.username}
                            className="add-member-avatar-image"
                          />
                        ) : (
                          friend.username?.charAt(0)?.toUpperCase() || '?'
                        )}
                      </div>
                      <div className="add-member-user-details">
                        <div className="add-member-username">{friend.username}</div>
                        <div className="add-member-status">Друг</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddMember(friend.userId)}
                      disabled={isAdding}
                      className="add-member-add-button"
                    >
                      <PersonAdd sx={{ fontSize: 16, marginRight: 4 }} />
                      {isAdding ? 'Добавление...' : 'Добавить'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="add-member-empty-state">
                <PersonAdd className="add-member-empty-icon" />
                <div className="add-member-empty-text">
                  Нет доступных друзей
                </div>
                <div className="add-member-empty-description">
                  Все ваши друзья уже являются участниками этого сервера
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddMemberModal;
