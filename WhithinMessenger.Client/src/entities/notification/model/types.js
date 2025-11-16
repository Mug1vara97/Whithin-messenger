/**
 * @typedef {Object} Notification
 * @property {string} id - Guid notification ID
 * @property {string} userId - Guid user ID
 * @property {string} chatId - Guid chat ID
 * @property {string|null} messageId - Guid message ID (optional)
 * @property {string} type - Notification type: "direct_message", "group_message", "mention", "reaction", "invitation"
 * @property {string} content - Notification content text
 * @property {boolean} isRead - Whether notification is read
 * @property {string} createdAt - ISO datetime string
 * @property {string|null} readAt - ISO datetime string (optional)
 */

/**
 * Notification types
 */
export const NotificationType = {
  DIRECT_MESSAGE: 'direct_message',
  GROUP_MESSAGE: 'group_message',
  MENTION: 'mention',
  REACTION: 'reaction',
  INVITATION: 'invitation'
};


