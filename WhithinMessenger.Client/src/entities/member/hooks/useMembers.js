import { useState, useEffect, useCallback } from 'react';
import { memberApi } from '../api';

export const useMembers = (connection, serverId, userId) => {
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMembers = useCallback(async () => {
    if (!connection || !serverId) {
      console.log('fetchMembers: connection or serverId not available', { connection: !!connection, serverId });
      return;
    }

    if (isLoading) {
      console.log('fetchMembers: already loading, skipping request');
      return;
    }

    try {
      console.log('fetchMembers: calling GetServerMembers for serverId:', serverId);
      setIsLoading(true);
      setError(null);
      await memberApi.getServerMembers(connection, serverId);
    } catch (err) {
      console.error('Error fetching members:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [connection, serverId]);

  const kickMember = useCallback(async (memberId) => {
    if (!connection || !serverId || !userId) return;

    try {
      setError(null);
      await memberApi.kickMember(connection, serverId, memberId, userId);
    } catch (err) {
      console.error('Error kicking member:', err);
      setError(err.message);
      throw err;
    }
  }, [connection, serverId, userId]);

  const openPrivateChat = useCallback(async (targetUserId) => {
    if (!userId) return;

    try {
      setError(null);
      return await memberApi.openPrivateChat(userId, targetUserId);
    } catch (err) {
      console.error('Error opening private chat:', err);
      setError(err.message);
      throw err;
    }
  }, [userId]);

  useEffect(() => {
    if (!connection || !serverId) return;

    const handleMembersLoaded = (loadedMembers) => {
      console.log('ServerMembersLoaded event received:', loadedMembers);
      setMembers(loadedMembers);
    };

    const handleRoleAssigned = async (assignedUserId, roleData) => {
      console.log('RoleAssigned event received:', { assignedUserId, roleData });
      await memberApi.getServerMembers(connection, serverId);
    };

    const handleRoleRemoved = async (removedUserId, removedRoleId) => {
      console.log('RoleRemoved event received:', { removedUserId, removedRoleId });
      await memberApi.getServerMembers(connection, serverId);
    };

    connection.on("ServerMembersLoaded", handleMembersLoaded);
    connection.on("RoleAssigned", handleRoleAssigned);
    connection.on("RoleRemoved", handleRoleRemoved);

    fetchMembers();

    return () => {
      connection.off("ServerMembersLoaded", handleMembersLoaded);
      connection.off("RoleAssigned", handleRoleAssigned);
      connection.off("RoleRemoved", handleRoleRemoved);
    };
  }, [connection, serverId]);

  return {
    members,
    isLoading,
    error,
    fetchMembers,
    kickMember,
    openPrivateChat
  };
};
