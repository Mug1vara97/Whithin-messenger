import { buildMediaUrl } from '../../../shared/lib/utils/urlHelpers';

const pick = (obj, ...keys) => {
  for (const key of keys) {
    const value = obj?.[key];
    if (value != null && value !== '') return value;
  }
  return null;
};

export const formatFriendAvatar = (avatar) => {
  if (!avatar) return null;
  const url = buildMediaUrl(avatar);
  return url || null;
};

export const normalizeFriend = (friend) => {
  if (!friend) return null;

  return {
    userId: pick(friend, 'userId', 'UserId'),
    username: pick(friend, 'username', 'Username') || 'Пользователь',
    avatar: formatFriendAvatar(pick(friend, 'avatar', 'Avatar')),
    avatarColor: pick(friend, 'avatarColor', 'AvatarColor') || '#5865f2',
    description: pick(friend, 'description', 'Description'),
    status: pick(friend, 'status', 'Status'),
    lastSeen: pick(friend, 'lastSeen', 'LastSeen'),
    friendshipCreatedAt: pick(friend, 'friendshipCreatedAt', 'FriendshipCreatedAt'),
  };
};

export const normalizeFriendRequest = (request) => {
  if (!request) return null;

  return {
    id: pick(request, 'id', 'Id'),
    requesterId: pick(request, 'requesterId', 'RequesterId'),
    addresseeId: pick(request, 'addresseeId', 'AddresseeId'),
    requesterUsername: pick(request, 'requesterUsername', 'RequesterUsername') || 'Пользователь',
    requesterAvatar: formatFriendAvatar(pick(request, 'requesterAvatar', 'RequesterAvatar')),
    requesterAvatarColor: pick(request, 'requesterAvatarColor', 'RequesterAvatarColor') || '#5865f2',
    createdAt: pick(request, 'createdAt', 'CreatedAt'),
  };
};
