import React, { useState, useMemo, useEffect } from 'react';
import { useRoles } from '../../../entities/role/hooks';
import { PERMISSION_CATEGORIES, PERMISSION_LABELS, DEFAULT_ROLE_COLOR } from '../../../entities/role/model';
import { Button } from '../../../shared/ui/atoms/Button';
import { FormField } from '../../../shared/ui/atoms/FormField';
import './RoleManagement.css';

const RoleManagement = ({ connection, serverId, userId, userPermissions, isServerOwner }) => {
  const {
    roles,
    isLoading,
    createRole,
    updateRole,
    deleteRole,
    fetchRoles
  } = useRoles(connection, serverId, userId);

  const [selectedRole, setSelectedRole] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    roleName: '',
    color: DEFAULT_ROLE_COLOR,
    permissions: {},
    hoist: false,
    mentionable: false
  });

  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) return roles;
    return roles.filter(role => 
      role.roleName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [roles, searchQuery]);

  useEffect(() => {
    if (connection && serverId) {
      console.log('RoleManagement: Загружаем роли для сервера:', serverId);
      setTimeout(() => {
        fetchRoles();
      }, 200);
    }
  }, [connection, serverId, fetchRoles]);

  useEffect(() => {
    console.log('RoleManagement: Роли обновлены:', roles);
  }, [roles]);

  const handleEditRole = (role) => {
    setSelectedRole(role);
    setIsEditing(true);
    setShowCreateForm(false);
    setFormData({
      roleName: role.roleName,
      color: role.color,
      permissions: JSON.parse(role.permissions || '{}'),
      hoist: role.hoist || false,
      mentionable: role.mentionable || false
    });
  };

  const handleCreateNew = () => {
    setShowCreateForm(true);
    setIsEditing(false);
    setSelectedRole(null);
    setFormData({
      roleName: '',
      color: DEFAULT_ROLE_COLOR,
      permissions: {},
      hoist: false,
      mentionable: false
    });
  };

  const handleSubmit = async () => {
    if (!formData.roleName.trim()) {
      alert('Введите название роли');
      return;
    }

    try {
      const roleData = {
        roleName: formData.roleName.trim(),
        color: formData.color,
        permissions: JSON.stringify(formData.permissions),
        hoist: formData.hoist,
        mentionable: formData.mentionable
      };

      if (isEditing) {
        await updateRole(selectedRole.roleId, roleData);
      } else {
        await createRole(roleData);
      }

      resetForm();
    } catch (error) {
      const errorMessage = error.message.includes('уже существует') 
        ? error.message 
        : 'Произошла ошибка при создании роли. Пожалуйста, попробуйте еще раз.';
      alert(errorMessage);
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (!window.confirm('Удалить эту роль?')) return;
    try {
      await deleteRole(roleId);
    } catch (error) {
      alert(error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      roleName: '',
      color: DEFAULT_ROLE_COLOR,
      permissions: {},
      hoist: false,
      mentionable: false
    });
    setIsEditing(false);
    setSelectedRole(null);
    setShowCreateForm(false);
  };

  const handlePermissionChange = (permission, checked) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: checked
      }
    }));
  };

  if (!isServerOwner && !userPermissions?.manageRoles) {
    return (
      <div className="role-management">
        <div className="no-permission">
          <div className="no-permission-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2M21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 9H14V4H19V9Z"/>
            </svg>
          </div>
          <h3>Нет доступа</h3>
          <p>У вас нет прав для управления ролями на этом сервере</p>
        </div>
      </div>
    );
  }

  return (
    <div className="role-management">
      <div className="role-management-content">
        <div className="roles-sidebar">
          <div className="search-section">
            <div className="search-input-wrapper">
              <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/>
              </svg>
              <input
                type="text"
                placeholder="Поиск ролей..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
        
        <div className="roles-list">
            <div className="roles-list-header">
              <span>Роли ({filteredRoles.length})</span>
            </div>
            {isLoading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Загрузка ролей...</p>
              </div>
            ) : filteredRoles.length === 0 ? (
              <div className="empty-state">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2M21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 9H14V4H19V9Z"/>
                </svg>
                <p>Роли не найдены</p>
              </div>
            ) : (
              filteredRoles.map(role => (
            <div 
              key={role.roleId} 
              className={`role-item ${selectedRole?.roleId === role.roleId ? 'selected' : ''}`}
              onClick={() => handleEditRole(role)}
            >
              <div 
                className="role-color-indicator" 
                style={{ backgroundColor: role.color }} 
              />
                  <span className="role-name" style={{ color: role.color }}>
                    {role.roleName}
                  </span>
            </div>
              ))
            )}
            
            <button
              className="create-role-button-bottom"
              onClick={handleCreateNew}
              disabled={isLoading}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
              </svg>
              Создать роль
            </button>
        </div>
      </div>

        <div className="role-form-section">
          {(isEditing || showCreateForm) ? (
            <div className="role-form">
              <div className="form-header">
                <h2>{isEditing ? `Редактировать ${selectedRole?.roleName}` : 'Создание новой роли'}</h2>
                <div className="form-header-actions">
                  {isEditing && (
                    <button className="delete-btn" onClick={() => handleDeleteRole(selectedRole.roleId)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                      </svg>
                      Удалить роль
                    </button>
                  )}
                  <button className="cancel-btn" onClick={resetForm}>
                    Отмена
                  </button>
                  <button className="save-btn" onClick={handleSubmit}>
                    Сохранить
                  </button>
                </div>
                <button className="close-form-btn" onClick={resetForm}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                  </svg>
                  <span className="esc-text">ESC</span>
                </button>
              </div>
              
              <div className="form-content">
                <div className="form-section">
                  <h3>НАЗВАНИЕ РОЛИ</h3>
                  <div className="form-field">
                    <input
                      type="text"
          value={formData.roleName}
          onChange={(e) => setFormData(prev => ({ ...prev, roleName: e.target.value }))}
          placeholder="Введите название роли"
                      className="role-name-input"
                    />
                  </div>
                </div>

                <div className="form-section">
                  <h3>ЦВЕТ РОЛИ</h3>
                  <div className="color-picker-section">
                    <div className="color-picker-main">
                      <div className="color-preview-large" style={{ backgroundColor: formData.color }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/>
                        </svg>
                      </div>
                      <div className="color-palette">
                        {[
                          '#3498db', '#1abc9c', '#f1c40f', '#e67e22', '#e74c3c', '#e91e63', '#9b59b6',
                          '#2980b9', '#16a085', '#f39c12', '#d35400', '#c0392b', '#ad1457', '#8e44ad'
                        ].map(color => (
                          <button
                            key={color}
                            className={`color-option ${formData.color === color ? 'selected' : ''}`}
                            style={{ backgroundColor: color }}
                            onClick={() => setFormData(prev => ({ ...prev, color }))}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3>Редактировать права</h3>
        <div className="permissions-section">
          {Object.entries(PERMISSION_CATEGORIES).map(([key, category]) => (
            <div key={key} className="permission-category">
                        <div className="permissions-list">
              {category.permissions.map(perm => (
                            <div key={perm} className="permission-item">
                              <div className="permission-info">
                                <span className="permission-title">{PERMISSION_LABELS[perm]}</span>
                                <span className="permission-description">
                                  {perm === 'MANAGE_CHANNELS' && 'Позволяет участникам редактировать или удалять каналы.'}
                                  {perm === 'MANAGE_SERVER' && 'Позволяет участникам изменять название, описание, значок и другую связанную информацию этого сервера.'}
                                  {perm === 'MANAGE_ROLES' && 'Позволяет участникам изменять разрешения для каналов и ролей с более низкими правами.'}
                                  {perm === 'MANAGE_ROLES' && 'Позволяет участникам создавать, редактировать и удалять роли.'}
                                  {perm === 'SEND_MESSAGES' && 'Позволяет участникам отправлять сообщения в каналы.'}
                                  {perm === 'MANAGE_MESSAGES' && 'Позволяет участникам удалять сообщения других пользователей.'}
                                  {perm === 'EMBED_LINKS' && 'Позволяет участникам встраивать ссылки в сообщения.'}
                                  {perm === 'ATTACH_FILES' && 'Позволяет участникам прикреплять файлы к сообщениям.'}
                                  {perm === 'READ_MESSAGE_HISTORY' && 'Позволяет участникам читать историю сообщений.'}
                                  {perm === 'MENTION_EVERYONE' && 'Позволяет участникам упоминать всех пользователей.'}
                                  {perm === 'USE_EXTERNAL_EMOJIS' && 'Позволяет участникам использовать внешние эмодзи.'}
                                  {perm === 'ADD_REACTIONS' && 'Позволяет участникам добавлять реакции к сообщениям.'}
                                  {perm === 'CONNECT' && 'Позволяет участникам подключаться к голосовым каналам.'}
                                  {perm === 'SPEAK' && 'Позволяет участникам говорить в голосовых каналах.'}
                                  {perm === 'MUTE_MEMBERS' && 'Позволяет участникам отключать микрофон других пользователей.'}
                                  {perm === 'DEAFEN_MEMBERS' && 'Позволяет участникам отключать звук других пользователей.'}
                                  {perm === 'MOVE_MEMBERS' && 'Позволяет участникам перемещать других пользователей между каналами.'}
                                  {perm === 'USE_VAD' && 'Позволяет участникам использовать определение голоса.'}
                                  {perm === 'PRIORITY_SPEAKER' && 'Позволяет участникам говорить с приоритетом.'}
                                  {perm === 'STREAM' && 'Позволяет участникам транслировать видео.'}
                                  {perm === 'CREATE_INSTANT_INVITE' && 'Позволяет участникам создавать приглашения.'}
                                  {perm === 'CHANGE_NICKNAME' && 'Позволяет участникам изменять свой никнейм.'}
                                  {perm === 'MANAGE_NICKNAMES' && 'Позволяет участникам изменять никнеймы других пользователей.'}
                                  {perm === 'KICK_MEMBERS' && 'Позволяет участникам исключать участников с сервера.'}
                                  {perm === 'BAN_MEMBERS' && 'Позволяет участникам банить участников с сервера.'}
                                  {perm === 'ADMINISTRATOR' && 'Дает все разрешения. Это очень опасное разрешение.'}
                                </span>
                              </div>
                              <div className="permission-controls">
                                <button 
                                  className={`permission-btn deny ${!formData.permissions[perm] ? 'active' : ''}`}
                                  onClick={() => handlePermissionChange(perm, false)}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                                  </svg>
                                </button>
                                <button 
                                  className={`permission-btn neutral ${formData.permissions[perm] === undefined ? 'active' : ''}`}
                                  onClick={() => handlePermissionChange(perm, undefined)}
                                >
                                  <div className="neutral-icon"></div>
                                </button>
                                <button 
                                  className={`permission-btn allow ${formData.permissions[perm] === true ? 'active' : ''}`}
                                  onClick={() => handlePermissionChange(perm, true)}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-form-state">
              <div className="empty-form-content">
                <div className="empty-form-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2M21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 9H14V4H19V9Z"/>
                  </svg>
                </div>
                <h3>Выберите роль для редактирования</h3>
                <p>Выберите роль из списка слева или создайте новую роль</p>
                <Button 
                  variant="primary"
                        onClick={handleCreateNew}
                        className="create-first-role-btn"
                >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
                        </svg>
                        Создать роль
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoleManagement;
