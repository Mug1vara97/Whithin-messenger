import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FaTimes, FaLock, FaUserMinus } from 'react-icons/fa';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import { useAuthContext } from '../../../lib/contexts/AuthContext';
import tokenManager from '../../../lib/services/tokenManager';
import './ChannelSettingsModal.css';
import '../CreateCategoryModal/CreateCategoryModal.css';

const getAuthHeaders = () => {
  const token = tokenManager.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const parseGuidList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const ChannelSettingsModal = ({
  isOpen,
  onClose,
  channel,
  serverId,
  serverConnection,
  onUpdateChannel,
  onDeleteChannel,
  onAddMemberToChannel,
  onRemoveMemberFromChannel,
}) => {
  const { user } = useAuthContext();
  const [channelName, setChannelName] = useState('');
  const [isPrivateChannel, setIsPrivateChannel] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [serverMembers, setServerMembers] = useState([]);
  const [serverRoles, setServerRoles] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [addingUserId, setAddingUserId] = useState(null);
  const [removingUserId, setRemovingUserId] = useState(null);
  const membersHandlerRef = useRef(null);
  const rolesHandlerRef = useRef(null);

  const initialIsPrivate = channel?.isPrivate === true || channel?.IsPrivate === true;
  const initialRoleIds = useMemo(
    () => parseGuidList(channel?.allowedRoleIds ?? channel?.AllowedRoleIds),
    [channel]
  );
  const channelMemberIds = (channel?.members || channel?.Members || [])
    .map((m) => String(m.userId ?? m.UserId ?? m.user_id))
    .filter(Boolean);

  const fetchServerMembers = useCallback(async () => {
    if (!serverId) return;
    setMembersLoading(true);
    try {
      if (serverConnection?.state === 'Connected') {
        const handler = (loadedMembers) => {
          setServerMembers(Array.isArray(loadedMembers) ? loadedMembers : []);
          setMembersLoading(false);
          serverConnection.off('ServerMembersLoaded', handler);
        };
        membersHandlerRef.current = handler;
        serverConnection.on('ServerMembersLoaded', handler);
        await serverConnection.invoke('GetServerMembers', serverId);
        setTimeout(() => {
          setMembersLoading((prev) => {
            if (prev) serverConnection.off('ServerMembersLoaded', membersHandlerRef.current);
            return false;
          });
        }, 10000);
      } else {
        const res = await fetch(`${BASE_URL}/api/server/${serverId}/members`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        });
        if (res.ok) {
          const data = await res.json();
          setServerMembers(Array.isArray(data) ? data : []);
        } else {
          setServerMembers([]);
        }
        setMembersLoading(false);
      }
    } catch {
      setServerMembers([]);
      setMembersLoading(false);
      if (serverConnection && membersHandlerRef.current) {
        serverConnection.off('ServerMembersLoaded', membersHandlerRef.current);
      }
    }
  }, [serverId, serverConnection]);

  const fetchServerRoles = useCallback(async () => {
    if (!serverId) return;
    setRolesLoading(true);
    try {
      if (serverConnection?.state === 'Connected') {
        const handler = (loadedRoles) => {
          setServerRoles(Array.isArray(loadedRoles) ? loadedRoles : []);
          setRolesLoading(false);
          serverConnection.off('RolesLoaded', handler);
        };
        rolesHandlerRef.current = handler;
        serverConnection.on('RolesLoaded', handler);
        await serverConnection.invoke('GetRoles', serverId);
        setTimeout(() => {
          setRolesLoading((prev) => {
            if (prev) serverConnection.off('RolesLoaded', rolesHandlerRef.current);
            return false;
          });
        }, 10000);
      } else {
        setServerRoles([]);
        setRolesLoading(false);
      }
    } catch {
      setServerRoles([]);
      setRolesLoading(false);
      if (serverConnection && rolesHandlerRef.current) {
        serverConnection.off('RolesLoaded', rolesHandlerRef.current);
      }
    }
  }, [serverId, serverConnection]);

  useEffect(() => {
    if (isOpen && channel) {
      setChannelName(channel.name || channel.groupName || '');
      setIsPrivateChannel(initialIsPrivate);
      setSelectedMemberIds([]);
      setSelectedRoleIds(initialRoleIds);
      setError(null);
      if (initialIsPrivate && serverId) {
        fetchServerMembers();
        fetchServerRoles();
      }
    }
  }, [isOpen, channel, initialIsPrivate, initialRoleIds, serverId, fetchServerMembers, fetchServerRoles]);

  useEffect(() => {
    if (isOpen && isPrivateChannel && serverId) {
      fetchServerMembers();
      fetchServerRoles();
    }
  }, [isOpen, isPrivateChannel, serverId, fetchServerMembers, fetchServerRoles]);

  const toggleMember = (userId) => {
    const id = String(userId);
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleRole = (roleId) => {
    const id = String(roleId);
    setSelectedRoleIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleUpdate = async () => {
    if (!channelName.trim()) {
      setError('Название канала не может быть пустым');
      return;
    }

    const nameChanged = channelName.trim() !== (channel?.name || channel?.groupName || '');
    const privacyChanged = isPrivateChannel !== initialIsPrivate;
    const rolesChanged =
      JSON.stringify([...selectedRoleIds].sort()) !== JSON.stringify([...initialRoleIds].sort());
    const accessChanged = isPrivateChannel && initialIsPrivate && rolesChanged;

    if (!nameChanged && !privacyChanged && !accessChanged) {
      onClose();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (nameChanged) {
        await onUpdateChannel(channel.chatId, {
          name: channelName.trim(),
        });
      }

      if (privacyChanged || accessChanged) {
        await onUpdateChannel(channel.chatId, {
          isPrivate: isPrivateChannel,
          memberIds: isPrivateChannel && !initialIsPrivate ? selectedMemberIds : [],
          allowedRoleIds: isPrivateChannel ? selectedRoleIds : [],
        });
      }

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

  const showMemberPicker = isPrivateChannel && !initialIsPrivate;

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

          <div className="private-channel-row">
            <div className="private-channel-info">
              <div className="private-channel-title">
                <FaLock className="private-icon" aria-hidden />
                <span>Приватный канал</span>
              </div>
              <p className="private-channel-desc">
                Только выбранные роли и участники смогут просматривать этот канал
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={isPrivateChannel}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsPrivateChannel(checked);
                  if (!checked) {
                    setSelectedRoleIds([]);
                    setSelectedMemberIds([]);
                  }
                }}
                disabled={isLoading}
              />
              <span className="toggle-slider" aria-hidden="true" />
            </label>
          </div>

          {isPrivateChannel && serverId && (
            <>
              <div className="form-group access-picker">
                <label className="picker-label">Роли с доступом</label>
                {rolesLoading ? (
                  <div className="picker-loading">Загрузка ролей...</div>
                ) : (
                  <div className="picker-list">
                    {serverRoles.map((role) => {
                      const roleId = String(role.roleId ?? role.RoleId);
                      return (
                        <label key={roleId} className="picker-option">
                          <input
                            type="checkbox"
                            checked={selectedRoleIds.includes(roleId)}
                            onChange={() => toggleRole(roleId)}
                            disabled={isLoading}
                          />
                          <span
                            className="role-color-dot"
                            style={{ backgroundColor: role.color ?? role.Color ?? '#99aab5' }}
                          />
                          <span>{role.roleName ?? role.RoleName ?? 'Роль'}</span>
                        </label>
                      );
                    })}
                    {serverRoles.length === 0 && !rolesLoading && (
                      <div className="picker-empty">На сервере пока нет ролей</div>
                    )}
                  </div>
                )}
              </div>

              {showMemberPicker && (
                <div className="form-group access-picker">
                  <label className="picker-label">Участники с доступом</label>
                  {membersLoading ? (
                    <div className="picker-loading">Загрузка участников...</div>
                  ) : (
                    <div className="picker-list">
                      {serverMembers
                        .filter((m) => String(m.userId ?? m.user_id) !== String(user?.id))
                        .map((m) => {
                          const uid = String(m.userId ?? m.user_id);
                          return (
                            <label key={uid} className="picker-option">
                              <input
                                type="checkbox"
                                checked={selectedMemberIds.includes(uid)}
                                onChange={() => toggleMember(uid)}
                                disabled={isLoading}
                              />
                              <span>{m.username ?? m.userName ?? m.user_name ?? 'Участник'}</span>
                            </label>
                          );
                        })}
                      {serverMembers.length === 0 && !membersLoading && (
                        <div className="picker-empty">Участники сервера не найдены</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {isPrivateChannel && initialIsPrivate && (
            <div className="form-group channel-members-section">
              <label><FaLock className="private-icon" /> Участники приватного канала</label>
              {membersLoading ? (
                <div className="members-loading">Загрузка...</div>
              ) : (
                <>
                  <div className="channel-members-list">
                    {channelMemberIds.map((uid) => {
                      const serverMember = serverMembers.find(
                        (m) => String(m.userId ?? m.user_id) === uid
                      );
                      const displayName = serverMember?.username ?? serverMember?.userName ?? 'Участник';
                      return (
                        <div key={uid} className="channel-member-row">
                          <span className="member-name">{displayName}</span>
                          {onRemoveMemberFromChannel && serverId && channel.chatId && (
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
                          .filter((m) => !channelMemberIds.includes(String(m.userId ?? m.user_id)))
                          .map((m) => (
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
            <div className="info-item">
              <span className="info-label">Приватный:</span>
              <span className="info-value">{isPrivateChannel ? 'Да' : 'Нет'}</span>
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
