import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { chatApi } from '../../../../entities/chat/api/chatApi';
import { friendApi } from '../../../../entities/friend/api/friendApi';
import { useConnectionContext } from '../../../../shared/lib/contexts/ConnectionContext';
import { useAuthContext } from '../../../../shared/lib/contexts/AuthContext';
import { normalizeFriend } from '../../../../entities/friend/lib/friendHelpers';
import UserAvatar from '../../atoms/UserAvatar';
import { UserAvatarPresenceDot } from '../../atoms/UserAvatar';
import './CreateGroupChatModal.css';

const MAX_GROUP_FRIENDS = 10;

const CreateGroupChatModal = ({ isOpen, onClose, onChatCreated }) => {
  const { getConnection } = useConnectionContext();
  const { user } = useAuthContext();
  const [connection, setConnection] = useState(null);
  const [chatName, setChatName] = useState('');
  const [friends, setFriends] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !user?.id) {
      return undefined;
    }

    let mounted = true;

    const setup = async () => {
      try {
        const chatConnection = await getConnection('chatlisthub', user.id);
        if (mounted) {
          setConnection(chatConnection);
        }
      } catch (err) {
        console.error('CreateGroupChatModal: connection error', err);
        if (mounted) {
          setError('Не удалось подключиться к чатам');
        }
      }
    };

    setup();

    return () => {
      mounted = false;
      setConnection(null);
    };
  }, [isOpen, user?.id, getConnection]);

  const loadFriends = useCallback(async () => {
    setFriendsLoading(true);
    setError(null);
    try {
      const data = await friendApi.getFriends();
      const normalized = (Array.isArray(data) ? data : [])
        .map(normalizeFriend)
        .filter(Boolean);
      setFriends(normalized);
    } catch (err) {
      console.error('CreateGroupChatModal: failed to load friends', err);
      setFriends([]);
      setError(err?.response?.data?.error || err?.message || 'Не удалось загрузить список друзей');
    } finally {
      setFriendsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setChatName('');
      setSelectedUserIds([]);
      setSearchQuery('');
      setError(null);
      setFriends([]);
      return;
    }

    loadFriends();
  }, [isOpen, loadFriends]);

  const handleUserSelect = (userId) => {
    setSelectedUserIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      }
      if (prev.length >= MAX_GROUP_FRIENDS) {
        return prev;
      }
      return [...prev, userId];
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!chatName.trim()) {
      setError('Введите название группы');
      return;
    }

    if (selectedUserIds.length === 0) {
      setError('Выберите хотя бы одного друга');
      return;
    }

    if (!connection) {
      setError('Нет подключения к чатам');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await chatApi.createGroupChat(chatName.trim(), selectedUserIds, connection);

      if (response.chatId) {
        onChatCreated(response.chatId);
        onClose();
        setChatName('');
        setSelectedUserIds([]);
        setSearchQuery('');
      }
    } catch (err) {
      console.error('CreateGroupChatModal: create failed', err);
      setError(err?.response?.data?.error || err?.message || 'Не удалось создать групповой чат');
    } finally {
      setLoading(false);
    }
  };

  const filteredFriends = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return friends;
    }
    return friends.filter((friend) =>
      (friend.username || '').toLowerCase().includes(query),
    );
  }, [friends, searchQuery]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="create-group-modal-overlay" onClick={onClose}>
      <div className="create-group-modal" onClick={(e) => e.stopPropagation()}>
        <div className="create-group-modal__header">
          <h2>Создать групповой чат</h2>
          <button type="button" className="create-group-modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <p className="create-group-modal__subtitle">
          Можно добавить до {MAX_GROUP_FRIENDS} друзей. Осталось: {MAX_GROUP_FRIENDS - selectedUserIds.length}.
        </p>

        {error && <div className="create-group-modal__error">{error}</div>}

        {selectedUserIds.length > 0 && (
          <div className="create-group-modal__selected">
            {selectedUserIds.map((friendId) => {
              const friend = friends.find((item) => String(item.userId) === String(friendId));
              return (
                <div key={friendId} className="create-group-modal__tag">
                  <span>{friend?.username || 'Друг'}</span>
                  <button type="button" onClick={() => handleUserSelect(friendId)} aria-label="Убрать">
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="create-group-modal__search">
            <input
              type="text"
              placeholder="Поиск друзей..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="create-group-modal__search-input"
            />
          </div>

          <div className="create-group-modal__list">
            {friendsLoading ? (
              <div className="create-group-modal__empty">Загрузка друзей...</div>
            ) : filteredFriends.length === 0 ? (
              <div className="create-group-modal__empty">
                {searchQuery ? 'Друзья не найдены' : 'У вас пока нет друзей для добавления'}
              </div>
            ) : (
              filteredFriends.map((friend) => {
                const friendId = friend.userId;
                const isSelected = selectedUserIds.includes(friendId);
                const isDisabled = !isSelected && selectedUserIds.length >= MAX_GROUP_FRIENDS;

                return (
                  <label
                    key={friendId}
                    className={`create-group-modal__item ${isDisabled ? 'is-disabled' : ''}`}
                  >
                    <UserAvatar
                      username={friend.username}
                      avatarUrl={friend.avatar}
                      avatarColor={friend.avatarColor}
                      size={40}
                      statusIndicator={<UserAvatarPresenceDot status={friend.status} />}
                    />
                    <div className="create-group-modal__item-info">
                      <div className="create-group-modal__item-name">{friend.username}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isDisabled}
                      onChange={() => handleUserSelect(friendId)}
                      className="create-group-modal__checkbox"
                    />
                  </label>
                );
              })
            )}
          </div>

          <div className="create-group-modal__name-section">
            <label className="create-group-modal__name-label" htmlFor="group-chat-name">
              Название группы
            </label>
            <input
              id="group-chat-name"
              type="text"
              value={chatName}
              onChange={(e) => setChatName(e.target.value)}
              placeholder="Введите название"
              className="create-group-modal__name-input"
              maxLength={100}
            />
          </div>

          <div className="create-group-modal__actions">
            <button type="button" onClick={onClose} className="create-group-modal__cancel">
              Отмена
            </button>
            <button
              type="submit"
              className="create-group-modal__submit"
              disabled={loading || !chatName.trim() || selectedUserIds.length === 0}
            >
              {loading ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupChatModal;
