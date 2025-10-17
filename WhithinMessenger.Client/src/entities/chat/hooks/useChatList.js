import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import { BASE_URL, HUB_ENDPOINTS } from '../../../shared/lib/constants/apiEndpoints';

export const useChatList = (userId, onChatCreated = null) => {
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading] = useState(false);
  const [connection, setConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const connectionRef = useRef(null);


  useEffect(() => {
    if (!userId) {
      if (connectionRef.current) {
        connectionRef.current.stop();
        connectionRef.current = null;
      }
      return;
    }

    const createConnection = async () => {
      if (connectionRef.current && connectionRef.current.state === signalR.HubConnectionState.Connected) {
        console.log('useChatList: Connection already exists and is connected, skipping creation');
        return;
      }

      if (connectionRef.current) {
        await connectionRef.current.stop();
        connectionRef.current = null;
      }

      const hubUrl = `${BASE_URL}${HUB_ENDPOINTS.CHAT_LIST_HUB}?userId=${userId}`;

      const newConnection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
          skipNegotiation: true,
          transport: signalR.HttpTransportType.WebSockets
        })
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      newConnection.onclose((error) => {
        console.log('SignalR connection closed:', error);
        setIsConnected(false);
      });

      newConnection.onreconnecting((error) => {
        console.log('SignalR reconnecting:', error);
        setIsConnected(false);
      });

      newConnection.onreconnected((connectionId) => {
        console.log('SignalR reconnected:', connectionId);
        setIsConnected(true);
      });

      try {
        await newConnection.start();
        connectionRef.current = newConnection;
        setConnection(newConnection);
        setIsConnected(true);
        console.log('SignalR ChatListHub соединение установлено');
      } catch (err) {
        console.error('Ошибка подключения к ChatListHub:', err);
        setIsConnected(false);
      }
    };

    createConnection();

    return () => {
      if (connectionRef.current) {
        connectionRef.current.stop();
      }
    };
  }, [userId]);

  useEffect(() => {
    if (!connection) return;

    const handleReceiveChats = (receivedChats) => {
      if (Array.isArray(receivedChats)) {
        const sortedChats = [...receivedChats].sort((a, b) => {
          const timeA = new Date(a.lastMessageTime || 0).getTime();
          const timeB = new Date(b.lastMessageTime || 0).getTime();
          return timeB - timeA;
        });
        setChats(sortedChats);
      }
    };

    const handleSearchResults = (results) => {
      console.log('Received search results:', results);
      setSearchResults(results);
    };


    const handleChatCreated = async (createdUserId, chatResult) => {
      console.log('Chat created:', { createdUserId, chatResult, currentUserId: userId });
      
      const isParticipant = createdUserId === userId || chatResult?.targetUserId === userId;
      
      if (isParticipant) {
        console.log('Current user is participant, updating chat list');
        try {
          await connection.invoke("GetUserChats");
        } catch (err) {
          console.error('Error getting chats after creation:', err);
        }
      } else {
        console.log('Current user is not participant, ignoring chat creation');
      }
    };

    const handlePrivateChatCreated = async (chatResult) => {
      console.log('Private chat created:', chatResult);
      try {
        await connection.invoke("GetUserChats");
        
        if (onChatCreated && chatResult?.chatId) {
          onChatCreated(chatResult.chatId);
        }
      } catch (err) {
        console.error('Error getting chats after private chat creation:', err);
      }
    };

    const handleChatDeleted = (data) => {
      if (typeof data === 'object' && data.chatId) {
        setChats(prev => prev.filter(chat => chat.chatId !== data.chatId));
        navigate('/channels/@me');
      }
      else if (typeof data === 'string') {
        setChats(prev => prev.filter(chat => chat.chatId !== data));
        navigate('/channels/@me');
      }
    };

    const handleChatUpdated = (chatId, lastMessage, lastMessageTime) => {
      console.log('Chat updated:', { chatId, lastMessage, lastMessageTime });
      
      setChats(prevChats => {
        const updatedChats = prevChats.map(chat => {
          if (chat.chatId === chatId) {
            console.log(`Updating chat ${chatId}: old lastMessage=${chat.lastMessage}, new lastMessage=${lastMessage}`);
            return {
              ...chat,
              lastMessage: lastMessage,
              lastMessageTime: lastMessageTime
            };
          }
          return chat;
        });
        
        const sortedChats = updatedChats.sort((a, b) => {
          const timeA = new Date(a.lastMessageTime || 0).getTime();
          const timeB = new Date(b.lastMessageTime || 0).getTime();
          return timeB - timeA;
        });
        
        console.log('Chats after sorting:', sortedChats.map(c => ({ id: c.chatId, lastMessage: c.lastMessage, lastMessageTime: c.lastMessageTime })));
        return sortedChats;
      });
    };

    const handleError = (errorMessage) => {
      console.error('SignalR error:', errorMessage);
    };

    connection.off("receivechats", handleReceiveChats);
    connection.off("receivesearchresults", handleSearchResults);
    connection.off("chatcreated", handleChatCreated);
    connection.off("privatechatcreated", handlePrivateChatCreated);
    connection.off("chatdeleted", handleChatDeleted);
    connection.off("chatupdated", handleChatUpdated);
    connection.off("error", handleError);

    connection.on("receivechats", handleReceiveChats);
    connection.on("receivesearchresults", handleSearchResults);
    connection.on("chatcreated", handleChatCreated);
    connection.on("privatechatcreated", handlePrivateChatCreated);
    connection.on("chatdeleted", handleChatDeleted);
    connection.on("chatupdated", handleChatUpdated);
    
    connection.on("error", handleError);

    return () => {
      connection.off("receivechats", handleReceiveChats);
      connection.off("receivesearchresults", handleSearchResults);
      connection.off("chatcreated", handleChatCreated);
      connection.off("privatechatcreated", handlePrivateChatCreated);
      connection.off("chatdeleted", handleChatDeleted);
      connection.off("chatupdated", handleChatUpdated);
      connection.off("error", handleError);
    };
  }, [connection, userId]);

  useEffect(() => {
    if (connection && isConnected) {
      connection.invoke("GetUserChats")
        .catch(err => console.error('Error loading initial chats:', err));
    }
  }, [connection, isConnected]);

  const searchUsers = useCallback(async (query) => {
    if (!query.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    
    if (connection && isConnected) {
      try {
        await connection.invoke("SearchUsers", query.trim());
      } catch (error) {
        console.error('Error searching users:', error);
      }
    } else {
      setIsSearching(false);
    }
  }, [connection, isConnected]);

  const createPrivateChat = useCallback(async (targetUserId) => {
    if (!connection || !isConnected) return;
    
    try {
      const existingChat = chats.find(chat => 
        !chat.isGroupChat && chat.userId === targetUserId
      );
      
      if (existingChat) {
        if (onChatCreated && existingChat.chatId) {
          onChatCreated(existingChat.chatId);
        }
        return existingChat;
      }

      const targetUserIdGuid = typeof targetUserId === 'string' ? targetUserId : targetUserId.toString();
      await connection.invoke("CreatePrivateChat", targetUserIdGuid);
    } catch (error) {
      console.error('Error creating private chat:', error);
      throw error;
    }
  }, [connection, isConnected, chats, onChatCreated]);

  const createGroupChat = useCallback(async () => {
    throw new Error('Group chat creation not implemented yet');
  }, []);

  return {
    chats,
    searchResults,
    isSearching,
    isLoading,
    isConnected,
    searchUsers,
    createPrivateChat,
    createGroupChat
  };
};
