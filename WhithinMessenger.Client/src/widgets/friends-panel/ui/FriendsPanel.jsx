import React, { useMemo, useState } from 'react';
import { PersonAdd } from '@mui/icons-material';
import { useFriends, useFriendRequests } from '../../../entities/friend';
import { FriendItem, FriendRequestItem } from '../../../shared/ui/molecules';
import { AddFriendModal } from '../../../shared/ui/molecules';
import { useUserBlocks } from '../../../shared/lib/contexts/UserBlockContext';
import { isUserActiveInFriendsList } from '../../../shared/lib/utils/userStatus';
import './FriendsPanel.css';

const FriendsPanel = ({ onStartChat }) => {
  const [activeTab, setActiveTab] = useState('online');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const { friends, loading, error, removeFriend } = useFriends();
  const { pendingRequests, sentRequests, acceptRequest, declineRequest, sendRequest } = useFriendRequests();
  const { blockedUsers, loading: blockedLoading, unblockUser } = useUserBlocks();

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filterBySearch = (items, getLabel) => {
    if (!normalizedQuery) return items;
    return items.filter((item) => getLabel(item).toLowerCase().includes(normalizedQuery));
  };

  const onlineFriends = useMemo(
    () => friends.filter((friend) => isUserActiveInFriendsList(friend.status)),
    [friends]
  );

  const filteredOnlineFriends = useMemo(
    () => filterBySearch(onlineFriends, (friend) => friend.username || ''),
    [onlineFriends, normalizedQuery]
  );

  const filteredAllFriends = useMemo(
    () => filterBySearch(friends, (friend) => friend.username || ''),
    [friends, normalizedQuery]
  );

  const filteredBlockedUsers = useMemo(
    () => filterBySearch(blockedUsers, (user) => user.username || ''),
    [blockedUsers, normalizedQuery]
  );

  const filteredPendingRequests = useMemo(
    () => filterBySearch(pendingRequests, (request) => request.requesterUsername || ''),
    [pendingRequests, normalizedQuery]
  );

  const filteredSentRequests = useMemo(
    () => filterBySearch(sentRequests, (request) => request.requesterUsername || ''),
    [sentRequests, normalizedQuery]
  );

  const allPendingCount = pendingRequests.length + sentRequests.length;

  const getTabTitle = () => {
    switch (activeTab) {
      case 'online':
        return `В сети — ${filteredOnlineFriends.length}`;
      case 'all':
        return `Все друзья — ${filteredAllFriends.length}`;
      case 'pending':
        return null;
      case 'blocked':
        return `Заблокированные — ${filteredBlockedUsers.length}`;
      default:
        return '';
    }
  };

  const handleSendRequest = async (userId) => {
    await sendRequest(userId);
    setShowAddFriendModal(false);
  };

  const handleRemoveFriend = async (friendId) => {
    if (window.confirm('Вы уверены, что хотите удалить этого пользователя из друзей?')) {
      await removeFriend(friendId);
    }
  };

  const handleUnblockUser = async (userId) => {
    if (!userId) return;
    if (!window.confirm('Разблокировать этого пользователя?')) return;

    try {
      await unblockUser(userId);
    } catch (unblockError) {
      alert(unblockError?.message || 'Не удалось разблокировать пользователя');
    }
  };

  const renderFriendList = (items) => (
    <div className="friends-panel__list">
      {items.map((friend) => (
        <FriendItem
          key={friend.userId}
          friend={friend}
          onRemoveFriend={handleRemoveFriend}
          onStartChat={onStartChat}
        />
      ))}
    </div>
  );

  const renderBlockedList = (items) => (
    <div className="friends-panel__list">
      {items.map((blockedUser) => (
        <FriendItem
          key={blockedUser.userId}
          friend={{
            userId: blockedUser.userId,
            username: blockedUser.username,
            avatar: blockedUser.avatar,
            avatarColor: blockedUser.avatarColor,
            status: 'offline',
          }}
          isBlocked
          showActions
          onUnblock={handleUnblockUser}
        />
      ))}
    </div>
  );

  const getPendingSectionTitle = () => {
    const inCount = filteredPendingRequests.length;
    const outCount = filteredSentRequests.length;

    if (inCount > 0 && outCount > 0) {
      return null;
    }
    if (inCount > 0) {
      return `Входящие — ${inCount}`;
    }
    if (outCount > 0) {
      return `Исходящие — ${outCount}`;
    }
    return null;
  };

  const renderPendingContent = () => {
    const hasIncoming = filteredPendingRequests.length > 0;
    const hasOutgoing = filteredSentRequests.length > 0;
    const showSubgroupTitles = hasIncoming && hasOutgoing;

    if (!hasIncoming && !hasOutgoing) {
      return (
        <div className="friends-panel__empty">
          {normalizedQuery ? 'Ничего не найдено' : 'Нет ожидающих запросов'}
        </div>
      );
    }

    return (
      <div className="friends-panel__pending-groups">
        {hasIncoming && (
          <div className="friends-panel__pending-group">
            {showSubgroupTitles && (
              <div className="friends-panel__pending-group-title">
                Входящие — {filteredPendingRequests.length}
              </div>
            )}
            <div className="friends-panel__list">
              {filteredPendingRequests.map((request) => (
                <FriendRequestItem
                  key={request.id}
                  request={request}
                  isSent={false}
                  onAccept={acceptRequest}
                  onDecline={declineRequest}
                />
              ))}
            </div>
          </div>
        )}

        {hasOutgoing && (
          <div className="friends-panel__pending-group">
            {showSubgroupTitles && (
              <div className="friends-panel__pending-group-title">
                Исходящие — {filteredSentRequests.length}
              </div>
            )}
            <div className="friends-panel__list">
              {filteredSentRequests.map((request) => (
                <FriendRequestItem
                  key={request.id}
                  request={request}
                  isSent
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTabContent = () => {
    if (activeTab === 'online') {
      if (filteredOnlineFriends.length === 0) {
        return (
          <div className="friends-panel__empty">
            {normalizedQuery ? 'Ничего не найдено' : 'Нет друзей в сети'}
          </div>
        );
      }
      return renderFriendList(filteredOnlineFriends);
    }

    if (activeTab === 'all') {
      if (filteredAllFriends.length === 0) {
        return (
          <div className="friends-panel__empty">
            {normalizedQuery ? 'Ничего не найдено' : 'У вас пока нет друзей'}
          </div>
        );
      }
      return renderFriendList(filteredAllFriends);
    }

    if (activeTab === 'pending') {
      return renderPendingContent();
    }

    if (blockedLoading) {
      return <div className="friends-panel__loading">Загрузка...</div>;
    }

    if (filteredBlockedUsers.length === 0) {
      return (
        <div className="friends-panel__empty">
          {normalizedQuery ? 'Ничего не найдено' : 'Нет заблокированных пользователей'}
        </div>
      );
    }

    return renderBlockedList(filteredBlockedUsers);
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
          <div className="friends-panel__title-separator" />
          <div className="friends-panel__tabs">
            <button
              type="button"
              className={`friends-panel__tab ${activeTab === 'online' ? 'active' : ''}`}
              onClick={() => setActiveTab('online')}
            >
              В сети
            </button>
            <button
              type="button"
              className={`friends-panel__tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              Все
            </button>
            <button
              type="button"
              className={`friends-panel__tab ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              Ожидают
              {allPendingCount > 0 && (
                <span className="friends-panel__tab-badge">{allPendingCount}</span>
              )}
            </button>
            <button
              type="button"
              className={`friends-panel__tab ${activeTab === 'blocked' ? 'active' : ''}`}
              onClick={() => setActiveTab('blocked')}
            >
              Заблокированные
            </button>
          </div>
        </div>
        <div className="friends-panel__header-actions">
          <button
            type="button"
            className="friends-panel__add-button"
            onClick={() => setShowAddFriendModal(true)}
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
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </div>

      <div className="friends-panel__content">
        <div className="friends-panel__section">
          {(activeTab !== 'pending' ? getTabTitle() : getPendingSectionTitle()) && (
            <div className="friends-panel__section-title">
              {activeTab === 'pending' ? getPendingSectionTitle() : getTabTitle()}
            </div>
          )}

          {error && <div className="friends-panel__error">Ошибка: {error}</div>}

          {renderTabContent()}
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
