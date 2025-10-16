import { useState, useRef, useCallback } from 'react';
import { BASE_URL } from '../constants/apiEndpoints';

export const useMessageForward = (userId) => {
  const [messageToForward, setMessageToForward] = useState(null);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [availableChats, setAvailableChats] = useState([]);
  const [forwardMessageText, setForwardMessageText] = useState('');
  const forwardTextareaRef = useRef(null);

  const fetchAvailableChats = useCallback(async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/messages/available-chats/${userId}`);
      if (response.ok) {
        const chats = await response.json();
        setAvailableChats(chats);
      }
    } catch (error) {
      console.error('Error fetching available chats:', error);
    }
  }, [userId]);

  const startForward = useCallback((message) => {
    setMessageToForward(message);
    setForwardModalVisible(true);
    fetchAvailableChats();
  }, [fetchAvailableChats]);

  const closeForwardModal = useCallback(() => {
    setForwardModalVisible(false);
    setMessageToForward(null);
    setForwardMessageText('');
  }, []);

  const handleForward = useCallback(async (targetChatId, onForward) => {
    if (!messageToForward || !onForward) return;

    try {
      await onForward(messageToForward.messageId, targetChatId, forwardMessageText);
      closeForwardModal();
      return true;
    } catch (error) {
      console.error('Error forwarding message:', error);
      return false;
    }
  }, [messageToForward, forwardMessageText, closeForwardModal]);

  return {
    messageToForward,
    forwardModalVisible,
    availableChats,
    forwardMessageText,
    setForwardMessageText,
    forwardTextareaRef,
    startForward,
    closeForwardModal,
    handleForward
  };
};
























