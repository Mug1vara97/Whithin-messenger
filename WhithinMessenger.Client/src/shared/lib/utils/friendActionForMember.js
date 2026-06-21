export const getFriendActionForMember = (
  memberId,
  { userId, friends = [], pendingRequests = [], sentRequests = [] } = {},
) => {
  const mid = String(memberId);
  const me = String(userId ?? '');
  if (!me || mid === me) return { kind: 'self' };
  if (friends.some((friend) => String(friend.userId) === mid)) return { kind: 'friend' };
  const incoming = pendingRequests.find((request) => String(request.requesterId) === mid);
  if (incoming) return { kind: 'incoming', requestId: incoming.id };
  if (sentRequests.some((request) => String(request.addresseeId) === mid)) return { kind: 'outgoing' };
  return { kind: 'stranger' };
};
