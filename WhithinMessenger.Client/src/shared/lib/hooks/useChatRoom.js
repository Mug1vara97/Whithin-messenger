import { useState, useEffect, useRef, useCallback } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { messageApi } from '../../../entities/message/api/messageApi';
import { BASE_URL } from '../constants/apiEndpoints';

export const useChatRoom = (chatId, userId) => {
  const [messages, setMessages] = useState([]);
  const [connection, setConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [messageToForward, setMessageToForward] = useState(null);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [availableChats, setAvailableChats] = useState([]);
  
  const connectionRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!chatId || !userId) return;

    const connect = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const newConnection = new HubConnectionBuilder()
          .withUrl(`${BASE_URL}/groupchathub?userId=${userId}`)
          .withAutomaticReconnect()
          .build();

        await newConnection.start();
        connectionRef.current = newConnection;
        setConnection(newConnection);
        setIsConnected(true);

        await newConnection.invoke('JoinGroup', parseInt(chatId));
        
        const messages = await newConnection.invoke('GetMessages', parseInt(chatId));
        const formattedMessages = messages.map(msg => ({
          messageId: msg.messageId,
          chatId: parseInt(chatId),
          senderId: msg.senderId,
          senderUsername: msg.senderUsername,
          content: msg.content,
          messageType: msg.messageType || 'text',
          avatarUrl: msg.avatarUrl,
          avatarColor: msg.avatarColor,
          repliedMessage: msg.repliedMessage,
          forwardedMessage: msg.forwardedMessage,
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt,
          isEdited: msg.isEdited || false,
          isDeleted: msg.isDeleted || false
        }));
        
        setMessages(formattedMessages);
        
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ 
            behavior: "auto",
            block: "end"
          });
        }, 100);

      } catch (error) {
        console.error('Connection failed:', error);
        setError(error.message);
        setIsConnected(false);
      } finally {
        setIsLoading(false);
      }
    };

    connect();

    return () => {
      const cleanup = async () => {
        if (connectionRef.current) {
          try {
            connectionRef.current.off('ReceiveMessage');
            connectionRef.current.off('MessageEdited');
            connectionRef.current.off('MessageDeleted');
            
            if (connectionRef.current.state === 'Connected') {
              await connectionRef.current.invoke('LeaveGroup', parseInt(chatId));
            }
            
            await connectionRef.current.stop();
          } catch (err) {
            console.error('Cleanup error:', err);
          } finally {
            connectionRef.current = null;
            setConnection(null);
            setIsConnected(false);
          }
        }
      };
      
      cleanup();
    };
  }, [chatId, userId]);

  useEffect(() => {
    if (!connection) return;

    const handleReceiveMessage = (message) => {
      const formattedMessage = {
        messageId: message.messageId,
        chatId: parseInt(chatId),
        senderId: message.senderId,
        senderUsername: message.senderUsername,
        content: message.content,
        messageType: message.messageType || 'text',
        avatarUrl: message.avatarUrl,
        avatarColor: message.avatarColor,
        repliedMessage: message.repliedMessage,
        forwardedMessage: message.forwardedMessage,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        isEdited: message.isEdited || false,
        isDeleted: message.isDeleted || false
      };

      setMessages(prev => [...prev, formattedMessage]);
      
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ 
          behavior: "smooth",
          block: "end"
        });
      }, 100);
    };

    const handleMessageEdited = (messageId, content) => {
      setMessages(prev => prev.map(msg => 
        msg.messageId === messageId 
          ? { ...msg, content, isEdited: true, updatedAt: new Date().toISOString() }
          : msg
      ));
    };

    const handleMessageDeleted = (messageId) => {
      setMessages(prev => prev.map(msg => 
        msg.messageId === messageId 
          ? { ...msg, content: 'Сообщение удалено', isDeleted: true }
          : msg
      ));
    };

    connection.on('ReceiveMessage', handleReceiveMessage);
    connection.on('MessageEdited', handleMessageEdited);
    connection.on('MessageDeleted', handleMessageDeleted);

    return () => {
      connection.off('ReceiveMessage', handleReceiveMessage);
      connection.off('MessageEdited', handleMessageEdited);
      connection.off('MessageDeleted', handleMessageDeleted);
    };
  }, [connection, chatId]);

  const sendMessage = useCallback(async (content, messageType = 'text') => {
    if (!connection || !content.trim()) return;

    try {
      const messageData = {
        content: content.trim(),
        messageType,
        repliedMessage: replyingToMessage,
        forwardedMessage: messageToForward
      };

      await connection.invoke('SendMessage', parseInt(chatId), messageData);
      
      setReplyingToMessage(null);
      setMessageToForward(null);
    } catch (error) {
      console.error('Error sending message:', error);
      setError(error.message);
    }
  }, [connection, chatId, replyingToMessage, messageToForward]);

  const sendMedia = useCallback(async (file) => {
    if (!connection || !file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('chatId', chatId);

      const response = await fetch(`${BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      const messageType = file.type.startsWith('image/') ? 'image' : 
                         file.type.startsWith('video/') ? 'video' : 
                         file.type.startsWith('audio/') ? 'voice' : 'file';

      await sendMessage(result.url, messageType);
    } catch (error) {
      console.error('Error sending media:', error);
      setError(error.message);
    }
  }, [connection, chatId, sendMessage]);

  const editMessage = useCallback(async (messageId, content) => {
    if (!connection || !content.trim()) return;

    try {
      await connection.invoke('EditMessage', messageId, content.trim(), username);
      setEditingMessageId(null);
    } catch (error) {
      console.error('Error editing message:', error);
      setError(error.message);
    }
  }, [connection, username]);

  const deleteMessage = useCallback(async (messageId) => {
    if (!connection) return;

    try {
      await connection.invoke('DeleteMessage', messageId, username);
    } catch (error) {
      console.error('Error deleting message:', error);
      setError(error.message);
    }
  }, [connection, username]);

  const searchMessages = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    try {
      setIsSearching(true);
      const results = await messageApi.searchMessages(chatId, query);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching messages:', error);
      setError(error.message);
    } finally {
      setIsSearching(false);
    }
  }, [chatId]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
  }, []);

  const replyToMessage = useCallback((message) => {
    setReplyingToMessage(message);
  }, []);

  const forwardMessage = useCallback((message) => {
    setMessageToForward(message);
    setForwardModalVisible(true);
  }, []);

  const cancelReply = useCallback(() => {
    setReplyingToMessage(null);
  }, []);

  const cancelForward = useCallback(() => {
    setMessageToForward(null);
    setForwardModalVisible(false);
  }, []);

  const startRecording = useCallback(() => {
    console.log('Start recording');
  }, []);

  const stopRecording = useCallback(() => {
    console.log('Stop recording');
  }, []);

  return {
    // Состояние
    messages,
    isConnected,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    editingMessageId,
    setEditingMessageId,
    replyingToMessage,
    messageToForward,
    forwardModalVisible,
    setForwardModalVisible,
    availableChats,
    setAvailableChats,
    messagesEndRef,
    
    // Действия
    sendMessage,
    sendMedia,
    editMessage,
    deleteMessage,
    searchMessages,
    clearSearch,
    replyToMessage,
    forwardMessage,
    cancelReply,
    cancelForward,
    startRecording,
    stopRecording
  };
};
