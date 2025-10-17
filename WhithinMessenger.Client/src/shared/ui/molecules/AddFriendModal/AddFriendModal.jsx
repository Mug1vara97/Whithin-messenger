import React, { useState, useEffect } from 'react';
import { Search, PersonAdd, Close } from '@mui/icons-material';
import { userApi } from '@/entities/user/api';
import UserAvatar from '../../atoms/UserAvatar';
import { Button } from '../../atoms/Button';
import { FormField } from '../../atoms/FormField';
import './AddFriendModal.css';

const AddFriendModal = ({ isOpen, onClose, onSendRequest }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const searchUsers = async (query) => {
    if (!query || typeof query !== 'string' || !query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const results = await userApi.searchUsers(query);
      setSearchResults(Array.isArray(results) ? results : []);
    } catch (err) {
      setError('Ошибка при поиске пользователей');
      console.error('Error searching users:', err);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const query = String(searchQuery || '');
      searchUsers(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSendRequest = async (userId) => {
    try {
      await onSendRequest(userId);
      onClose();
    } catch (err) {
      setError('Ошибка при отправке запроса');
      console.error('Error sending friend request:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="add-friend-modal-overlay" onClick={onClose}>
      <div className="add-friend-modal" onClick={(e) => e.stopPropagation()}>
        <div className="add-friend-modal__header">
          <h3>Добавить в друзья</h3>
          <button className="add-friend-modal__close" onClick={onClose}>
            <Close />
          </button>
        </div>
        
        <div className="add-friend-modal__content">
          <FormField
            label="Поиск пользователей"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Введите имя пользователя..."
            icon={<Search />}
          />
          
          {error && (
            <div className="add-friend-modal__error">{error}</div>
          )}
          
          <div className="add-friend-modal__results">
            {loading && (
              <div className="add-friend-modal__loading">Поиск...</div>
            )}
            
            {!loading && searchResults.length === 0 && searchQuery && (
              <div className="add-friend-modal__empty">Пользователи не найдены</div>
            )}
            
            {!loading && searchResults.length > 0 && (
              <div className="add-friend-modal__users">
                {searchResults.map(user => {
                  const isFriend = user.isFriend;
                  const isPending = user.friendshipStatus === 'Pending';
                  const isBlocked = user.friendshipStatus === 'Blocked';
                  const isDeclined = user.friendshipStatus === 'Declined';
                  
                  return (
                    <div key={user.userId} className="add-friend-modal__user">
                      <UserAvatar
                        username={user.username}
                        avatar={user.avatarUrl}
                        avatarColor={user.avatarColor}
                        size="medium"
                      />
                      <div className="add-friend-modal__user-info">
                        <div className="add-friend-modal__user-name">{user.username}</div>
                        <div className="add-friend-modal__user-status">
                          {isFriend ? 'Уже друзья' : 
                           isPending ? 'Запрос отправлен' :
                           isBlocked ? 'Заблокирован' :
                           isDeclined ? 'Запрос отклонен' :
                           user.userStatus}
                        </div>
                      </div>
                      {!isFriend && !isPending && !isBlocked && (
                        <Button
                          variant="primary"
                          size="small"
                          onClick={() => handleSendRequest(user.userId)}
                          icon={<PersonAdd />}
                        >
                          Добавить
                        </Button>
                      )}
                      {isFriend && (
                        <div className="add-friend-modal__friend-badge">Друг</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddFriendModal;
