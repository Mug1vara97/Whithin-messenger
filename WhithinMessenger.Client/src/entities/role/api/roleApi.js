import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';

export const roleApi = {
  // Получение ролей сервера через SignalR
  getRoles: (connection, serverId) => {
    return connection.invoke("GetRoles", serverId);
  },

  // Создание роли
  createRole: (connection, serverId, roleData, userId) => {
    return connection.invoke("CreateRole", serverId, roleData, userId);
  },

  // Обновление роли
  updateRole: (connection, roleId, roleData, userId) => {
    return connection.invoke("UpdateRole", roleId, roleData, userId);
  },

  // Удаление роли
  deleteRole: (connection, roleId, userId) => {
    return connection.invoke("DeleteRole", roleId, userId);
  },

  // Назначение роли пользователю
  assignRole: (connection, targetUserId, roleId, currentUserId) => {
    return connection.invoke("AssignRole", targetUserId, roleId, currentUserId);
  },

  // Удаление роли у пользователя
  removeRole: (connection, targetUserId, roleId, currentUserId) => {
    return connection.invoke("RemoveRole", targetUserId, roleId, currentUserId);
  },

  // Получение ролей пользователя
  getUserRoles: (connection, userId, serverId) => {
    return connection.invoke("GetUserRoles", userId, serverId);
  }
};
