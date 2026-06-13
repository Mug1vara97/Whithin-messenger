import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FaLock } from 'react-icons/fa';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import { useAuthContext } from '../../../lib/contexts/AuthContext';
import tokenManager from '../../../lib/services/tokenManager';
import './CreateCategoryModal.css';

const getAuthHeaders = () => {
  const token = tokenManager.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const EMPTY_GUID_LIST = Object.freeze([]);

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

const CreateCategoryModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialName = '',
  initialIsPrivate = false,
  initialAllowedRoleIds = EMPTY_GUID_LIST,
  initialAllowedUserIds = EMPTY_GUID_LIST,
  title = 'Создать категорию',
  submitButtonText = 'Создать категорию',
  submitLoadingText = 'Сохранение...',
  serverId,
  serverConnection,
}) => {
  const { user } = useAuthContext();
  const [categoryName, setCategoryName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [serverMembers, setServerMembers] = useState([]);
  const [serverRoles, setServerRoles] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const membersHandlerRef = useRef(null);
  const rolesHandlerRef = useRef(null);

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
    if (!isOpen) return;

    setCategoryName(initialName || '');
    setIsPrivate(initialIsPrivate);
    setSelectedRoleIds(parseGuidList(initialAllowedRoleIds));
    setSelectedMemberIds(parseGuidList(initialAllowedUserIds));
    setErrors({});
  }, [isOpen, initialName, initialIsPrivate, initialAllowedRoleIds, initialAllowedUserIds]);

  useEffect(() => {
    if (isOpen && isPrivate && serverId) {
      fetchServerMembers();
      fetchServerRoles();
    }
  }, [isOpen, isPrivate, serverId, fetchServerMembers, fetchServerRoles]);

  const validateForm = () => {
    const newErrors = {};

    if (!categoryName.trim()) {
      newErrors.name = 'Название категории не может быть пустым';
    } else if (categoryName.length < 2) {
      newErrors.name = 'Название категории должно содержать минимум 2 символа';
    } else if (categoryName.length > 50) {
      newErrors.name = 'Название категории не может содержать более 50 символов';
    } else if (!/^[a-zA-Zа-яА-Я0-9\s\-_]+$/.test(categoryName)) {
      newErrors.name = 'Название категории может содержать только буквы, цифры, пробелы, дефисы и подчеркивания';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const toggleRole = (roleId) => {
    const id = String(roleId);
    setSelectedRoleIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const toggleMember = (userId) => {
    const id = String(userId);
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      await onSubmit({
        categoryName: categoryName.trim(),
        isPrivate,
        allowedRoleIds: isPrivate ? selectedRoleIds : [],
        allowedUserIds: isPrivate ? selectedMemberIds : [],
      });

      setCategoryName('');
      setIsPrivate(false);
      setSelectedRoleIds([]);
      setSelectedMemberIds([]);
      onClose();
    } catch (error) {
      setErrors({ submit: error.message || 'Ошибка при сохранении категории' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content category-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="categoryName">Название категории</label>
            <input
              id="categoryName"
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Новая категория"
              className={errors.name ? 'error' : ''}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            {errors.name && <div className="error-message">{errors.name}</div>}
          </div>

          <div className="private-category-row">
            <div className="private-category-info">
              <div className="private-category-title">
                <FaLock className="private-icon" aria-hidden />
                <span>Приватная категория</span>
              </div>
              <p className="private-category-desc">
                Категорию увидят только участники с выбранными ролями или пользователями
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsPrivate(checked);
                  if (!checked) {
                    setSelectedRoleIds([]);
                    setSelectedMemberIds([]);
                  }
                }}
              />
              <span className="toggle-slider" aria-hidden="true" />
            </label>
          </div>

          {isPrivate && serverId && (
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
            </>
          )}

          {errors.submit && (
            <div className="error-message submit-error">{errors.submit}</div>
          )}

          <div className="modal-footer">
            <button
              type="button"
              className="cancel-button"
              onClick={onClose}
              disabled={isLoading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="create-button"
              disabled={isLoading}
            >
              {isLoading ? submitLoadingText : submitButtonText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCategoryModal;
