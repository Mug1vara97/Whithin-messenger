import { useState, useEffect, useCallback } from 'react';
import { roleApi } from '../api';

export const useRoles = (connection, serverId, userId) => {
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRoles = useCallback(async () => {
    if (!connection || !serverId) {
      console.log('useRoles: Нет connection или serverId:', { connection: !!connection, serverId });
      return;
    }

    if (isLoading) {
      console.log('useRoles: already loading, skipping request');
      return;
    }

    try {
      console.log('useRoles: Запрашиваем роли для сервера:', serverId);
      setIsLoading(true);
      setError(null);
      await roleApi.getRoles(connection, serverId);
    } catch (err) {
      console.error('Error fetching roles:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [connection, serverId]);

  const createRole = useCallback(async (roleData) => {
    if (!connection || !serverId || !userId) {
      console.log('useRoles: Нет connection, serverId или userId для создания роли');
      return;
    }

    try {
      console.log('useRoles: Создаем роль с данными:', roleData);
      setError(null);
      await roleApi.createRole(connection, serverId, roleData, userId);
      console.log('useRoles: Роль успешно создана');
    } catch (err) {
      console.error('Error creating role:', err);
      setError(err.message);
      throw err;
    }
  }, [connection, serverId, userId]);

  const updateRole = useCallback(async (roleId, roleData) => {
    if (!connection || !userId) return;

    try {
      setError(null);
      await roleApi.updateRole(connection, roleId, roleData, userId);
    } catch (err) {
      console.error('Error updating role:', err);
      setError(err.message);
      throw err;
    }
  }, [connection, userId]);

  const deleteRole = useCallback(async (roleId) => {
    if (!connection || !userId) return;

    try {
      setError(null);
      await roleApi.deleteRole(connection, roleId, userId);
    } catch (err) {
      console.error('Error deleting role:', err);
      setError(err.message);
      throw err;
    }
  }, [connection, userId]);

  const assignRole = useCallback(async (targetUserId, roleId) => {
    if (!connection || !userId) return;

    try {
      setError(null);
      await roleApi.assignRole(connection, targetUserId, roleId, userId);
    } catch (err) {
      console.error('Error assigning role:', err);
      setError(err.message);
      throw err;
    }
  }, [connection, userId]);

  const removeRole = useCallback(async (targetUserId, roleId) => {
    if (!connection || !userId) return;

    try {
      setError(null);
      await roleApi.removeRole(connection, targetUserId, roleId, userId);
    } catch (err) {
      console.error('Error removing role:', err);
      setError(err.message);
      throw err;
    }
  }, [connection, userId]);

  useEffect(() => {
    if (!connection) return;

    const handleRolesLoaded = (loadedRoles) => {
      console.log('useRoles: Получены роли через RolesLoaded:', loadedRoles);
      setRoles(loadedRoles);
    };

    const handleRoleCreated = (newRole) => {
      console.log('useRoles: Получено событие RoleCreated:', newRole);
      setRoles(prev => {
        const exists = prev.some(role => role.roleId === newRole.roleId);
        if (exists) {
          console.log('useRoles: Роль уже существует, пропускаем добавление');
          return prev;
        }
        console.log('useRoles: Добавляем новую роль в состояние');
        return [...prev, newRole];
      });
    };

    const handleRoleUpdated = (updatedRole) => {
      console.log('useRoles: Получено событие RoleUpdated:', updatedRole);
      setRoles(prev => {
        const updated = prev.map(role => 
          role.roleId === updatedRole.roleId ? updatedRole : role
        );
        console.log('useRoles: Обновленные роли:', updated);
        return updated;
      });
    };

    const handleRoleDeleted = (deletedRoleId) => {
      console.log('useRoles: Получено событие RoleDeleted:', deletedRoleId);
      setRoles(prev => {
        const filtered = prev.filter(role => role.roleId !== deletedRoleId);
        console.log('useRoles: Роли после удаления:', filtered);
        return filtered;
      });
    };

    connection.on("RolesLoaded", handleRolesLoaded);
    connection.on("RoleCreated", handleRoleCreated);
    connection.on("RoleUpdated", handleRoleUpdated);
    connection.on("RoleDeleted", handleRoleDeleted);

    return () => {
      connection.off("RolesLoaded", handleRolesLoaded);
      connection.off("RoleCreated", handleRoleCreated);
      connection.off("RoleUpdated", handleRoleUpdated);
      connection.off("RoleDeleted", handleRoleDeleted);
    };
  }, [connection, serverId]);

  return {
    roles,
    isLoading,
    error,
    fetchRoles,
    createRole,
    updateRole,
    deleteRole,
    assignRole,
    removeRole
  };
};
