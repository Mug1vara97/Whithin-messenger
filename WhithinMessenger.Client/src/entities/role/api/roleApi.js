import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';

export const roleApi = {
  getRoles: (connection, serverId) => {
    return connection.invoke("GetRoles", serverId);
  },

  createRole: (connection, serverId, roleData, userId) => {
    return connection.invoke("CreateRole", serverId, roleData, userId);
  },

  updateRole: (connection, roleId, roleData, userId) => {
    return connection.invoke("UpdateRole", roleId, roleData, userId);
  },

  deleteRole: (connection, roleId, userId) => {
    return connection.invoke("DeleteRole", roleId, userId);
  },

  assignRole: (connection, targetUserId, roleId, currentUserId) => {
    return connection.invoke("AssignRole", targetUserId, roleId, currentUserId);
  },

  removeRole: (connection, targetUserId, roleId, currentUserId) => {
    return connection.invoke("RemoveRole", targetUserId, roleId, currentUserId);
  },

  getUserRoles: (connection, userId, serverId) => {
    return connection.invoke("GetUserRoles", userId, serverId);
  }
};
