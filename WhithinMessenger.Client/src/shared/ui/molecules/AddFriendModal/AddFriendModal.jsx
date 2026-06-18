import React, { useState, useEffect, useCallback } from 'react';
import { Search, PersonAdd, Close, PersonSearch } from '@mui/icons-material';
import { userApi } from '@/entities/user/api';
import UserAvatar from '../../atoms/UserAvatar';
import { Button } from '../../atoms/Button';
import { getUserStatusColor, getUserStatusLabel } from '../../../lib/utils/userStatus';
import './AddFriendModal.css';

const getFriendshipMeta = (user) => {
  if (user.isFriend) {
    return { label: 'Уже друзья', tone: 'success', canAdd: false };
  }
  if (user.friendshipStatus === 'Pending') {
    return { label: 'Запрос отправлен', tone: 'pending', canAdd: false };
  }
  if (user.friendshipStatus === 'Blocked') {
    return { label: 'Заблокирован', tone: 'danger', canAdd: false };
  }
  if (user.friendshipStatus === 'Declined') {
    return { label: 'Запрос отклонён', tone: 'muted', canAdd: false };
  }
  return {
    label: getUserStatusLabel(user.userStatus),
    tone: 'status',
    canAdd: true,
  };
};

const AddFriendModal = ({ isOpen, onClose, onSendRequest }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sendingId, setSendingId] = useState(null);

  const searchUsers = useCallback(async (query) => {
    if (!query?.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const results = await userApi.searchUsers(query);
      setSearchResults(Array.isArray(results) ? results : []);
    } catch (err) {
      setError('Не удалось выполнить поиск. Попробуйте ещё раз.');
      console.error('Error searching users:', err);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setError(null);
      setLoading(false);
      setSendingId(null);
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const timeoutId = setTimeout(() => {
      searchUsers(String(searchQuery || ''));
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, isOpen, searchUsers]);

  const handleSendRequest = async (userId) => {
    try {
      setSendingId(userId);
      setError(null);
      await onSendRequest(userId);
      onClose();
    } catch (err) {
      setError('Не удалось отправить запрос в друзья');
      console.error('Error sending friend request:', err);
    } finally {
      setSendingId(null);
    }
  };

  if (!isOpen) return null;

  const trimmedQuery = searchQuery.trim();
  const showEmptyResults = !loading && trimmedQuery && searchResults.length === 0;
  const showResults = !loading && searchResults.length > 0;

  return (
    <div className="add-friend-modal" role="dialog" aria-modal="true" aria-labelledby="add-friend-modal-title">
      <button
        type="button"
        className="add-friend-modal__backdrop"
        onClick={onClose}
        aria-label="Закрыть"
      />

      <div className="add-friend-modal__dialog" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="add-friend-modal__close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          <Close fontSize="small" />
        </button>

        <header className="add-friend-modal__header">
          <div className="add-friend-modal__icon-wrap" aria-hidden="true">
            <PersonAdd />
          </div>
          <h2 id="add-friend-modal-title" className="add-friend-modal__title">
            Добавить в друзья
          </h2>
          <p className="add-friend-modal__subtitle">
            Найдите пользователя по имени и отправьте запрос
          </p>
        </header>

        <div className="add-friend-modal__search">
          <Search className="add-friend-modal__search-icon" aria-hidden="true" />
          <input
            type="text"
            className="add-friend-modal__search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Введите имя пользователя..."
            autoFocus
            autoComplete="off"
          />
        </div>

        {error && (
          <div className="add-friend-modal__error" role="alert">
            {error}
          </div>
        )}

        <div className="add-friend-modal__body">
          {loading && (
            <div className="add-friend-modal__state">
              <div className="add-friend-modal__spinner" aria-hidden="true" />
              <span>Поиск...</span>
            </div>
          )}

          {!loading && !trimmedQuery && (
            <div className="add-friend-modal__state add-friend-modal__state--hint">
              <PersonSearch className="add-friend-modal__state-icon" aria-hidden="true" />
              <span>Начните вводить имя — результаты появятся здесь</span>
            </div>
          )}

          {showEmptyResults && (
            <div className="add-friend-modal__state">
              <span>Пользователи не найдены</span>
            </div>
          )}

          {showResults && (
            <ul className="add-friend-modal__list">
              {searchResults.map((user) => {
                const meta = getFriendshipMeta(user);
                const isSending = sendingId === user.userId;

                return (
                  <li key={user.userId} className="add-friend-modal__row">
                    <div className="add-friend-modal__avatar-wrap">
                      <UserAvatar
                        username={user.username}
                        avatarUrl={user.avatarUrl}
                        avatarColor={user.avatarColor}
                        avatarDecoration={user.avatarDecoration}
                        size="medium"
                        statusIndicator={
                          meta.tone === 'status' ? (
                            <span
                              className="user-avatar-presence-dot"
                              style={{ backgroundColor: getUserStatusColor(user.userStatus) }}
                              title={meta.label}
                            />
                          ) : null
                        }
                      />
                    </div>

                    <div className="add-friend-modal__user-info">
                      <span className="add-friend-modal__user-name">{user.username}</span>
                      <span className={`add-friend-modal__user-status add-friend-modal__user-status--${meta.tone}`}>
                        {meta.label}
                      </span>
                    </div>

                    {meta.canAdd ? (
                      <Button
                        variant="primary"
                        size="small"
                        className="add-friend-modal__add-btn"
                        disabled={isSending}
                        onClick={() => handleSendRequest(user.userId)}
                      >
                        <PersonAdd sx={{ fontSize: 16 }} />
                        {isSending ? 'Отправка...' : 'Добавить'}
                      </Button>
                    ) : (
                      <span className={`add-friend-modal__badge add-friend-modal__badge--${meta.tone}`}>
                        {user.isFriend ? 'Друг' : meta.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddFriendModal;
