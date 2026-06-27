import { useState, useEffect, useCallback, useRef } from 'react';
import { memberApi } from '../api';
import { normalizeProfilePayload, patchMemberWithProfile } from '../../../shared/lib/utils/profilePatchHelpers';

export const useMembers = (connection, serverId, userId) => {
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const isFetchingRef = useRef(false);

  const fetchMembers = useCallback(async () => {
    if (!connection || !serverId) {
      return;
    }

    if (isFetchingRef.current) {
      return;
    }

    try {
      isFetchingRef.current = true;
      setIsLoading(true);
      setError(null);
      await memberApi.getServerMembers(connection, serverId);
    } catch (err) {
      console.error('Error fetching members:', err);
      setError(err.message);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, [connection, serverId]);

  const kickMember = useCallback(async (memberId) => {
    if (!connection || !serverId) return;

    try {
      setError(null);
      await memberApi.kickMember(connection, serverId, memberId);
    } catch (err) {
      console.error('Error kicking member:', err);
      setError(err.message);
      throw err;
    }
  }, [connection, serverId]);

  const updateMemberNickname = useCallback(async (memberId, nickname) => {
    if (!connection || !serverId) return;

    try {
      setError(null);
      await memberApi.updateMemberNickname(connection, serverId, memberId, nickname);
    } catch (err) {
      console.error('Error updating member nickname:', err);
      setError(err.message);
      throw err;
    }
  }, [connection, serverId]);

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
      setMembers(Array.isArray(loadedMembers) ? loadedMembers : []);
    };

    const handleRoleAssigned = () => {
      void fetchMembers();
    };

    const handleRoleRemoved = () => {
      void fetchMembers();
    };

    const handleMemberAdded = () => {
      void fetchMembers();
    };

    const handleMemberKicked = (kickedUserId) => {
      if (kickedUserId != null) {
        setMembers((prev) =>
          prev.filter((member) => String(member.userId ?? member.UserId) !== String(kickedUserId)),
        );
      }
      void fetchMembers();
    };

    const handleNicknameUpdated = (payload) => {
      const updatedUserId = payload?.userId ?? payload?.UserId;
      if (!updatedUserId) return;
      setMembers((prev) =>
        prev.map((member) =>
          String(member.userId) === String(updatedUserId)
            ? {
                ...member,
                nickname: payload?.nickname ?? payload?.Nickname ?? null,
                username: payload?.username ?? payload?.Username ?? member.username,
                login: payload?.login ?? payload?.Login ?? member.login,
              }
            : member,
        ),
      );
    };

    const handleMemberProfileUpdated = (payload) => {
      const patch = normalizeProfilePayload(payload);
      if (!patch?.userId) {
        return;
      }

      setMembers((prev) => prev.map((member) => patchMemberWithProfile(member, patch)));
    };

    connection.on('ServerMembersLoaded', handleMembersLoaded);
    connection.on('RoleAssigned', handleRoleAssigned);
    connection.on('RoleRemoved', handleRoleRemoved);
    connection.on('MemberAdded', handleMemberAdded);
    connection.on('MemberKicked', handleMemberKicked);
    connection.on('MemberNicknameUpdated', handleNicknameUpdated);
    connection.on('MemberProfileUpdated', handleMemberProfileUpdated);

    void fetchMembers();

    return () => {
      connection.off('ServerMembersLoaded', handleMembersLoaded);
      connection.off('RoleAssigned', handleRoleAssigned);
      connection.off('RoleRemoved', handleRoleRemoved);
      connection.off('MemberAdded', handleMemberAdded);
      connection.off('MemberKicked', handleMemberKicked);
      connection.off('MemberNicknameUpdated', handleNicknameUpdated);
      connection.off('MemberProfileUpdated', handleMemberProfileUpdated);
    };
  }, [connection, serverId, fetchMembers]);

  return {
    members,
    isLoading,
    error,
    fetchMembers,
    kickMember,
    updateMemberNickname,
    openPrivateChat,
  };
};
