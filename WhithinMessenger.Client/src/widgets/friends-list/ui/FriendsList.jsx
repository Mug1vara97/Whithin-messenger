import React, { useState } from 'react';
import { PersonAdd, Search } from '@mui/icons-material';
import { useFriends } from '../../../entities/friend';
import { FriendItem } from '../../../shared/ui/molecules';
import SearchBar from '../../../shared/ui/molecules/SearchBar';
import { Button } from '../../../shared/ui/atoms/Button';
import './FriendsList.css';

const FriendsList = ({ onStartChat, onAddFriend }) => {
  const { friends, loading, error, removeFriend } = useFriends();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFriends = friends.filter(friend =>
    friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRemoveFriend = async (friendId) => {
    if (window.confirm('Вы уверены, что хотите удалить этого пользователя из друзей?')) {
      await removeFriend(friendId);
    }
  };

  if (loading) {
    return (
      <div className="friends-list">
        <div className="friends-list__header">
          <h3>Друзья</h3>
          <Button
            variant="primary"
            size="small"
            onClick={onAddFriend}
            icon={<PersonAdd />}
          >
            Добавить
          </Button>
        </div>
        <div className="friends-list__loading">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="friends-list">
        <div className="friends-list__header">
          <h3>Друзья</h3>
        </div>
        <div className="friends-list__error">Ошибка: {error}</div>
      </div>
    );
  }

  return (
    <div className="friends-list">
      <div className="friends-list__header">
        <h3>Друзья ({friends.length})</h3>
        <Button
          variant="primary"
          size="small"
          onClick={onAddFriend}
          icon={<PersonAdd />}
        >
          Добавить
        </Button>
      </div>
      
      <div className="friends-list__search">
        <SearchBar
          placeholder="Поиск друзей..."
          onSearchChange={setSearchQuery}
        />
      </div>
      
      <div className="friends-list__content">
        {filteredFriends.length === 0 ? (
          <div className="friends-list__empty">
            {searchQuery ? 'Друзья не найдены' : 'У вас пока нет друзей'}
          </div>
        ) : (
          filteredFriends.map(friend => (
            <FriendItem
              key={friend.userId}
              friend={friend}
              onRemoveFriend={handleRemoveFriend}
              onStartChat={onStartChat}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default FriendsList;
