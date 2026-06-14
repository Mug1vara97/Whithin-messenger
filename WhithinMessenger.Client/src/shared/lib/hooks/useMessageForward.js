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

const normalizeForwardInput = (input) => {
  if (!input) return [];
  const list = Array.isArray(input) ? input : [input];
  return list.filter(canForwardMessage);
};

export const useMessageForward = (currentChatId) => {
  const { servers } = useServerContext();
  const [messagesToForward, setMessagesToForward] = useState([]);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [forwardMessageText, setForwardMessageText] = useState('');
  const [targets, setTargets] = useState([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const resetState = useCallback(() => {
    setMessagesToForward([]);
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

  const startForward = useCallback((input) => {
    const validMessages = normalizeForwardInput(input);
    if (!validMessages.length) {
      setError('Нельзя переслать выбранные сообщения');
      return false;
    }

    setMessagesToForward(validMessages);
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
    const firstMessage = messagesToForward[0];
    if (!firstMessage) return;
    try {
      await navigator.clipboard.writeText(buildMessageLinkText(firstMessage));
      setToastMessage('Ссылка скопирована');
      window.setTimeout(() => setToastMessage(''), 2000);
    } catch (err) {
      console.error('copyMessageLink failed', err);
      setError('Не удалось скопировать ссылку');
    }
  }, [messagesToForward]);

  const forwardToSelected = useCallback(async (onForward) => {
    if (!messagesToForward.length || !onForward || selectedIds.size === 0 || isSending) {
      return 0;
    }

    setIsSending(true);
    setError('');

    let successCount = 0;
    const trimmedComment = (forwardMessageText ?? '').trim();

    try {
      for (const targetChatId of selectedIds) {
        for (let index = 0; index < messagesToForward.length; index += 1) {
          const message = messagesToForward[index];
          const comment = index === 0 ? trimmedComment : '';
          const ok = await onForward(message.messageId, targetChatId, comment);
          if (ok) successCount += 1;
        }
      }

      if (successCount === 0) {
        setError('Не удалось переслать сообщения');
        return 0;
      }

      const messageCount = messagesToForward.length;
      const targetCount = selectedIds.size;
      let toast = 'Сообщение переслано';
      if (messageCount > 1 && targetCount > 1) {
        toast = `Переслано ${messageCount} сообщений в ${targetCount} чатов`;
      } else if (messageCount > 1) {
        toast = `Переслано ${messageCount} сообщений`;
      } else if (targetCount > 1) {
        toast = `Переслано в ${targetCount} чатов`;
      }

      setToastMessage(toast);
      window.setTimeout(() => {
        closeForwardModal();
      }, 450);
      return successCount;
    } catch (err) {
      console.error('Error forwarding messages:', err);
      setError('Не удалось переслать сообщения');
      return successCount;
    } finally {
      setIsSending(false);
    }
  }, [messagesToForward, selectedIds, forwardMessageText, isSending, closeForwardModal]);

  const modalProps = useMemo(() => ({
    isOpen: forwardModalVisible,
    messages: messagesToForward,
    message: messagesToForward.length === 1 ? messagesToForward[0] : null,
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
    messagesToForward,
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
