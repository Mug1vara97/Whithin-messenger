import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, PersonAdd, Close } from '@mui/icons-material';
import { getUserStatusLabel } from '../../../lib/utils/userStatus';
import { buildMediaUrl } from '../../../lib/utils/urlHelpers';
import UserAvatar from '../../atoms/UserAvatar';
import { UserAvatarPresenceDot } from '../../atoms/UserAvatar';
import './AddUserModal.css';

const normalizeAvailableUser = (user) => ({
  userId: user?.userId ?? user?.UserId,
  username: user?.username ?? user?.Username ?? 'Пользователь',
  avatarUrl: user?.avatarUrl ?? user?.AvatarUrl ?? null,
  avatarColor: user?.avatarColor ?? user?.AvatarColor ?? '#5865F2',
  userStatus: user?.userStatus ?? user?.UserStatus ?? 'offline',
});

const AddUserModal = ({ open, onClose, chatId, onUserAdded, connection }) => {
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [addingUsers, setAddingUsers] = useState(new Set());

  const loadAvailableUsers = useCallback(async () => {
    if (!connection || !chatId) {
      return;
    }

    if (connection.state !== 'Connected') {
      setError('Нет подключения к чату. Попробуйте позже.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await connection.invoke('GetAvailableUsers', String(chatId));
    } catch (err) {
      console.error('AddUserModal - failed to load friends:', err);
      setAvailableUsers([]);
      setError(err?.message || 'Не удалось загрузить список друзей');
      setLoading(false);
    }
  }, [chatId, connection]);

  useEffect(() => {
    if (!open) {
      setSearchTerm('');
      setError(null);
      setAvailableUsers([]);
      return;
    }

    if (chatId && connection) {
      loadAvailableUsers();
    }
  }, [open, chatId, connection, loadAvailableUsers]);

  useEffect(() => {
    if (!connection) {
      return undefined;
    }

    const handleReceiveAvailableUsers = (users) => {
      const normalized = (Array.isArray(users) ? users : [])
        .map(normalizeAvailableUser)
        .filter((user) => user.userId);
      setAvailableUsers(normalized);
      setLoading(false);
      setError(null);
    };

    const handleError = (message) => {
      console.error('AddUserModal SignalR error:', message);
      setError(typeof message === 'string' ? message : 'Ошибка при загрузке друзей');
      setAvailableUsers([]);
      setLoading(false);
    };

    const handleUserAddedToGroup = (userId) => {
      const key = String(userId);
      setAvailableUsers((prev) => prev.filter((user) => String(user.userId) !== key));
      onUserAdded?.(userId);
    };

    connection.on('ReceiveAvailableUsers', handleReceiveAvailableUsers);
    connection.on('UserAddedToGroup', handleUserAddedToGroup);
    connection.on('Error', handleError);

    return () => {
      connection.off('ReceiveAvailableUsers', handleReceiveAvailableUsers);
      connection.off('UserAddedToGroup', handleUserAddedToGroup);
      connection.off('Error', handleError);
    };
  }, [connection, onUserAdded]);

  const handleAddUser = async (userId) => {
    if (!connection || !chatId) {
      return;
    }

    try {
      setAddingUsers((prev) => new Set([...prev, String(userId)]));
      setError(null);
      await connection.invoke('AddUserToGroup', String(chatId), String(userId));
    } catch (err) {
      console.error('AddUserModal - failed to add user:', err);
      setError(err?.message || 'Ошибка при добавлении участника');
    } finally {
      setAddingUsers((prev) => {
        const next = new Set(prev);
        next.delete(String(userId));
        return next;
      });
    }
  };

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return availableUsers;
    }

    return availableUsers.filter((user) =>
      (user.username || '').toLowerCase().includes(query),
    );
  }, [availableUsers, searchTerm]);

  if (!open) {
    return null;
  }

  return (
    <div className="add-user-modal-overlay" onClick={onClose}>
      <div className="add-user-modal" onClick={(e) => e.stopPropagation()}>
        <div className="add-user-modal-header">
          <div>
            <h3 className="add-user-modal-title">Добавить участника</h3>
            <p className="add-user-modal-subtitle">Можно добавить только друзей, которых ещё нет в группе</p>
          </div>
          <button type="button" className="add-user-modal-close" onClick={onClose} aria-label="Закрыть">
            <Close fontSize="small" />
          </button>
        </div>

        <div className="add-user-modal-content">
          {error && <div className="add-user-modal-error">{error}</div>}

          <div className="add-user-search">
            <div className="add-user-search-input-container">
              <Search className="add-user-search-icon" fontSize="small" />
              <input
                type="text"
                placeholder="Поиск среди друзей..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="add-user-search-input"
              />
            </div>
          </div>

          <div className="add-user-list">
            {loading ? (
              <div className="add-user-empty">Загрузка друзей...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="add-user-empty">
                {searchTerm
                  ? 'Друзья не найдены'
                  : 'Нет друзей, которых можно добавить в эту группу'}
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div key={user.userId} className="add-user-item">
                  <UserAvatar
                    username={user.username}
                    avatarUrl={user.avatarUrl ? buildMediaUrl(user.avatarUrl) : null}
                    avatarColor={user.avatarColor}
                    size={40}
                    statusIndicator={<UserAvatarPresenceDot status={user.userStatus} />}
                  />
                  <div className="add-user-info">
                    <span className="add-user-name">{user.username}</span>
                    <span className="add-user-status-text">{getUserStatusLabel(user.userStatus)}</span>
                  </div>
                  <button
                    type="button"
                    className="add-user-add-btn"
                    onClick={() => handleAddUser(user.userId)}
                    disabled={addingUsers.has(String(user.userId))}
                  >
                    {addingUsers.has(String(user.userId)) ? (
                      'Добавление...'
                    ) : (
                      <>
                        <PersonAdd fontSize="small" />
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
