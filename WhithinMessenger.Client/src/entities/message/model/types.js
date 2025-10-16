// Типы для сообщений
export const MessageType = {
  TEXT: 'text',
  IMAGE: 'image',
  FILE: 'file',
  VOICE: 'voice',
  VIDEO: 'video'
};

export const MessageStatus = {
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed'
};

export const Message = {
  messageId: null,
  chatId: null,
  senderId: null,
  senderUsername: '',
  content: '',
  messageType: MessageType.TEXT,
  avatarUrl: null,
  avatarColor: null,
  repliedMessage: null,
  forwardedMessage: null,
  createdAt: null,
  updatedAt: null,
  status: MessageStatus.SENT,
  isEdited: false,
  isDeleted: false
};

export const RepliedMessage = {
  messageId: null,
  senderUsername: '',
  content: '',
  messageType: MessageType.TEXT,
  createdAt: null
};

export const ForwardedMessage = {
  messageId: null,
  senderUsername: '',
  content: '',
  messageType: MessageType.TEXT,
  originalChatId: null,
  originalChatName: '',
  createdAt: null
};
























