import { useCallback, useMemo, useState } from 'react';

const canSelectMessage = (message) => {
  const messageId = message?.messageId ?? message?.MessageId;
  if (!messageId) return false;
  return !String(messageId).startsWith('temp_');
};

export const useMessageSelection = () => {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const enterSelectionMode = useCallback((initialMessageId = null) => {
    setIsSelectionMode(true);
    setSelectedIds(() => {
      if (!initialMessageId) return new Set();
      return new Set([String(initialMessageId)]);
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleMessage = useCallback((messageId) => {
    const id = String(messageId);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      if (next.size === 0) {
        setIsSelectionMode(false);
      }

      return next;
    });
  }, []);

  const isMessageSelected = useCallback(
    (messageId) => selectedIds.has(String(messageId)),
    [selectedIds],
  );

  const getSelectedMessages = useCallback(
    (messages = []) =>
      messages.filter(
        (message) =>
          selectedIds.has(String(message.messageId)) && canSelectMessage(message),
      ),
    [selectedIds],
  );

  const selectedCount = selectedIds.size;

  const selectionSummary = useMemo(
    () => ({
      isSelectionMode,
      selectedCount,
      selectedIds,
    }),
    [isSelectionMode, selectedCount, selectedIds],
  );

  return {
    ...selectionSummary,
    enterSelectionMode,
    exitSelectionMode,
    toggleMessage,
    isMessageSelected,
    getSelectedMessages,
    canSelectMessage,
  };
};

export function canDeleteMessage(message, username, canModerateMessages) {
  if (!message) return false;
  const isOwn = message.senderUsername === username;
  return isOwn || canModerateMessages;
}

export function filterDeletableMessages(messages, username, canModerateMessages) {
  return messages.filter((message) => canDeleteMessage(message, username, canModerateMessages));
}
