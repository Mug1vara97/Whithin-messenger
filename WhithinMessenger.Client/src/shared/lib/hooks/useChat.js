import { useState, useEffect, useRef, useCallback } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { BASE_URL } from '../constants/apiEndpoints';
import { MessageStatus } from '../../../entities/message/model/types';
import {
  isOwnMessage,
  normalizeMessageStatus,
  pickHigherMessageStatus,
} from '../utils/messageStatus';

const TYPING_IDLE_MS = 3000;
/** Повторный пинг, чтобы у получателя сбрасывался 5‑секундный таймер. */
const TYPING_HEARTBEAT_MS = 2000;
const TYPING_EXPIRE_MS = 5000;

export const formatTypingLabel = (users) => {
  if (!users?.length) return null;
  if (users.length === 1) return `${users[0].username} печатает…`;
  if (users.length === 2) return `${users[0].username} и ${users[1].username} печатают…`;
  return `${users.length} человек печатают…`;
};

export const useChat = (chatId, username, userId) => {
  const [messages, setMessages] = useState([]);
  const [connection, setConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  
  const connectionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const currentChatIdRef = useRef(null);
  const typingExpiryTimersRef = useRef(new Map());
  const typingIdleTimerRef = useRef(null);
  const typingHeartbeatRef = useRef(null);
  const lastTypingSentRef = useRef(false);

  const clearTypingHeartbeat = useCallback(() => {
    if (typingHeartbeatRef.current) {
      clearInterval(typingHeartbeatRef.current);
      typingHeartbeatRef.current = null;
    }
  }, []);

  const startTypingHeartbeat = useCallback(() => {
    clearTypingHeartbeat();
    typingHeartbeatRef.current = setInterval(() => {
      if (!connectionRef.current || !chatId || !username || !lastTypingSentRef.current) return;
      connectionRef.current.invoke('NotifyTyping', chatId, username).catch((err) => {
        console.warn('NotifyTyping heartbeat failed:', err);
      });
    }, TYPING_HEARTBEAT_MS);
  }, [chatId, username, clearTypingHeartbeat]);

  const clearTypingExpiryTimers = useCallback(() => {
    typingExpiryTimersRef.current.forEach((timer) => clearTimeout(timer));
    typingExpiryTimersRef.current.clear();
  }, []);

  const removeTypingUser = useCallback((typingUserId) => {
    const id = String(typingUserId);
    const timer = typingExpiryTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      typingExpiryTimersRef.current.delete(id);
    }
    setTypingUsers((prev) => prev.filter((user) => user.userId !== id));
  }, []);

  const addTypingUser = useCallback((typingUserId, typingUsername) => {
    const id = String(typingUserId);
    if (!id || id === String(userId)) return;

    setTypingUsers((prev) => {
      const filtered = prev.filter((user) => user.userId !== id);
      return [...filtered, { userId: id, username: typingUsername || 'Пользователь' }];
    });

    const existingTimer = typingExpiryTimersRef.current.get(id);
    if (existingTimer) clearTimeout(existingTimer);

    typingExpiryTimersRef.current.set(
      id,
      setTimeout(() => removeTypingUser(id), TYPING_EXPIRE_MS),
    );
  }, [removeTypingUser, userId]);

  const notifyStopTyping = useCallback(async () => {
    clearTypingHeartbeat();
    if (!connectionRef.current || !chatId || !lastTypingSentRef.current) return;
    try {
      await connectionRef.current.invoke('NotifyStopTyping', chatId);
    } catch (err) {
      console.warn('NotifyStopTyping failed:', err);
    } finally {
      lastTypingSentRef.current = false;
    }
  }, [chatId, clearTypingHeartbeat]);

  const notifyTyping = useCallback(() => {
    if (!connectionRef.current || !chatId || !username) return;

    if (!lastTypingSentRef.current) {
      connectionRef.current.invoke('NotifyTyping', chatId, username).catch((err) => {
        console.warn('NotifyTyping failed:', err);
      });
      lastTypingSentRef.current = true;
      startTypingHeartbeat();
    }

    if (typingIdleTimerRef.current) {
      clearTimeout(typingIdleTimerRef.current);
    }
    typingIdleTimerRef.current = setTimeout(() => {
      notifyStopTyping();
    }, TYPING_IDLE_MS);
  }, [chatId, username, notifyStopTyping, startTypingHeartbeat]);

  const handleComposerTextChange = useCallback((text) => {
    if (!text?.trim()) {
      if (typingIdleTimerRef.current) {
        clearTimeout(typingIdleTimerRef.current);
        typingIdleTimerRef.current = null;
      }
      notifyStopTyping();
      return;
    }
    notifyTyping();
  }, [notifyStopTyping, notifyTyping]);

  const acknowledgedDeliveriesRef = useRef(new Set());
  const pendingOptimisticIdRef = useRef(null);

  const normalizeMessage = useCallback((msg, defaultStatus) => {
    if (!msg) return null;
    const senderId = msg.senderId ?? msg.SenderId ?? msg.userId ?? msg.UserId ?? null;
    const rawStatus = msg.status ?? msg.Status ?? defaultStatus;
    const own = isOwnMessage(
      { senderId, senderUsername: msg.senderUsername ?? msg.SenderUsername ?? msg.username ?? msg.UserName },
      userId,
      username,
    );

    return {
      messageId: msg.messageId ?? msg.MessageId ?? msg.id ?? msg.Id,
      senderId,
      senderUsername: msg.senderUsername ?? msg.SenderUsername ?? msg.username ?? msg.UserName ?? '',
      content: msg.content ?? msg.Content ?? '',
      avatarUrl: msg.avatarUrl ?? msg.AvatarUrl ?? null,
      avatarColor: msg.avatarColor ?? msg.AvatarColor ?? null,
      repliedMessage: msg.repliedMessage ?? msg.RepliedMessage ?? null,
      forwardedMessage: msg.forwardedMessage ?? msg.ForwardedMessage ?? null,
      createdAt: msg.createdAt ?? msg.CreatedAt ?? new Date().toISOString(),
      mediaFiles: msg.mediaFiles ?? msg.MediaFiles ?? [],
      status: own
        ? normalizeMessageStatus(rawStatus ?? MessageStatus.SENT)
        : null,
    };
  }, [userId, username]);

  const acknowledgeIncomingDelivery = useCallback(async (message) => {
    if (!connectionRef.current || !chatId || !message?.messageId) return;
    if (isOwnMessage(message, userId, username)) return;

    const deliveryKey = String(message.messageId);
    if (acknowledgedDeliveriesRef.current.has(deliveryKey)) return;

    acknowledgedDeliveriesRef.current.add(deliveryKey);
    try {
      await connectionRef.current.invoke('AcknowledgeDelivery', message.messageId, chatId);
    } catch (err) {
      acknowledgedDeliveriesRef.current.delete(deliveryKey);
      console.warn('AcknowledgeDelivery failed:', err);
    }
  }, [chatId, userId, username]);

  const acknowledgeIncomingMessages = useCallback(async (incomingMessages) => {
    if (!Array.isArray(incomingMessages)) return;
    for (const message of incomingMessages) {
      if (!isOwnMessage(message, userId, username)) {
        await acknowledgeIncomingDelivery(message);
      }
    }
  }, [acknowledgeIncomingDelivery, userId, username]);

  const updateMessageStatus = useCallback((messageId, nextStatus) => {
    const id = String(messageId);
    setMessages((prev) => prev.map((msg) => {
      if (String(msg.messageId) !== id) return msg;
      return {
        ...msg,
        status: pickHigherMessageStatus(msg.status, nextStatus),
      };
    }));
  }, []);

  useEffect(() => {
    const connect = async () => {
      if (!chatId || !userId) return;
      
      const chatIdStr = String(chatId);
      if (connectionRef.current && currentChatIdRef.current === chatIdStr) {
        return;
      }

      setIsLoading(true);
      setError(null);
      setTypingUsers([]);
      clearTypingExpiryTimers();
      clearTypingHeartbeat();
      lastTypingSentRef.current = false;
      acknowledgedDeliveriesRef.current.clear();
      if (typingIdleTimerRef.current) {
        clearTimeout(typingIdleTimerRef.current);
        typingIdleTimerRef.current = null;
      }

      const newConnection = new HubConnectionBuilder()
        .withUrl(`${BASE_URL}/groupchathub?userId=${userId}`)
        .withAutomaticReconnect()
        .build();

      try {
        await newConnection.start();
        connectionRef.current = newConnection;
        setConnection(newConnection);
        setIsConnected(true);

        newConnection.on('ReceiveMessages', (messages) => {
          const source = Array.isArray(messages) ? messages : [];
          const processedMessages = source
            .map((msg) => normalizeMessage(msg))
            .filter(Boolean);

          setMessages(processedMessages);
          acknowledgeIncomingMessages(processedMessages);
        });

        newConnection.on('UserTyping', (eventChatId, typingUserId, typingUsername) => {
          if (String(eventChatId) !== chatIdStr) return;
          addTypingUser(typingUserId, typingUsername);
        });

        newConnection.on('UserStoppedTyping', (eventChatId, typingUserId) => {
          if (String(eventChatId) !== chatIdStr) return;
          removeTypingUser(typingUserId);
        });

        newConnection.on('Error', (errorMessage) => {
          console.error('SignalR Error:', errorMessage);
          setError(errorMessage);
        });

        await newConnection.invoke('JoinGroup', chatId);
        await newConnection.invoke('GetMessages', chatId);
        
        currentChatIdRef.current = chatIdStr;
        
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ 
            behavior: "auto",
            block: "end"
          });
        }, 100);
      } catch (error) {
        console.error('Connection failed: ', error);
        setError('Ошибка подключения к чату: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    };

    connect();

    return () => {
      const cleanup = async () => {
        if (typingIdleTimerRef.current) {
          clearTimeout(typingIdleTimerRef.current);
          typingIdleTimerRef.current = null;
        }
        clearTypingHeartbeat();
        clearTypingExpiryTimers();
        const shouldStopTyping = lastTypingSentRef.current;
        lastTypingSentRef.current = false;
        setTypingUsers([]);

        if (connectionRef.current) {
          try {
            if (connectionRef.current.state === 'Connected' && chatId && shouldStopTyping) {
              await connectionRef.current.invoke('NotifyStopTyping', chatId);
            }
            connectionRef.current.off('MessageSent');
            connectionRef.current.off('MessageEdited');
            connectionRef.current.off('MessageDeleted');
            connectionRef.current.off('MessageStatusChanged');
            connectionRef.current.off('MessageDelivered');
            connectionRef.current.off('MessageRead');
            connectionRef.current.off('ReceiveMessages');
            connectionRef.current.off('UserTyping');
            connectionRef.current.off('UserStoppedTyping');
            connectionRef.current.off('Error');
            
            if (connectionRef.current.state === 'Connected' && chatId) {
              await connectionRef.current.invoke('LeaveGroup', chatId);
            }
            
            if (connectionRef.current.state !== 'Disconnected') {
              await connectionRef.current.stop();
            }
          } catch (err) {
            console.error('Cleanup error:', err);
          } finally {
            connectionRef.current = null;
            currentChatIdRef.current = null;
            setConnection(null);
            setIsConnected(false);
          }
        }
      };
      
      cleanup();
    };
  }, [chatId, userId, addTypingUser, acknowledgeIncomingMessages, clearTypingExpiryTimers, normalizeMessage, removeTypingUser]);

  useEffect(() => {
    if (connection) {
      const receiveMessageHandler = async (messageData) => {
        const newMessage = normalizeMessage(messageData);
        if (!newMessage) return;
        const own = isOwnMessage(newMessage, userId, username);

        setMessages((prev) => {
          const exists = prev.some((msg) => String(msg.messageId) === String(newMessage.messageId));
          if (exists) {
            return prev.map((msg) => (
              String(msg.messageId) === String(newMessage.messageId)
                ? { ...msg, ...newMessage, status: pickHigherMessageStatus(msg.status, newMessage.status) }
                : msg
            ));
          }

          const pendingId = pendingOptimisticIdRef.current;
          if (own && pendingId) {
            pendingOptimisticIdRef.current = null;
            return prev.map((msg) => (
              String(msg.messageId) === pendingId
                ? { ...newMessage, status: pickHigherMessageStatus(MessageStatus.SENT, newMessage.status) }
                : msg
            ));
          }

          return [...prev, newMessage];
        });

        if (!own) {
          await acknowledgeIncomingDelivery(newMessage);
        }
      };

      const messageEditedHandler = (messageId, newContent) => {
        setMessages(prev => prev.map(msg => 
          msg.messageId === messageId ? { ...msg, content: newContent } : msg
        ));
      };

      const messageDeletedHandler = (messageId) => {
        setMessages(prev => prev.filter(msg => msg.messageId !== messageId));
      };

      connection.on('MessageSent', receiveMessageHandler);
      connection.on('MessageEdited', messageEditedHandler);
      connection.on('MessageDeleted', messageDeletedHandler);
      const messageStatusChangedHandler = (messageId, status) => {
        updateMessageStatus(messageId, status);
      };

      connection.on('MessageStatusChanged', messageStatusChangedHandler);

      return () => {
        connection.off('MessageSent', receiveMessageHandler);
        connection.off('MessageEdited', messageEditedHandler);
        connection.off('MessageDeleted', messageDeletedHandler);
        connection.off('MessageStatusChanged', messageStatusChangedHandler);
        connection.off('ReceiveMessages');
        connection.off('Error');
      };
    }
  }, [acknowledgeIncomingDelivery, connection, normalizeMessage, updateMessageStatus, userId, username]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ 
          behavior: "auto",
          block: "end"
        });
      }, 100);
    }
  }, [messages.length]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: "auto",
        block: "end"
      });
    }
  }, []);

  const sendMessage = useCallback(async (content, repliedMessageId = null, forwardedMessage = null) => {
    if (!content.trim() || !connection) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = normalizeMessage({
      messageId: tempId,
      senderId: userId,
      senderUsername: username,
      content,
      createdAt: new Date().toISOString(),
      status: MessageStatus.SENDING,
    });

    if (optimisticMessage) {
      pendingOptimisticIdRef.current = tempId;
      setMessages((prev) => [...prev, optimisticMessage]);
    }

    try {
      if (typingIdleTimerRef.current) {
        clearTimeout(typingIdleTimerRef.current);
        typingIdleTimerRef.current = null;
      }
      await notifyStopTyping();
      await connection.invoke('SendMessage', 
        content, 
        username, 
        chatId, 
        repliedMessageId,
        forwardedMessage
      );
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => prev.map((msg) => (
        String(msg.messageId) === tempId
          ? { ...msg, status: MessageStatus.FAILED }
          : msg
      )));
      setError('Ошибка отправки сообщения');
      return false;
    }
  }, [connection, username, chatId, notifyStopTyping, normalizeMessage, userId]);

  const editMessage = useCallback(async (messageId, newContent) => {
    if (!connection) return;

    try {
      console.log('Sending EditMessage:', { messageId, newContent, username });
      await connection.invoke('EditMessage', messageId, newContent, username);
      return true;
    } catch (error) {
      console.error('Error editing message:', error);
      setError('Ошибка редактирования сообщения');
      return false;
    }
  }, [connection, username]);

  const deleteMessage = useCallback(async (messageId) => {
    if (!connection) return;

    try {
      await connection.invoke('DeleteMessage', messageId, username);
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      setError('Ошибка удаления сообщения');
      return false;
    }
  }, [connection, username]);

  const forwardMessage = useCallback(async (messageId, targetChatId, comment = '') => {
    if (!connection) return;

    try {
      await connection.invoke('ForwardMessage', 
        messageId, 
        targetChatId, 
        username,
        comment
      );
      return true;
    } catch (error) {
      console.error('Error forwarding message:', error);
      setError('Ошибка пересылки сообщения');
      return false;
    }
  }, [connection, username]);

  return {
    messages,
    connection,
    isConnected,
    isLoading,
    error,
    messagesEndRef,
    typingUsers,
    handleComposerTextChange,
    notifyStopTyping,
    sendMessage,
    editMessage,
    deleteMessage,
    forwardMessage,
    scrollToBottom
  };
};
