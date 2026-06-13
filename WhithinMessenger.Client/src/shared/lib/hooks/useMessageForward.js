import { useState, useCallback, useEffect, useMemo } from 'react';
import { serverApi } from '../../../entities/server/api/serverApi';
import { useServerContext } from '../contexts/useServerContext';
import {
  buildForwardListItems,
  buildMessageLinkText,
  loadForwardChannelTargets,
  loadForwardDirectChats,
} from '../utils/forwardTargets';

const canForwardMessage = (message) => {
  const messageId = message?.messageId ?? message?.MessageId;
  if (!messageId) return false;
  return !String(messageId).startsWith('temp_');
};

export const useMessageForward = (currentChatId) => {
  const { servers } = useServerContext();
  const [messageToForward, setMessageToForward] = useState(null);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [forwardMessageText, setForwardMessageText] = useState('');
  const [targets, setTargets] = useState([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const resetState = useCallback(() => {
    setMessageToForward(null);
    setForwardMessageText('');
    setTargets([]);
    setSelectedIds(new Set());
    setIsSending(false);
    setError('');
    setToastMessage('');
    setLoadingTargets(false);
  }, []);

  const closeForwardModal = useCallback(() => {
    setForwardModalVisible(false);
    resetState();
  }, [resetState]);

  const loadTargets = useCallback(async () => {
    setLoadingTargets(true);
    setError('');
    try {
      const [chats, serverList] = await Promise.all([
        loadForwardDirectChats(),
        servers.length > 0
          ? Promise.resolve(servers)
          : serverApi.getUserServers().catch(() => []),
      ]);

      const channelTargets = await loadForwardChannelTargets(
        Array.isArray(serverList) && serverList.length > 0 ? serverList : servers,
      );

      setTargets(
        buildForwardListItems({
          chats,
          channelTargets,
          currentChatId,
        }),
      );
    } catch (err) {
      console.error('Error loading forward targets:', err);
      setError('Не удалось загрузить список чатов');
      setTargets([]);
    } finally {
      setLoadingTargets(false);
    }
  }, [currentChatId, servers]);

  const startForward = useCallback((message) => {
    if (!canForwardMessage(message)) {
      setError('Нельзя переслать это сообщение');
      return false;
    }

    setMessageToForward(message);
    setForwardModalVisible(true);
    setSelectedIds(new Set());
    setForwardMessageText('');
    setError('');
    setToastMessage('');
    return true;
  }, []);

  useEffect(() => {
    if (!forwardModalVisible) return undefined;
    loadTargets();

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !isSending) {
        closeForwardModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [forwardModalVisible, loadTargets, closeForwardModal, isSending]);

  const toggleTarget = useCallback((chatId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) {
        next.delete(chatId);
      } else {
        next.add(chatId);
      }
      return next;
    });
  }, []);

  const copyMessageLink = useCallback(async () => {
    if (!messageToForward) return;
    try {
      await navigator.clipboard.writeText(buildMessageLinkText(messageToForward));
      setToastMessage('Ссылка скопирована');
      window.setTimeout(() => setToastMessage(''), 2000);
    } catch (err) {
      console.error('copyMessageLink failed', err);
      setError('Не удалось скопировать ссылку');
    }
  }, [messageToForward]);

  const forwardToSelected = useCallback(async (onForward) => {
    if (!messageToForward || !onForward || selectedIds.size === 0 || isSending) {
      return 0;
    }

    setIsSending(true);
    setError('');

    let successCount = 0;
    try {
      for (const targetChatId of selectedIds) {
        const ok = await onForward(
          messageToForward.messageId,
          targetChatId,
          forwardMessageText,
        );
        if (ok) successCount += 1;
      }

      if (successCount === 0) {
        setError('Не удалось переслать сообщение');
        return 0;
      }

      const toast = successCount === 1
        ? 'Сообщение переслано'
        : `Переслано в ${successCount} чатов`;
      setToastMessage(toast);
      window.setTimeout(() => {
        closeForwardModal();
      }, 450);
      return successCount;
    } catch (err) {
      console.error('Error forwarding message:', err);
      setError('Не удалось переслать сообщение');
      return successCount;
    } finally {
      setIsSending(false);
    }
  }, [messageToForward, selectedIds, forwardMessageText, isSending, closeForwardModal]);

  const modalProps = useMemo(() => ({
    isOpen: forwardModalVisible,
    message: messageToForward,
    targets,
    loading: loadingTargets,
    error,
    comment: forwardMessageText,
    onCommentChange: setForwardMessageText,
    selectedIds,
    onToggleTarget: toggleTarget,
    isSending,
    onCopyLink: copyMessageLink,
    toastMessage,
    onClose: closeForwardModal,
  }), [
    forwardModalVisible,
    messageToForward,
    targets,
    loadingTargets,
    error,
    forwardMessageText,
    selectedIds,
    toggleTarget,
    isSending,
    copyMessageLink,
    toastMessage,
    closeForwardModal,
  ]);

  return {
    forwardModalVisible,
    startForward,
    closeForwardModal,
    forwardToSelected,
    modalProps,
  };
};
