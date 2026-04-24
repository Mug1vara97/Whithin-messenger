import React, { useState } from 'react';
import { PersonAdd } from '@mui/icons-material';
import { useFriends, useFriendRequests } from '../../../entities/friend';
import { FriendItem, FriendRequestItem } from '../../../shared/ui/molecules';
import { AddFriendModal } from '../../../shared/ui/molecules';
import './FriendsPanel.css';

const FriendsPanel = ({ onStartChat }) => {
  const [activeTab, setActiveTab] = useState('online');
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const { friends, loading, error, removeFriend } = useFriends();
  const { pendingRequests, sentRequests, acceptRequest, declineRequest, sendRequest } = useFriendRequests();

  const onlineFriends = friends.filter(friend => friend.status === 'Online');
  const allFriends = friends;
  const blockedFriends = [];
  const allPendingRequests = [...pendingRequests, ...sentRequests]
    .map(request => ({
      ...request,
      isSent: sentRequests.some(sentRequest => sentRequest.id === request.id)
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const getCurrentFriends = () => {
    switch (activeTab) {
      case 'online':
        return onlineFriends;
      case 'all':
        return allFriends;
      case 'pending':
        return allPendingRequests;
      case 'blocked':
        return blockedFriends;
      default:
        return [];
    }
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'online':
        return `В сети — ${onlineFriends.length}`;
      case 'all':
        return `Все друзья — ${allFriends.length}`;
      case 'pending':
        return `Ожидают — ${allPendingRequests.length}`;
      case 'blocked':
        return `Заблокированные — ${blockedFriends.length}`;
      default:
        return '';
    }
  };

  const handleAddFriend = () => {
    setShowAddFriendModal(true);
  };

  const handleSendRequest = async (userId) => {
    await sendRequest(userId);
    setShowAddFriendModal(false);
  };

  const handleAcceptRequest = async (friendshipId) => {
    await acceptRequest(friendshipId);
  };

  const handleDeclineRequest = async (friendshipId) => {
    await declineRequest(friendshipId);
  };

  const handleRemoveFriend = async (friendId) => {
    if (window.confirm('Вы уверены, что хотите удалить этого пользователя из друзей?')) {
      await removeFriend(friendId);
    }
  };

  if (loading) {
    return (
      <div className="friends-panel">
        <div className="friends-panel__loading">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="friends-panel">
      <div className="friends-panel__header">
        <div className="friends-panel__title">
          <h2>Друзья</h2>
          <div className="friends-panel__title-separator"></div>
          <div className="friends-panel__tabs">
            <button 
              className={`friends-panel__tab ${activeTab === 'online' ? 'active' : ''}`}
              onClick={() => setActiveTab('online')}
            >
              В сети
            </button>
            <button 
              className={`friends-panel__tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              Все
            </button>
            <button 
              className={`friends-panel__tab ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              Ожидают
            </button>
            <button 
              className={`friends-panel__tab ${activeTab === 'blocked' ? 'active' : ''}`}
              onClick={() => setActiveTab('blocked')}
            >
              Заблокированные
            </button>
          </div>
        </div>
        <div className="friends-panel__header-actions">
          <button 
            className="friends-panel__add-button"
            onClick={handleAddFriend}
            title="Добавить друга"
          >
            <PersonAdd />
          </button>
        </div>
      </div>

      <div className="friends-panel__search">
        <input 
          type="text" 
          placeholder="Поиск" 
          className="friends-panel__search-input"
        />
      </div>

      <div className="friends-panel__content">
        <div className="friends-panel__section">
          <div className="friends-panel__section-title">
            {getTabTitle()}
          </div>
          
          {error && (
            <div className="friends-panel__error">Ошибка: {error}</div>
          )}
          
          {getCurrentFriends().length === 0 ? (
            <div className="friends-panel__empty">
              {activeTab === 'online' && 'Нет друзей в сети'}
              {activeTab === 'all' && 'У вас пока нет друзей'}
              {activeTab === 'pending' && 'Нет ожидающих запросов'}
              {activeTab === 'blocked' && 'Нет заблокированных пользователей'}
            </div>
          ) : (
            <div className="friends-panel__list">
              {getCurrentFriends().map(item => (
                activeTab === 'pending' ? (
                  <FriendRequestItem
                    key={item.id}
                    request={item}
                    isSent={item.isSent}
                    onAccept={item.isSent ? undefined : handleAcceptRequest}
                    onDecline={item.isSent ? undefined : handleDeclineRequest}
                  />
                ) : (
                  <FriendItem
                    key={item.userId || item.id}
                    friend={item}
                    onRemoveFriend={handleRemoveFriend}
                    onStartChat={onStartChat}
                  />
                )
              ))}
            </div>
          )}
        </div>
      </div>

      <AddFriendModal
        isOpen={showAddFriendModal}
        onClose={() => setShowAddFriendModal(false)}
        onSendRequest={handleSendRequest}
      />
    </div>
  );
};

export default FriendsPanel;
