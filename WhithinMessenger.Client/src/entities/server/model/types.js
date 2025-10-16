// Типы для серверов
export const ServerType = {
  PRIVATE: 'private',
  PUBLIC: 'public'
};

export const ServerStatus = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  DELETED: 'deleted'
};

export const ServerRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  MEMBER: 'member'
};

export const Server = {
  serverId: null,
  name: '',
  description: '',
  avatar: null,
  banner: null,
  bannerColor: null,
  isPublic: false,
  ownerId: null,
  memberCount: 0,
  position: 0,
  createdAt: null,
  updatedAt: null,
  status: ServerStatus.ACTIVE
};

export const ServerMember = {
  userId: null,
  serverId: null,
  role: ServerRole.MEMBER,
  joinedAt: null,
  permissions: []
};
























