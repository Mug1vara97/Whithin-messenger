import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useMembers } from '../../../entities/member/hooks';
import { useRoles } from '../../../entities/role/hooks';
import { useFriends, useFriendRequests } from '../../../entities/friend';
import { serverApi } from '../../../entities/server/api/serverApi';
import {
  canEditServerMemberNickname,
  canManageRoles,
} from '../../../entities/role/lib/serverPermissions';
import { useProfileModal } from '../contexts/ProfileModalContext';
import { usePresenceOverrides } from './usePresenceOverrides';
import { useServerHubConnection } from './useServerHubConnection';
import {
  buildChannelAccessContext,
  filterMembersWithChannelAccess,
} from '../utils/channelAccessUtils';
import { mapServerMemberToListItem } from '../utils/memberListUtils';
import { getFriendActionForMember } from '../utils/friendActionForMember';
import { buildServerUserContextMenuItems } from '../utils/buildServerUserContextMenuItems';

export const useServerMemberListSidebar = ({
  serverId,
  channelId,
  userId,
  serverOwnerId,
  userPermissions,
  isServerOwner = false,
  serverChannelCategories = [],
  serverChannelFallback = null,
}) => {
  const navigate = useNavigate();
  const { openProfile } = useProfileModal();
  const { resolveStatus } = usePresenceOverrides();
  const { friends, fetchFriends, removeFriend } = useFriends();
  const { pendingRequests, sentRequests, sendRequest, acceptRequest } = useFriendRequests();

  const serverConnection = useServerHubConnection(serverId);
  const {
    members: serverMembers,
    isLoading: serverMembersLoading,
    updateMemberNickname,
    openPrivateChat,
    kickMember,
    fetchMembers,
  } = useMembers(serverConnection, serverId, userId);
  const {
    roles: serverRoles,
    assignRole,
    removeRole,
  } = useRoles(serverConnection, serverId, userId);

  const [fetchedServerCategories, setFetchedServerCategories] = useState(null);
  const [liveChannelCategories, setLiveChannelCategories] = useState(null);
  const [nicknameEditorMember, setNicknameEditorMember] = useState(null);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [roleModal, setRoleModal] = useState({
    open: false,
    x: 0,
    y: 0,
    member: null,
  });
  const [kickTargetMember, setKickTargetMember] = useState(null);

  useEffect(() => {
    setLiveChannelCategories(null);
  }, [serverChannelCategories, serverId, channelId]);

  const refreshServerChannelCategories = useCallback(() => {
    if (!serverId) return;
    serverApi
      .getServerById(serverId)
      .then((data) => {
        setLiveChannelCategories(data?.categories ?? data?.Categories ?? []);
      })
      .catch(() => {});
  }, [serverId]);

  useEffect(() => {
    if (!serverId || !channelId) {
      setFetchedServerCategories(null);
      return undefined;
    }

    if (Array.isArray(serverChannelCategories) && serverChannelCategories.length > 0) {
      setFetchedServerCategories(null);
      return undefined;
    }

    let cancelled = false;
    serverApi
      .getServerById(serverId)
      .then((data) => {
        if (!cancelled) {
          setFetchedServerCategories(data?.categories ?? data?.Categories ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetchedServerCategories([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [serverId, channelId, serverChannelCategories]);

  const channelAccessContext = useMemo(() => {
    if (!serverId || !channelId) return null;

    const categories =
      liveChannelCategories
      ?? (Array.isArray(serverChannelCategories) && serverChannelCategories.length > 0
        ? serverChannelCategories
        : fetchedServerCategories);

    return buildChannelAccessContext(
      categories?.length ? { categories } : null,
      channelId,
      serverChannelFallback,
    );
  }, [
    serverId,
    channelId,
    liveChannelCategories,
    serverChannelCategories,
    fetchedServerCategories,
    serverChannelFallback,
  ]);

  const isChannelAccessPending = Boolean(
    serverId
      && channelId
      && !channelAccessContext
      && (!Array.isArray(serverChannelCategories) || serverChannelCategories.length === 0)
      && fetchedServerCategories === null,
  );

  useEffect(() => {
    if (!serverConnection || !serverId || !channelId) {
      return undefined;
    }

    const matchesCurrentChannel = (eventServerId, eventChannelId) =>
      String(eventServerId) === String(serverId) && String(eventChannelId) === String(channelId);

    const handleChannelAccessChanged = (eventServerId, eventChannelId) => {
      if (!matchesCurrentChannel(eventServerId, eventChannelId)) return;
      refreshServerChannelCategories();
      void fetchMembers();
    };

    const handleChatUpdated = (updatedChat) => {
      const updatedChatId = updatedChat?.chatId ?? updatedChat?.ChatId;
      if (String(updatedChatId) !== String(channelId)) return;
      refreshServerChannelCategories();
    };

    serverConnection.on('ChannelMemberAdded', handleChannelAccessChanged);
    serverConnection.on('ChannelMemberRemoved', handleChannelAccessChanged);
    serverConnection.on('ChatUpdated', handleChatUpdated);

    return () => {
      serverConnection.off('ChannelMemberAdded', handleChannelAccessChanged);
      serverConnection.off('ChannelMemberRemoved', handleChannelAccessChanged);
      serverConnection.off('ChatUpdated', handleChatUpdated);
    };
  }, [
    serverConnection,
    serverId,
    channelId,
    refreshServerChannelCategories,
    fetchMembers,
  ]);

  const sidebarMembers = useMemo(() => {
    if (!serverId) return [];

    if (isChannelAccessPending) {
      return [];
    }

    const accessibleMembers = filterMembersWithChannelAccess(
      serverMembers || [],
      channelAccessContext?.channel ?? null,
      serverOwnerId,
      channelAccessContext?.category ?? null,
    );

    return accessibleMembers.map((member) =>
      mapServerMemberToListItem(member, { serverOwnerId, resolveStatus, serverRoles }),
    );
  }, [
    serverId,
    serverMembers,
    channelAccessContext,
    isChannelAccessPending,
    serverOwnerId,
    resolveStatus,
    serverRoles,
  ]);

  const canEditMemberNickname = useCallback(
    (memberUserId) =>
      canEditServerMemberNickname(userPermissions, isServerOwner, userId, memberUserId),
    [userPermissions, isServerOwner, userId],
  );

  const resolveNicknameEditorMember = useCallback(
    (sidebarMember) => {
      const memberUserId = sidebarMember?.userId;
      if (memberUserId == null) return null;
      return (
        serverMembers.find((member) => String(member.userId) === String(memberUserId)) || {
          userId: memberUserId,
          username: sidebarMember.username,
          login: sidebarMember.login,
          nickname: sidebarMember.nickname,
        }
      );
    },
    [serverMembers],
  );

  const handleOpenNicknameEditor = useCallback(
    (sidebarMember) => {
      const member = resolveNicknameEditorMember(sidebarMember);
      if (!member || !canEditMemberNickname(member.userId)) return;
      setNicknameEditorMember(member);
      setNicknameDraft(member.nickname || '');
    },
    [resolveNicknameEditorMember, canEditMemberNickname],
  );

  const handleCloseNicknameEditor = useCallback(() => {
    setNicknameEditorMember(null);
    setNicknameDraft('');
  }, []);

  const handleOpenPrivateChat = useCallback(
    async (targetUserId) => {
      try {
        const chatData = await openPrivateChat(targetUserId);
        const newChatId = chatData?.chatId ?? chatData?.ChatId;
        if (!newChatId) {
          throw new Error('Сервер не вернул идентификатор чата');
        }
        navigate(`/channels/@me/${newChatId}`);
      } catch (error) {
        alert(error?.message || 'Не удалось открыть личный чат');
      }
    },
    [openPrivateChat, navigate],
  );

  const handleAddFriend = useCallback(
    async (targetUserId) => {
      try {
        await sendRequest(targetUserId);
        await fetchFriends();
      } catch (error) {
        alert(error?.message || 'Не удалось отправить запрос в друзья');
      }
    },
    [sendRequest, fetchFriends],
  );

  const handleAcceptFriend = useCallback(
    async (friendshipId) => {
      try {
        await acceptRequest(friendshipId);
        await fetchFriends();
      } catch (error) {
        alert(error?.message || 'Не удалось принять запрос');
      }
    },
    [acceptRequest, fetchFriends],
  );

  const handleRemoveFriend = useCallback(
    async (targetUserId) => {
      try {
        await removeFriend(targetUserId);
        await fetchFriends();
      } catch (error) {
        alert(error?.message || 'Не удалось удалить из друзей');
      }
    },
    [removeFriend, fetchFriends],
  );

  const handleCopyUserId = useCallback(async (targetUserId) => {
    try {
      await navigator.clipboard.writeText(String(targetUserId));
    } catch {
      alert('Не удалось скопировать ID');
    }
  }, []);

  const openRoleModal = useCallback((member, x, y) => {
    setRoleModal({
      open: true,
      x: Math.max(8, x - 230),
      y,
      member,
    });
  }, []);

  const closeRoleModal = useCallback(() => {
    setRoleModal({ open: false, x: 0, y: 0, member: null });
  }, []);

  const handleRoleToggle = useCallback(
    async (roleId, checked) => {
      if (!roleModal.member) return;
      try {
        if (checked) {
          await assignRole(roleModal.member.userId, roleId);
        } else {
          await removeRole(roleModal.member.userId, roleId);
        }
      } catch (error) {
        alert(error?.message || 'Не удалось обновить роль');
      }
    },
    [roleModal.member, assignRole, removeRole],
  );

  const handleConfirmKick = useCallback(async () => {
    if (!kickTargetMember) return;
    try {
      await kickMember(kickTargetMember.userId);
      setKickTargetMember(null);
    } catch (error) {
      alert(error?.message || 'Не удалось удалить участника с сервера');
    }
  }, [kickMember, kickTargetMember]);

  useEffect(() => {
    if (!roleModal.member) return;
    const updatedMember = serverMembers.find(
      (member) => String(member.userId) === String(roleModal.member.userId),
    );
    if (updatedMember) {
      setRoleModal((prev) => ({ ...prev, member: updatedMember }));
    }
  }, [serverMembers, roleModal.member?.userId]);

  const handleSaveServerNickname = useCallback(async () => {
    if (!nicknameEditorMember || !canEditMemberNickname(nicknameEditorMember.userId)) {
      alert('Недостаточно прав для изменения ника');
      return;
    }

    setNicknameSaving(true);
    try {
      const trimmed = nicknameDraft.trim();
      await updateMemberNickname(
        nicknameEditorMember.userId,
        trimmed.length > 0 ? trimmed : null,
      );
      handleCloseNicknameEditor();
    } catch (error) {
      alert(error?.message || 'Не удалось обновить серверный ник');
    } finally {
      setNicknameSaving(false);
    }
  }, [
    nicknameEditorMember,
    nicknameDraft,
    canEditMemberNickname,
    updateMemberNickname,
    handleCloseNicknameEditor,
  ]);

  const getUserContextMenuItems = useCallback(
    (targetMember, menuPosition = null) => {
      const memberUserId = targetMember?.userId;
      if (memberUserId == null) return [];

      const friendAction = getFriendActionForMember(memberUserId, {
        userId,
        friends,
        pendingRequests,
        sentRequests,
      });
      const canEditNick = canEditMemberNickname(memberUserId);
      const canManageMemberRoles = isServerOwner || canManageRoles(userPermissions, isServerOwner);
      const canKick =
        (isServerOwner || userPermissions?.kickMembers)
        && String(memberUserId) !== String(userId);
      const resolvedMember = resolveNicknameEditorMember(targetMember);

      return buildServerUserContextMenuItems({
        targetUserId: memberUserId,
        currentUserId: userId,
        friendAction,
        isServerContext: true,
        canEditNickname: canEditNick,
        canManageRoles: canManageMemberRoles,
        canKick,
        handlers: {
          onProfile: () =>
            openProfile(memberUserId, targetMember.username, targetMember.status),
          onMessage: () => handleOpenPrivateChat(memberUserId),
          onAddFriend: () => handleAddFriend(memberUserId),
          onAcceptFriend: handleAcceptFriend,
          onRemoveFriend: () => handleRemoveFriend(memberUserId),
          onEditNickname: () => {
            if (resolvedMember) {
              handleOpenNicknameEditor(resolvedMember);
            }
          },
          onManageRoles: () => {
            if (resolvedMember && menuPosition) {
              openRoleModal(resolvedMember, menuPosition.x, menuPosition.y);
            }
          },
          onKick: () => {
            if (resolvedMember) {
              setKickTargetMember(resolvedMember);
            }
          },
          onCopyId: () => handleCopyUserId(memberUserId),
        },
      });
    },
    [
      userId,
      friends,
      pendingRequests,
      sentRequests,
      canEditMemberNickname,
      isServerOwner,
      userPermissions,
      resolveNicknameEditorMember,
      openProfile,
      handleOpenPrivateChat,
      handleAddFriend,
      handleAcceptFriend,
      handleRemoveFriend,
      handleOpenNicknameEditor,
      openRoleModal,
      handleCopyUserId,
    ],
  );

  return {
    sidebarMembers,
    serverRoles,
    isLoading: serverMembersLoading || isChannelAccessPending,
    emptyLabel: 'Нет участников с доступом к каналу',
    getUserContextMenuItems,
    nicknameModal: {
      open: Boolean(nicknameEditorMember),
      member: nicknameEditorMember,
      nicknameDraft,
      saving: nicknameSaving,
      onDraftChange: setNicknameDraft,
      onSave: handleSaveServerNickname,
      onClose: handleCloseNicknameEditor,
    },
    roleModal: {
      open: roleModal.open,
      position: { x: roleModal.x, y: roleModal.y },
      member: roleModal.member,
      roles: serverRoles,
      onClose: closeRoleModal,
      onToggleRole: handleRoleToggle,
    },
    kickModal: {
      member: kickTargetMember,
      onCancel: () => setKickTargetMember(null),
      onConfirm: handleConfirmKick,
    },
  };
};
