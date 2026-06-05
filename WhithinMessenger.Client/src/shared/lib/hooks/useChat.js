import { useState, useEffect, useRef, useCallback } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { BASE_URL } from '../constants/apiEndpoints';

const TYPING_IDLE_MS = 3000;
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
  const lastTypingSentRef = useRef(false);

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
    if (!connectionRef.current || !chatId || !lastTypingSentRef.current) return;
    try {
      await connectionRef.current.invoke('NotifyStopTyping', chatId);
    } catch (err) {
      console.warn('NotifyStopTyping failed:', err);
    } finally {
      lastTypingSentRef.current = false;
    }
  }, [chatId]);

  const notifyTyping = useCallback(() => {
    if (!connectionRef.current || !chatId || !username) return;

    if (!lastTypingSentRef.current) {
      connectionRef.current.invoke('NotifyTyping', chatId, username).catch((err) => {
        console.warn('NotifyTyping failed:', err);
      });
      lastTypingSentRef.current = true;
    }

    if (typingIdleTimerRef.current) {
      clearTimeout(typingIdleTimerRef.current);
    }
    typingIdleTimerRef.current = setTimeout(() => {
      notifyStopTyping();
    }, TYPING_IDLE_MS);
  }, [chatId, username, notifyStopTyping]);

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

  const normalizeMessage = useCallback((msg) => {
    if (!msg) return null;
    return {
      messageId: msg.messageId ?? msg.MessageId ?? msg.id ?? msg.Id,
      senderUsername: msg.senderUsername ?? msg.SenderUsername ?? msg.username ?? msg.UserName ?? '',
      content: msg.content ?? msg.Content ?? '',
      avatarUrl: msg.avatarUrl ?? msg.AvatarUrl ?? null,
      avatarColor: msg.avatarColor ?? msg.AvatarColor ?? null,
      repliedMessage: msg.repliedMessage ?? msg.RepliedMessage ?? null,
      forwardedMessage: msg.forwardedMessage ?? msg.ForwardedMessage ?? null,
      createdAt: msg.createdAt ?? msg.CreatedAt ?? new Date().toISOString(),
      mediaFiles: msg.mediaFiles ?? msg.MediaFiles ?? []
    };
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
      lastTypingSentRef.current = false;
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
            .map(normalizeMessage)
            .filter(Boolean);

          setMessages(processedMessages);
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
  }, [chatId, userId, addTypingUser, clearTypingExpiryTimers, normalizeMessage, removeTypingUser]);

  useEffect(() => {
    if (connection) {
      const receiveMessageHandler = async (messageData) => {
        const newMessage = normalizeMessage(messageData);
        if (!newMessage) return;

        setMessages(prev => [...prev, newMessage]);
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
      connection.on('MessageRead', (messageId, readByUserId, readAt) => {
        console.log(`Message ${messageId} read by user ${readByUserId} at ${readAt}`);
      });

      return () => {
        connection.off('MessageSent', receiveMessageHandler);
        connection.off('MessageEdited', messageEditedHandler);
        connection.off('MessageDeleted', messageDeletedHandler);
        connection.off('ReceiveMessages');
        connection.off('Error');
      };
    }
  }, [connection, normalizeMessage]);

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
      setError('Ошибка отправки сообщения');
      return false;
    }
  }, [connection, username, chatId, notifyStopTyping]);

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
