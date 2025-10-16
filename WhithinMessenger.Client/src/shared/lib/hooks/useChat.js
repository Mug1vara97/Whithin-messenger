import { useState, useEffect, useRef, useCallback } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { BASE_URL } from '../constants/apiEndpoints';

export const useChat = (chatId, username, userId) => {
  const [messages, setMessages] = useState([]);
  const [connection, setConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const connectionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const currentChatIdRef = useRef(null);

  useEffect(() => {
    const connect = async () => {
      if (!chatId || !userId) return;
      
      // Если уже есть активное соединение для этого чата, не создаем новое
      const chatIdStr = String(chatId);
      if (connectionRef.current && currentChatIdRef.current === chatIdStr) {
        return;
      }

      setIsLoading(true);
      setError(null);

      const newConnection = new HubConnectionBuilder()
        .withUrl(`${BASE_URL}/groupchathub?userId=${userId}`)
        .withAutomaticReconnect()
        .build();

      try {
        await newConnection.start();
        connectionRef.current = newConnection;
        setConnection(newConnection);
        setIsConnected(true);

        // Добавляем обработчик для получения сообщений
        newConnection.on('ReceiveMessages', (messages) => {
          const processedMessages = messages.map((msg) => {
            
            return {
              messageId: msg.messageId,
              senderUsername: msg.senderUsername,
              content: msg.content,
              avatarUrl: msg.avatarUrl,
              avatarColor: msg.avatarColor,
              repliedMessage: msg.repliedMessage || null,
              forwardedMessage: msg.forwardedMessage || null,
              createdAt: msg.createdAt,
              mediaFiles: msg.mediaFiles || []
            };
          });
          
          setMessages(processedMessages);
        });

        // Добавляем обработчик ошибок
        newConnection.on('Error', (errorMessage) => {
          console.error('SignalR Error:', errorMessage);
          setError(errorMessage);
        });

        // Присоединяемся к группе и запрашиваем сообщения
        await newConnection.invoke('JoinGroup', chatId);
        await newConnection.invoke('GetMessages', chatId);
        
        // Сохраняем текущий chatId
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
        if (connectionRef.current) {
          try {
            connectionRef.current.off('MessageSent');
            connectionRef.current.off('MessageEdited');
            connectionRef.current.off('MessageDeleted');
            connectionRef.current.off('ReceiveMessages');
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
  }, [chatId, userId]);

  useEffect(() => {
    if (connection) {
      const receiveMessageHandler = async (messageData) => {
        const newMessage = {
          messageId: messageData.messageId,
          senderUsername: messageData.username,
          content: messageData.content,
          createdAt: new Date().toISOString(),
          avatarUrl: messageData.avatarUrl,
          avatarColor: messageData.avatarColor,
          repliedMessage: messageData.repliedMessage || null,
          forwardedMessage: messageData.forwardedMessage || null,
          mediaFiles: messageData.mediaFiles || []
        };
        
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
  }, [connection]);

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
  }, [connection, username, chatId]);

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
      console.error('❌ Error deleting message:', error);
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
    sendMessage,
    editMessage,
    deleteMessage,
    forwardMessage,
    scrollToBottom
  };
};
