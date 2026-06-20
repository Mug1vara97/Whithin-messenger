import {

  normalizeUserStatus,

  PRESENCE_STATUS,

} from './userStatus';



const resolveMemberId = (member) =>

  member?.userId ?? member?.UserId ?? member?.odUserId ?? member?.id ?? null;



const resolveMemberName = (member) =>

  member?.username ?? member?.Username ?? member?.userName ?? member?.name ?? 'User';



const resolveMemberAvatar = (member) =>

  member?.avatar ?? member?.Avatar ?? member?.avatarUrl ?? member?.AvatarUrl ?? null;



const resolveMemberAvatarColor = (member) =>

  member?.avatarColor ?? member?.AvatarColor ?? '#5865f2';



const resolveMemberNameplate = (member) =>

  member?.nameplate ?? member?.Nameplate ?? null;



const resolveMemberAvatarDecoration = (member) =>

  member?.avatarDecoration ?? member?.AvatarDecoration ?? null;



const resolveMemberStatus = (member) =>

  member?.userStatus ?? member?.UserStatus ?? member?.status ?? PRESENCE_STATUS.OFFLINE;



const resolveMemberLogin = (member) =>

  member?.login ?? member?.Login ?? null;



const resolveMemberNickname = (member) =>

  member?.nickname ?? member?.Nickname ?? null;



const resolveMemberRoles = (member) => member?.roles ?? member?.Roles ?? [];



export const normalizeServerRole = (role) => ({

  roleId: role?.roleId ?? role?.RoleId ?? role?.id ?? null,

  roleName: role?.roleName ?? role?.RoleName ?? '',

  color: role?.color ?? role?.Color ?? null,

  createdAt: role?.createdAt ?? role?.CreatedAt ?? null,

});



const isValidRoleColor = (color) =>

  typeof color === 'string' && color.trim().length > 0;



const sortByName = (a, b) =>

  String(a.username || '').localeCompare(String(b.username || ''), 'ru', {

    sensitivity: 'base',

  });



const sortMembers = (list) =>

  [...list].sort((a, b) => {

    if (a.isServerOwner && !b.isServerOwner) return -1;

    if (!a.isServerOwner && b.isServerOwner) return 1;

    return sortByName(a, b);

  });



export const sortServerRolesForDisplay = (serverRoles = []) =>

  [...serverRoles]

    .map(normalizeServerRole)

    .filter((role) => role.roleId != null)

    .sort((a, b) => {

      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;

      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      if (aTime !== bTime) return bTime - aTime;

      return String(a.roleName).localeCompare(String(b.roleName), 'ru', {

        sensitivity: 'base',

      });

    });



export const getMemberDisplayRole = (memberRoles = [], serverRoles = []) => {

  const normalizedMemberRoles = memberRoles.map(normalizeServerRole);

  if (normalizedMemberRoles.length === 0) {

    return null;

  }



  const sortedServerRoles = sortServerRolesForDisplay(serverRoles);

  if (sortedServerRoles.length === 0) {

    return normalizedMemberRoles[0];

  }



  for (const serverRole of sortedServerRoles) {

    const memberRole = normalizedMemberRoles.find(

      (role) => String(role.roleId) === String(serverRole.roleId)

    );

    if (memberRole) {

      return {

        ...memberRole,

        roleName: memberRole.roleName || serverRole.roleName,

        color: isValidRoleColor(memberRole.color) ? memberRole.color : serverRole.color,

      };

    }

  }



  return normalizedMemberRoles[0];

};



