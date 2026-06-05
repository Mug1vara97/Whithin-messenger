import { MessageStatus } from '../../../entities/message/model/types';

const STATUS_RANK = {
  [MessageStatus.FAILED]: -1,
  [MessageStatus.SENDING]: 0,
  [MessageStatus.SENT]: 1,
  [MessageStatus.DELIVERED]: 2,
  [MessageStatus.READ]: 3,
};

export const normalizeMessageStatus = (status) => {
  if (!status) return MessageStatus.SENT;
  const value = String(status).toLowerCase();
  return Object.values(MessageStatus).includes(value) ? value : MessageStatus.SENT;
};

export const pickHigherMessageStatus = (currentStatus, nextStatus) => {
  const current = normalizeMessageStatus(currentStatus);
  const next = normalizeMessageStatus(nextStatus);
  return (STATUS_RANK[next] ?? 0) > (STATUS_RANK[current] ?? 0) ? next : current;
};

export const isOwnMessage = (message, userId, username) => {
  const senderId = message?.senderId ?? message?.SenderId;
  if (senderId && userId) {
    return String(senderId) === String(userId);
  }
  return message?.senderUsername === username;
};
