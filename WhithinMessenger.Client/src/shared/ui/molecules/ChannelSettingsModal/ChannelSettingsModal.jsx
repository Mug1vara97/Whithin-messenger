import React, { useState, useEffect, useCallback } from 'react';
import { FaTimes, FaLock, FaUserMinus } from 'react-icons/fa';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import './ChannelSettingsModal.css';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const ChannelSettingsModal = ({
  isOpen,
  onClose,
  channel,
  serverId,
  onUpdateChannel,
  onDeleteChannel,
  onAddMemberToChannel,
  onRemoveMemberFromChannel,
  currentUserId
}) => {
  const [channelName, setChannelName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [serverMembers, setServerMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [addingUserId, setAddingUserId] = useState(null);
  const [removingUserId, setRemovingUserId] = useState(null);

  const isPrivate = channel?.isPrivate === true;
  const channelMemberIds = (channel?.members || channel?.Members || []).map(m => m.userId ?? m.UserId ?? m.user_id).filter(Boolean);

  const fetchServerMembers = useCallback(async () => {
    if (!serverId || !isPrivate) return;
    setMembersLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/server/${serverId}/members`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
      });
      if (res.ok) {
        const data = await res.json();
        setServerMembers(Array.isArray(data) ? data : []);
      } else setServerMembers([]);
    } catch {
      setServerMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, [serverId, isPrivate]);

  useEffect(() => {
    if (isOpen && channel) {
      setChannelName(channel.name || channel.groupName || '');
      setError(null);
      if (isPrivate && serverId) fetchServerMembers();
    }
  }, [isOpen, channel, isPrivate, serverId, fetchServerMembers]);

  const handleUpdate = async () => {
    if (!channelName.trim()) {
      setError('Название канала не может быть пустым');
      return;
    }

    if (channelName.trim() === (channel?.name || channel?.groupName)) {
      onClose();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onUpdateChannel(channel.chatId, channelName.trim());
      onClose();
    } catch (err) {
      setError(err.message || 'Ошибка при обновлении канала');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Вы уверены, что хотите удалить этот канал?')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onDeleteChannel(channel.chatId);
      onClose();
    } catch (err) {
      setError(err.message || 'Ошибка при удалении канала');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleUpdate();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen || !channel) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Настройки канала</h2>
          <button className="close-button" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="channelName">Название канала</label>
            <input
              id="channelName"
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Введите название канала"
              className={error ? 'error' : ''}
              autoFocus
              disabled={isLoading}
            />
            {error && <div className="error-message">{error}</div>}
          </div>

          {isPrivate && (
            <div className="form-group channel-members-section">
              <label><FaLock className="private-icon" /> Участники приватного канала</label>
              {membersLoading ? (
                <div className="members-loading">Загрузка...</div>
              ) : (
                <>
                  <div className="channel-members-list">
                    {channelMemberIds.map(uid => {
                      const serverMember = serverMembers.find(m => (m.userId ?? m.user_id) === uid);
                      const displayName = serverMember?.username ?? serverMember?.userName ?? 'Участник';
                      return (
                        <div key={uid} className="channel-member-row">
                          <span className="member-name">{displayName}</span>
                          {onRemoveMemberFromChannel && (serverId && channel.chatId) && (
                            <button
                              type="button"
                              className="remove-member-btn"
                              onClick={async () => {
                                setRemovingUserId(uid);
                                try {
                                  await onRemoveMemberFromChannel(serverId, channel.chatId, uid);
                                } finally {
                                  setRemovingUserId(null);
                                }
                              }}
                              disabled={removingUserId !== null}
                              title="Убрать из канала"
                            >
                              <FaUserMinus /> {removingUserId === uid ? '...' : 'Убрать'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {onAddMemberToChannel && serverId && channel.chatId && (
                    <div className="add-member-to-channel">
                      <select
                        className="add-member-select"
                        onChange={async (e) => {
                          const uid = e.target.value;
                          if (!uid) return;
                          e.target.value = '';
                          setAddingUserId(uid);
                          try {
                            await onAddMemberToChannel(serverId, channel.chatId, uid);
                          } finally {
                            setAddingUserId(null);
                          }
                        }}
                        disabled={addingUserId !== null}
                        value=""
                      >
                        <option value="">+ Добавить участника</option>
                        {serverMembers
                          .filter(m => !channelMemberIds.includes(m.userId ?? m.user_id))
                          .map(m => (
                            <option key={m.userId ?? m.user_id} value={m.userId ?? m.user_id}>
                              {m.username ?? m.userName ?? 'Участник'}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="channel-info">
            <div className="info-item">
              <span className="info-label">Тип канала:</span>
              <span className="info-value">
                {channel.chatType === 4 || channel.typeId === 4 ? 'Голосовой' : 'Текстовый'}
              </span>
            </div>
            {isPrivate && (
              <div className="info-item">
                <span className="info-label">Приватный:</span>
                <span className="info-value">Да</span>
              </div>
            )}
            <div className="info-item">
              <span className="info-label">ID канала:</span>
              <span className="info-value">{channel.chatId}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="delete-button"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? 'Удаление...' : 'Удалить канал'}
          </button>
          <div className="footer-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={onClose}
              disabled={isLoading}
            >
              Отмена
            </button>
            <button
              type="button"
              className="save-button"
              onClick={handleUpdate}
              disabled={isLoading}
            >
              {isLoading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChannelSettingsModal;