export const mapServerMemberToListItem = (member, { serverOwnerId, resolveStatus, serverRoles } = {}) => {

  const userId = resolveMemberId(member);

  const roles = resolveMemberRoles(member).map(normalizeServerRole);

  const displayRole = getMemberDisplayRole(roles, serverRoles);



  return {

    userId,

    username: resolveMemberName(member),

    login: resolveMemberLogin(member),

    nickname: resolveMemberNickname(member),

    avatar: resolveMemberAvatar(member),

    avatarColor: resolveMemberAvatarColor(member),

    nameplate: resolveMemberNameplate(member),

    avatarDecoration: resolveMemberAvatarDecoration(member),

    status: resolveStatus ? resolveStatus(userId, resolveMemberStatus(member)) : resolveMemberStatus(member),

    roles,

    roleName: displayRole?.roleName ?? null,

    roleColor: isValidRoleColor(displayRole?.color) ? displayRole.color : null,

    displayRoleId: displayRole?.roleId ?? null,

    isServerOwner: serverOwnerId != null && String(userId) === String(serverOwnerId),

  };

};



export const mapChatParticipantToListItem = (participant, { resolveStatus } = {}) => {

  const userId = resolveMemberId(participant);



  return {

    userId,

    username: resolveMemberName(participant),

    avatar: resolveMemberAvatar(participant),

    avatarColor: resolveMemberAvatarColor(participant),

    nameplate: resolveMemberNameplate(participant),

    avatarDecoration: resolveMemberAvatarDecoration(participant),

    status: resolveStatus

      ? resolveStatus(userId, resolveMemberStatus(participant))

      : resolveMemberStatus(participant),

    roles: [],

    roleName: null,

    roleColor: null,

    displayRoleId: null,

    isServerOwner: false,

  };

};



/** Format for ChatInfoModal participant list (SignalR GetChatParticipants shape). */
export const mapServerMemberToChatParticipant = (member, { resolveStatus } = {}) => {
  const userId = resolveMemberId(member);
  const status = resolveStatus
    ? resolveStatus(userId, resolveMemberStatus(member))
    : resolveMemberStatus(member);

  return {
    userId,
    username: resolveMemberName(member),
    avatarUrl: resolveMemberAvatar(member),
    avatarColor: resolveMemberAvatarColor(member),
    nameplate: resolveMemberNameplate(member),
    avatarDecoration: resolveMemberAvatarDecoration(member),
    userStatus: status,
  };
};



export const groupMembersByPresence = (members) => {

  const online = [];

  const offline = [];



  members.forEach((member) => {

    const normalized = normalizeUserStatus(member.status);

    if (normalized === PRESENCE_STATUS.OFFLINE) {

      offline.push(member);

    } else {

      online.push(member);

    }

  });



  return {

    online: sortMembers(online),

    offline: sortMembers(offline),

  };

};



const groupPresenceBucketByRoles = (members, serverRoles) => {

  const sortedRoles = sortServerRolesForDisplay(serverRoles);

  const roleSections = [];

  const assignedMemberIds = new Set();

  const ungrouped = [];



  sortedRoles.forEach((role) => {

    const sectionMembers = sortMembers(

      members.filter((member) => String(member.displayRoleId) === String(role.roleId))

    );



    if (sectionMembers.length === 0) {

      return;

    }



    sectionMembers.forEach((member) => assignedMemberIds.add(String(member.userId)));

    roleSections.push({

      roleId: role.roleId,

      roleName: role.roleName,

      roleColor: isValidRoleColor(role.color) ? role.color : null,

      members: sectionMembers,

    });

  });



  members.forEach((member) => {

    if (!assignedMemberIds.has(String(member.userId))) {

      ungrouped.push(member);

    }

  });



  return {

    roleSections,

    ungrouped: sortMembers(ungrouped),

  };

};



export const groupServerMembersByRoles = (members, serverRoles = []) => {

  const sortedRoles = sortServerRolesForDisplay(serverRoles);

  if (sortedRoles.length === 0) {

    return {

      mode: 'presence',

      ...groupMembersByPresence(members),

    };

  }



  const { online, offline } = groupMembersByPresence(members);



  return {

    mode: 'roles',

    online: groupPresenceBucketByRoles(online, serverRoles),

    offline: groupPresenceBucketByRoles(offline, serverRoles),

  };

};


