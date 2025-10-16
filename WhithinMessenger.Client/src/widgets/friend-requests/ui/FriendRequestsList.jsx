import React, { useState } from 'react';
import { PersonAdd, Search } from '@mui/icons-material';
import { useFriendRequests } from '../../../entities/friend';
import { FriendRequestItem } from '../../../shared/ui/molecules';
import SearchBar from '../../../shared/ui/molecules/SearchBar';
import { Button } from '../../../shared/ui/atoms/Button';
import './FriendRequestsList.css';

const FriendRequestsList = ({ onAddFriend }) => {
  const { 
    pendingRequests, 
    sentRequests, 
    loading, 
    error, 
    acceptRequest, 
    declineRequest 
  } = useFriendRequests();
  
  const [activeTab, setActiveTab] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');

  const currentRequests = activeTab === 'pending' ? pendingRequests : sentRequests;
  
  const filteredRequests = currentRequests.filter(request =>
    request.requesterUsername.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAcceptRequest = async (friendshipId) => {
    await acceptRequest(friendshipId);
  };

  const handleDeclineRequest = async (friendshipId) => {
    await declineRequest(friendshipId);
  };

  if (loading) {
    return (
      <div className="friend-requests-list">
        <div className="friend-requests-list__header">
          <h3>Запросы в друзья</h3>
          <Button
            variant="primary"
            size="small"
            onClick={onAddFriend}
            icon={<PersonAdd />}
          >
            Добавить
          </Button>
        </div>
        <div className="friend-requests-list__loading">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="friend-requests-list">
        <div className="friend-requests-list__header">
          <h3>Запросы в друзья</h3>
        </div>
        <div className="friend-requests-list__error">Ошибка: {error}</div>
      </div>
    );
  }

  return (
    <div className="friend-requests-list">
      <div className="friend-requests-list__header">
        <h3>Запросы в друзья</h3>
        <Button
          variant="primary"
          size="small"
          onClick={onAddFriend}
          icon={<PersonAdd />}
        >
          Добавить
        </Button>
      </div>
      
      <div className="friend-requests-list__tabs">
        <button
          className={`friend-requests-list__tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Входящие ({pendingRequests.length})
        </button>
        <button
          className={`friend-requests-list__tab ${activeTab === 'sent' ? 'active' : ''}`}
          onClick={() => setActiveTab('sent')}
        >
          Исходящие ({sentRequests.length})
        </button>
      </div>
      
      <div className="friend-requests-list__search">
        <SearchBar
          placeholder="Поиск запросов..."
          onSearchChange={setSearchQuery}
        />
      </div>
      
      <div className="friend-requests-list__content">
        {filteredRequests.length === 0 ? (
          <div className="friend-requests-list__empty">
            {searchQuery ? 'Запросы не найдены' : 'Нет запросов в друзья'}
          </div>
        ) : (
          filteredRequests.map(request => (
            <FriendRequestItem
              key={request.id}
              request={request}
              isSent={activeTab === 'sent'}
              onAccept={handleAcceptRequest}
              onDecline={handleDeclineRequest}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default FriendRequestsList;
