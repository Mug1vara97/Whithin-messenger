import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';

export const roleApi = {
  getRoles: (connection, serverId) => {
    return connection.invoke("GetRoles", serverId);
  },

  createRole: (connection, serverId, roleData) => {
    return connection.invoke(
      "CreateRole",
      serverId,
      roleData.roleName,
      roleData.color,
      roleData.permissions
    );
  },

  updateRole: (connection, roleId, roleData) => {
    return connection.invoke(
      "UpdateRole",
      roleId,
      roleData.roleName,
      roleData.color,
      roleData.permissions
    );
  },

  deleteRole: (connection, roleId) => {
    return connection.invoke("DeleteRole", roleId);
  },

  assignRole: (connection, targetUserId, roleId) => {
    return connection.invoke("AssignRole", targetUserId, roleId);
  },

  removeRole: (connection, targetUserId, roleId) => {
    return connection.invoke("RemoveRole", targetUserId, roleId);
  },

  getUserRoles: (connection, userId, serverId) => {
    return connection.invoke("GetUserRoles", userId, serverId);
  }
};
