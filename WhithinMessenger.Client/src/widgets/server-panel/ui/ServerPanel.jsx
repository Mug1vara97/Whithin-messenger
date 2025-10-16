import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { useAuthContext } from '../../../shared/lib/contexts/AuthContext';
// import { useServers } from '../../../entities/server'; // Убираем useServers из ServerPanel
import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import { CategoriesList } from '../../categories-list';
import { CreateChannelModal, ChannelSettingsModal, CreateCategoryModal, ContextMenu, UserPanel, AddMemberModal } from '../../../shared/ui/molecules';
import { 
  CreateNewFolder, 
  Add, 
  Edit, 
  Delete,
  Settings,
  PersonAdd,
  ExitToApp
} from '@mui/icons-material';
import './ServerPanel.css';

const ServerPanel = ({ 
  selectedServer, 
  onChatSelected, 
  selectedChat,
  onServerDataUpdated
}) => {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  // Убираем useServers из ServerPanel - он создает дополнительные подключения
  // const { createCategory, servers: userServers, connection: serverConnection } = useServers(user?.id, null, selectedServer?.serverId);
  
  // Создаем категорию через API напрямую
  const createCategory = useCallback(async (categoryData) => {
    if (!selectedServer?.serverId) return;
    
    try {
      const response = await fetch(`${BASE_URL}/api/server/${selectedServer.serverId}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(categoryData)
      });
      
      if (response.ok) {
        const newCategory = await response.json();
        console.log('Category created:', newCategory);
        // Обновляем данные сервера
        fetchServerData();
        return newCategory;
      } else {
        throw new Error('Failed to create category');
      }
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }, [selectedServer?.serverId]);
  
  
  const [server, setServer] = useState(null);
  const [serverBanner, setServerBanner] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [selectedCategoryForChannel, setSelectedCategoryForChannel] = useState(null);
  const [showChannelSettingsModal, setShowChannelSettingsModal] = useState(false);
  const [selectedChannelForSettings, setSelectedChannelForSettings] = useState(null);
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [contextMenu, setContextMenu] = useState({ isOpen: false, position: { x: 0, y: 0 }, type: null, data: null });
  const [serverConnection, setServerConnection] = useState(null);
  const connectionRef = useRef(null);
  const currentServerRef = useRef(null);
  
  // Определяем текущий сервер
  const currentServer = server || selectedServer;
  const isConnectingRef = useRef(false);

  const fetchServerData = useCallback(async () => {
    if (!selectedServer?.serverId) return;
    
    try {
      const response = await fetch(`${BASE_URL}/api/server/${selectedServer.serverId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const serverData = await response.json();
        console.log('ServerPanel: Received server data:', serverData);
        setServer(serverData);
      }
    } catch (error) {
      console.error('Error fetching server data:', error);
    }
  }, [selectedServer?.serverId]);


  // Обработчик для создания чата через SignalR
  useEffect(() => {
    if (!serverConnection) return;

    const handleChatCreated = (newChat, categoryId) => {
      console.log('ServerPanel: ChatCreated event received:', { newChat, categoryId });
      setServer(prev => {
        if (!prev) return prev;
        
        const updatedCategories = [...(prev.categories || [])];
        
        // Обрабатываем новый чат
        const processedChat = {
          ...newChat,
          chatId: newChat.chatId || newChat.ChatId,
          name: newChat.name || newChat.Name,
          categoryId: newChat.categoryId || newChat.CategoryId,
          chatOrder: newChat.chatOrder || newChat.ChatOrder,
          typeId: newChat.typeId || newChat.TypeId,
          isPrivate: newChat.isPrivate || newChat.IsPrivate,
          allowedRoleIds: newChat.allowedRoleIds || newChat.AllowedRoleIds,
          members: newChat.members || newChat.Members || []
        };
        
        if (categoryId === null) {
          // Ищем существующую категорию без категории (null category)
          const existingNullCategory = updatedCategories.find(cat => {
            const id = cat.categoryId || cat.CategoryId;
            return id === null || id === undefined;
          });
          if (existingNullCategory) {
            // Проверяем, не существует ли уже такой канал
            const existingChat = (existingNullCategory.chats || existingNullCategory.Chats || []).find(chat => 
              (chat.chatId || chat.ChatId) === (processedChat.chatId || processedChat.ChatId)
            );
            
            if (!existingChat) {
              // Добавляем чат в существующую null категорию только если его еще нет
              existingNullCategory.chats = [...(existingNullCategory.chats || existingNullCategory.Chats || []), processedChat];
            }
          } else {
            // Создаем новую null категорию (она будет отображаться как uncategorized-channels)
            const newNullCategory = {
              categoryId: null,
              categoryName: null,
              chats: [processedChat],
              categoryOrder: -1 // Специальный порядок для null категории
            };
            updatedCategories.push(newNullCategory);
          }
        } else {
          // Добавляем чат в существующую категорию
          const categoryIndex = updatedCategories.findIndex(cat => (cat.categoryId || cat.CategoryId) === categoryId);
          if (categoryIndex !== -1) {
            const existingChat = (updatedCategories[categoryIndex].chats || updatedCategories[categoryIndex].Chats || []).find(chat => 
              (chat.chatId || chat.ChatId) === (processedChat.chatId || processedChat.ChatId)
            );
            
            if (!existingChat) {
              updatedCategories[categoryIndex] = {
                ...updatedCategories[categoryIndex],
                chats: [...(updatedCategories[categoryIndex].chats || updatedCategories[categoryIndex].Chats || []), processedChat]
              };
            }
          }
        }
        
        const updatedServer = { ...prev, categories: updatedCategories };
        
        // Уведомляем HomePage об обновлении данных
        if (onServerDataUpdated) {
          onServerDataUpdated(updatedServer);
        }
        
        return updatedServer;
      });
    };

    const handleChatDeleted = (chatId, categoryId) => {
      console.log('ServerPanel: ChatDeleted event received:', { chatId, categoryId });
      setServer(prev => {
        if (!prev) return prev;
        
        const updatedCategories = [...(prev.categories || [])].map(cat => ({
          ...cat,
          chats: (cat.chats || cat.Chats || []).filter(chat => (chat.chatId || chat.ChatId) !== chatId)
        })).filter(cat => {
          // Удаляем пустые null категории
          if ((cat.categoryId || cat.CategoryId) === null) {
            return (cat.chats || cat.Chats || []).length > 0;
          }
          return true;
        });
        
        const updatedServer = { ...prev, categories: updatedCategories };
        
        // Уведомляем HomePage об обновлении данных
        if (onServerDataUpdated) {
          onServerDataUpdated(updatedServer);
        }
        
        return updatedServer;
      });
    };

    const handleChatUpdated = (updatedChat) => {
      console.log('ServerPanel: ChatUpdated event received:', updatedChat);
      setServer(prev => {
        if (!prev) return prev;
        
        const processedChat = {
          ...updatedChat,
          chatId: updatedChat.chatId || updatedChat.ChatId,
          name: updatedChat.name || updatedChat.Name,
          categoryId: updatedChat.categoryId || updatedChat.CategoryId,
          chatOrder: updatedChat.chatOrder || updatedChat.ChatOrder,
          typeId: updatedChat.typeId || updatedChat.TypeId,
          isPrivate: updatedChat.isPrivate || updatedChat.IsPrivate,
          allowedRoleIds: updatedChat.allowedRoleIds || updatedChat.AllowedRoleIds,
          members: updatedChat.members || updatedChat.Members || []
        };
        
        const updatedCategories = [...(prev.categories || [])].map(cat => ({
          ...cat,
          chats: (cat.chats || cat.Chats || []).map(chat => 
            (chat.chatId || chat.ChatId) === (processedChat.chatId || processedChat.ChatId) ? processedChat : chat
          )
        }));
        
        const updatedServer = { ...prev, categories: updatedCategories };
        
        // Уведомляем HomePage об обновлении данных
        if (onServerDataUpdated) {
          onServerDataUpdated(updatedServer);
        }
        
        return updatedServer;
      });
    };

    const handleCategoryCreated = (newCategory) => {
      console.log('ServerPanel: CategoryCreated event received:', newCategory);
      setServer(prev => {
        if (!prev) return prev;
        
        const processedCategory = {
          ...newCategory,
          categoryId: newCategory.categoryId || newCategory.CategoryId,
          categoryName: newCategory.categoryName || newCategory.CategoryName,
          categoryOrder: newCategory.categoryOrder || newCategory.CategoryOrder,
          isPrivate: newCategory.isPrivate || newCategory.IsPrivate,
          allowedRoleIds: newCategory.allowedRoleIds || newCategory.AllowedRoleIds,
          allowedUserIds: newCategory.allowedUserIds || newCategory.AllowedUserIds,
          chats: (newCategory.chats || newCategory.Chats || []).map(chat => ({
            ...chat,
            chatId: chat.chatId || chat.ChatId,
            name: chat.name || chat.Name,
            categoryId: chat.categoryId || chat.CategoryId,
            chatOrder: chat.chatOrder || chat.ChatOrder,
            typeId: chat.typeId || chat.TypeId,
            isPrivate: chat.isPrivate || chat.IsPrivate,
            allowedRoleIds: chat.allowedRoleIds || chat.AllowedRoleIds,
            members: chat.members || chat.Members || []
          }))
        };
        
        const updatedCategories = [...(prev.categories || []), processedCategory];
        
        const updatedServer = { ...prev, categories: updatedCategories };
        
        // Уведомляем HomePage об обновлении данных
        if (onServerDataUpdated) {
          onServerDataUpdated(updatedServer);
        }
        
        return updatedServer;
      });
    };

    const handleCategoryDeleted = (categoryId) => {
      console.log('ServerPanel: CategoryDeleted event received:', categoryId);
      setServer(prev => {
        if (!prev) return prev;
        
        const updatedCategories = (prev.categories || []).filter(cat => 
          (cat.categoryId || cat.CategoryId) !== categoryId
        );
        
        const updatedServer = { ...prev, categories: updatedCategories };
        
        // Уведомляем HomePage об обновлении данных
        if (onServerDataUpdated) {
          onServerDataUpdated(updatedServer);
        }
        
        return updatedServer;
      });
    };

    console.log('ServerPanel: Registering SignalR handlers, serverConnection:', serverConnection);
    serverConnection.on("ChatCreated", handleChatCreated);
    serverConnection.on("ChatDeleted", handleChatDeleted);
    serverConnection.on("ChatUpdated", handleChatUpdated);
    serverConnection.on("CategoryCreated", handleCategoryCreated);
    serverConnection.on("CategoryDeleted", handleCategoryDeleted);

    return () => {
      serverConnection.off("ChatCreated", handleChatCreated);
      serverConnection.off("ChatDeleted", handleChatDeleted);
      serverConnection.off("ChatUpdated", handleChatUpdated);
      serverConnection.off("CategoryCreated", handleCategoryCreated);
      serverConnection.off("CategoryDeleted", handleCategoryDeleted);
    };
  }, [serverConnection, onServerDataUpdated]);


  const fetchServerBanner = useCallback(async () => {
    if (!selectedServer?.serverId) return;
    
    try {
      const response = await fetch(`${BASE_URL}/api/server/${selectedServer.serverId}/banner`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setServerBanner(data);
      } else {
        setServerBanner(null);
      }
    } catch (error) {
      console.error('Error fetching server banner:', error);
      setServerBanner(null);
    }
  }, [selectedServer?.serverId]);

  useEffect(() => {
    if (selectedServer) {
      fetchServerData();
      fetchServerBanner();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServer]);


  useEffect(() => {
    let isMounted = true;
    
    // Предотвращаем множественные вызовы для одного и того же сервера
    if (currentServerRef.current === selectedServer?.serverId && 
        connectionRef.current && 
        connectionRef.current.state === 'Connected') {
      console.log('Connection already exists and is connected, skipping...');
      return;
    }
    
    const connectToServer = async () => {
      console.log('connectToServer: selectedServer?.serverId:', selectedServer?.serverId, 'user?.userId:', user?.userId, 'user?.id:', user?.id);
      if (!selectedServer?.serverId || !user?.id) return;
      
      // Проверяем, что подключение уже существует для этого сервера
      if (currentServerRef.current === selectedServer.serverId && 
          connectionRef.current && 
          (connectionRef.current.state === 'Connected' || connectionRef.current.state === 'Connecting')) {
        console.log('Connection already exists for this server, skipping...');
        return;
      }
      
      if (isConnectingRef.current) {
        console.log('Connection already in progress, skipping...');
        return;
      }
      
      isConnectingRef.current = true;
      
      if (connectionRef.current) {
        console.log('Stopping existing connection...');
        await         connectionRef.current.stop();
        connectionRef.current = null;
        setServerConnection(null);
      }
      console.log('ServerPanel: Creating connection to serverhub with userId:', user.id);
      const newConnection = new HubConnectionBuilder()
        .withUrl(`${BASE_URL}/serverhub?userId=${user.id}`, {
          skipNegotiation: true,
          transport: 1 // WebSockets
        })
        .withAutomaticReconnect()
        .build();
      console.log('ServerPanel: Connection created, starting...');

      newConnection.onreconnected(() => {
        if (selectedServer?.serverId) {
          // Добавляем задержку перед повторным подключением к группе
          setTimeout(() => {
            newConnection.invoke("JoinServerGroup", selectedServer.serverId.toString())
              .catch(error => console.error('Error rejoining server group:', error));
          }, 200);
        }
      });

      try {
        console.log('ServerPanel: Attempting to start connection...');
        await newConnection.start();
        console.log('ServerPanel: Connection started successfully');
        
        if (!isMounted) {
          console.log('Component unmounted during connection, stopping...');
          await newConnection.stop();
          return;
        }
        
        if (!isMounted) {
          console.log('Component unmounted before setting connection, stopping...');
          await newConnection.stop();
          return;
        }
        
        connectionRef.current = newConnection;
        setServerConnection(newConnection);
        currentServerRef.current = selectedServer.serverId;
        console.log('Connected to server hub');
        
        // Добавляем небольшую задержку перед вызовом JoinServerGroup
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
          await newConnection.invoke("JoinServerGroup", selectedServer.serverId.toString());
          console.log('ServerPanel: Successfully connected to serverhub and joined group');
        } catch (error) {
          console.error('ServerPanel: Error joining server group:', error);
          // Не прерываем подключение, так как это не критично
        }
        
        if (!isMounted) {
          console.log('Component unmounted before adding handlers, stopping...');
          await newConnection.stop();
          return;
        }
        
        newConnection.off("ChatCreated");
        newConnection.off("ChatDeleted");
        newConnection.off("ChatUpdated");
        newConnection.off("CategoryCreated");
        newConnection.off("CategoryDeleted");
        
        newConnection.on("ChatCreated", (newChat, categoryId) => {
          if (!isMounted) return;
          console.log('ChatCreated event received:', newChat, categoryId);
          setServer(prev => {
            if (!prev) return prev;
            
            const updatedCategories = [...(prev.categories || prev.Categories || [])];
            
            if (categoryId === null) {
              const existingNullCategory = updatedCategories.find(cat => (cat.categoryId || cat.CategoryId) === null);
              if (existingNullCategory) {
                existingNullCategory.chats = [...(existingNullCategory.chats || existingNullCategory.Chats || []), newChat];
              } else {
                updatedCategories.push({
                  categoryId: null,
                  categoryName: null,
                  chats: [newChat],
                  categoryOrder: -1
                });
              }
            } else {
              const categoryIndex = updatedCategories.findIndex(cat => (cat.categoryId || cat.CategoryId) === categoryId);
              if (categoryIndex !== -1) {
                updatedCategories[categoryIndex] = {
                  ...updatedCategories[categoryIndex],
                  chats: [...(updatedCategories[categoryIndex].chats || updatedCategories[categoryIndex].Chats || []), newChat]
                };
              }
            }
            
            return { ...prev, categories: updatedCategories };
          });
        });
        
        newConnection.on("ChatDeleted", (chatId) => {
          if (!isMounted) return;
          console.log('ChatDeleted event received:', chatId);
          setServer(prev => {
            if (!prev) return prev;
            
            const updatedCategories = (prev.categories || prev.Categories || []).map(cat => ({
              ...cat,
              chats: (cat.chats || cat.Chats || []).filter(chat => (chat.chatId || chat.ChatId) !== chatId)
            }));
            
            return { ...prev, categories: updatedCategories };
          });
        });
        
        newConnection.on("ChatUpdated", (updatedChat) => {
          if (!isMounted) return;
          console.log('ChatUpdated event received:', updatedChat);
          setServer(prev => {
            if (!prev) return prev;
            
            const updatedCategories = (prev.categories || prev.Categories || []).map(cat => ({
              ...cat,
              chats: (cat.chats || cat.Chats || []).map(chat => 
                (chat.chatId || chat.ChatId) === (updatedChat.chatId || updatedChat.ChatId) ? updatedChat : chat
              )
            }));
            
            return { ...prev, categories: updatedCategories };
          });
        });
        
        newConnection.on("CategoryCreated", (newCategory) => {
          if (!isMounted) return;
          console.log('CategoryCreated event received:', newCategory);
          setServer(prev => {
            if (!prev) return prev;
            
            const updatedCategories = [...(prev.categories || prev.Categories || []), newCategory]
              .sort((a, b) => (a.categoryOrder || a.CategoryOrder) - (b.categoryOrder || b.CategoryOrder));
            
            return { ...prev, categories: updatedCategories };
          });
        });
        
        newConnection.on("CategoryDeleted", (deletedCategoryId) => {
          if (!isMounted) return;
          console.log('CategoryDeleted event received:', deletedCategoryId);
          setServer(prev => {
            if (!prev) return prev;
            
            const updatedCategories = (prev.categories || prev.Categories || []).filter(cat => (cat.categoryId || cat.CategoryId) !== deletedCategoryId);
            
            return { ...prev, categories: updatedCategories };
          });
        });
        
        newConnection.on("CategoriesReordered", (updatedCategories) => {
          if (!isMounted) return;
          console.log('CategoriesReordered event received:', updatedCategories);
          setServer(prev => {
            if (!prev) return prev;
            
            const processedCategories = updatedCategories.map(cat => ({
              ...cat,
              chats: (cat.chats || cat.Chats || []).map(chat => ({
                ...chat,
                chatId: chat.chatId || chat.ChatId,
                categoryId: cat.categoryId || cat.CategoryId
              }))
            }));
            
            const updatedServer = { ...prev, categories: processedCategories };
            
            // Уведомляем HomePage об обновлении данных
            if (onServerDataUpdated) {
              onServerDataUpdated(updatedServer);
            }
            
            return updatedServer;
          });
        });
        
        newConnection.on("ChatsReordered", (updatedCategories) => {
          if (!isMounted) return;
          console.log('ChatsReordered event received:', updatedCategories);
          setServer(prev => {
            if (!prev) return prev;
            
            const processedCategories = updatedCategories.map(cat => ({
              ...cat,
              chats: (cat.chats || cat.Chats || []).map(chat => ({
                ...chat,
                chatId: chat.chatId || chat.ChatId,
                categoryId: cat.categoryId || cat.CategoryId
              }))
            }));
            
            const updatedServer = { ...prev, categories: processedCategories };
            
            // Уведомляем HomePage об обновлении данных
            if (onServerDataUpdated) {
              onServerDataUpdated(updatedServer);
            }
            
            return updatedServer;
          });
        });

        newConnection.on("ServerBannerUpdated", (serverId, bannerUrl) => {
          if (!isMounted) return;
          console.log('ServerBannerUpdated event received:', serverId, bannerUrl);
          setServerBanner(prev => {
            if (!prev || prev.serverId !== serverId) return prev;
            return { ...prev, banner: bannerUrl };
          });
        });

        newConnection.on("ServerBannerColorUpdated", (serverId, bannerColor) => {
          if (!isMounted) return;
          console.log('ServerBannerColorUpdated event received:', serverId, bannerColor);
          setServerBanner(prev => {
            if (!prev || prev.serverId !== serverId) return prev;
            return { ...prev, bannerColor: bannerColor };
          });
        });

        // Обработчик добавления участника
        newConnection.on("MemberAdded", (data) => {
          if (!isMounted) return;
          console.log('MemberAdded event received:', data);
          // Можно добавить уведомление или обновление списка участников
        });

        // Обработчик покидания сервера - теперь обрабатывается в useServers
        newConnection.on("ServerLeft", (serverId) => {
          if (!isMounted) return;
          console.log('ServerLeft event received in ServerPanel:', serverId);
          // Навигация обрабатывается в useServers, здесь только логируем
        });

        // Обработчик удаления сервера - теперь обрабатывается в useServers
        newConnection.on("ServerDeleted", (serverId) => {
          if (!isMounted) return;
          console.log('ServerDeleted event received in ServerPanel:', serverId);
          // Навигация обрабатывается в useServers, здесь только логируем
        });

        // Обработчик ошибок
        newConnection.on("Error", (errorMessage) => {
          if (!isMounted) return;
          console.error('ServerHub error:', errorMessage);
          // Можно показать уведомление об ошибке
        });
        
      } catch (error) {
        console.error('Error connecting to server hub:', error);
        console.log('ServerPanel: Connection failed, connectionRef.current:', connectionRef.current);
      } finally {
        isConnectingRef.current = false;
      }
    };

    connectToServer();

    return () => {
      isMounted = false;
      isConnectingRef.current = false;
      currentServerRef.current = null;
      if (connectionRef.current) {
        connectionRef.current.off("ChatCreated");
        connectionRef.current.off("ChatDeleted");
        connectionRef.current.off("ChatUpdated");
        connectionRef.current.off("CategoryCreated");
        connectionRef.current.off("CategoryDeleted");
        connectionRef.current.off("CategoriesReordered");
        connectionRef.current.off("ChatsReordered");
        connectionRef.current.off("MemberAdded");
        connectionRef.current.off("ServerLeft");
        connectionRef.current.off("ServerDeleted");
        connectionRef.current.off("Error");
        
        connectionRef.current.stop();
        setServerConnection(null);
      }
    };
  }, [selectedServer?.serverId]);


  const handleChatClick = useCallback((chatId, groupName, chatType) => {
    if (onChatSelected) {
      const chat = {
        chat_id: chatId,
        groupName: groupName,
        username: groupName, 
        chatType: chatType,
        chatTypeId: chatType, 
        isGroupChat: false, 
        isServerChat: true 
      };
      onChatSelected(chat);
    }
  }, [onChatSelected]);

  const handleAddChannel = useCallback((categoryId) => {
    const category = server?.categories?.find(cat => (cat.categoryId || cat.CategoryId) === categoryId);
    setSelectedCategoryForChannel(category || {
      categoryId: categoryId,
      categoryName: 'Без категории'
    });
    setShowCreateChannelModal(true);
  }, [server?.categories]);

  const handleCreateChannel = useCallback(async (channelData) => {
    try {
      console.log('Создание канала:', channelData);
      
      // Используем собственное SignalR соединение
      if (!serverConnection || serverConnection.state !== 'Connected') {
        throw new Error(`SignalR connection not available. State: ${serverConnection?.state || 'null'}`);
      }
      
      await serverConnection.invoke("CreateChat", 
        server?.serverId,
        selectedCategoryForChannel?.categoryId || selectedCategoryForChannel?.CategoryId || null,
        channelData.name,
        channelData.type
      );

      console.log('Канал создан успешно');

      setShowCreateChannelModal(false);
      setSelectedCategoryForChannel(null);
      
    } catch (error) {
      console.error('Ошибка создания канала:', error);
      throw error;
    }
  }, [server?.serverId, selectedCategoryForChannel, serverConnection]);

  const handleCloseCreateChannelModal = useCallback(() => {
    setShowCreateChannelModal(false);
    setSelectedCategoryForChannel(null);
  }, []);

  const handleChannelSettings = useCallback((channel) => {
    setSelectedChannelForSettings(channel);
    setShowChannelSettingsModal(true);
  }, []);

  const handleCloseChannelSettingsModal = useCallback(() => {
    setShowChannelSettingsModal(false);
    setSelectedChannelForSettings(null);
  }, []);

  const handleUpdateChannel = useCallback(async (channelId, newName) => {
    if (!serverConnection) {
      throw new Error('SignalR connection not available');
    }

    try {
      await serverConnection.invoke("UpdateChatName", 
        server?.serverId,
        channelId,
        newName
      );
      console.log('Канал обновлен успешно');
    } catch (error) {
      console.error('Ошибка обновления канала:', error);
      throw error;
    }
  }, [server?.serverId, serverConnection]);

  const handleDeleteChannel = useCallback(async (channelId) => {
    if (!serverConnection) {
      throw new Error('SignalR connection not available');
    }

    try {
      await serverConnection.invoke("DeleteChat", 
        server?.serverId,
        channelId
      );
      console.log('Канал удален успешно');
    } catch (error) {
      console.error('Ошибка удаления канала:', error);
      throw error;
    }
  }, [server?.serverId, serverConnection]);

  const handleContextMenu = useCallback((e, type, data = null) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      type,
      data
    });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({ isOpen: false, position: { x: 0, y: 0 }, type: null, data: null });
  }, []);

  const handleCreateCategory = useCallback(() => {
    setShowCreateCategoryModal(true);
  }, []);

  const handleEditChannel = useCallback((channel) => {
    setSelectedChannelForSettings(channel);
    setShowChannelSettingsModal(true);
  }, []);

  const handleDeleteChannelFromContext = useCallback(async (channel) => {
    if (window.confirm(`Вы уверены, что хотите удалить канал "${channel.Name || channel.name || channel.groupName}"?`)) {
      try {
        await handleDeleteChannel(channel.chatId || channel.ChatId);
      } catch (error) {
        console.error('Ошибка удаления канала:', error);
        alert('Ошибка при удалении канала: ' + error.message);
      }
    }
  }, [handleDeleteChannel]);

  const handleCreateChannelInCategory = useCallback((category) => {
    setSelectedCategoryForChannel(category);
    setShowCreateChannelModal(true);
  }, []);

  const handleCreateChannelWithoutCategory = useCallback(() => {
    setSelectedCategoryForChannel(null);
    setShowCreateChannelModal(true);
  }, []);

  const handleEditCategory = useCallback((category) => {
    console.log('Редактирование категории:', category);
    alert('Редактирование категорий пока не реализовано');
  }, []);

  const handleDeleteCategory = useCallback(async (category) => {
    if (window.confirm(`Вы уверены, что хотите удалить категорию "${category.CategoryName || category.categoryName}"? Все каналы внутри также будут удалены.`)) {
      try {
        if (serverConnection && serverConnection.state === 'Connected') {
          const categoryId = category.categoryId || category.CategoryId;
          if (!categoryId) {
            throw new Error('ID категории не найден');
          }
          await serverConnection.invoke("DeleteCategory", 
            server?.serverId,
            categoryId
          );
          console.log('Категория удалена успешно через SignalR');
        } else {
          throw new Error('Нет соединения с сервером');
        }
      } catch (error) {
        console.error('Ошибка удаления категории:', error);
        alert('Ошибка при удалении категории: ' + error.message);
      }
    }
  }, [serverConnection, server?.serverId]);

  const handleCategoriesReordered = useCallback((updatedCategories) => {
    console.log('CategoriesReordered callback received:', updatedCategories);
    setServer(prev => {
      if (!prev) return prev;
      return { ...prev, Categories: updatedCategories };
    });
  }, []);

  const handleChatsReordered = useCallback((updatedCategories) => {
    console.log('ChatsReordered callback received:', updatedCategories);
    setServer(prev => {
      if (!prev) return prev;
      return { ...prev, Categories: updatedCategories };
    });
  }, []);


  const handleCreateCategorySubmit = useCallback(async (categoryData) => {
    try {
      if (serverConnection && serverConnection.state === 'Connected') {
        await serverConnection.invoke("CreateCategory", 
          server?.serverId,
          categoryData.categoryName
        );
        console.log('Категория создана успешно через SignalR');
        setShowCreateCategoryModal(false);
      } else {
        await createCategory(server?.serverId, categoryData);
        console.log('Категория создана успешно через REST API');
        setShowCreateCategoryModal(false);
      }
    } catch (error) {
      console.error('Ошибка создания категории:', error);
      throw error;
    }
  }, [serverConnection, createCategory, server?.serverId]);

  const handleAddMember = useCallback(() => {
    setShowAddMemberModal(true);
    setShowDropdown(false);
  }, []);

  const handleCloseAddMemberModal = useCallback(() => {
    setShowAddMemberModal(false);
  }, []);

  const handleMemberAdded = useCallback((result) => {
    console.log('Member added successfully:', result);
    // Участник добавлен успешно, список обновится автоматически
  }, []);

  const handleLeaveServer = useCallback(async () => {
    if (!currentServer?.serverId && !currentServer?.ServerId) return;
    
    const serverId = currentServer?.serverId || currentServer?.ServerId;
    
    if (!window.confirm('Вы уверены, что хотите покинуть этот сервер?')) {
      return;
    }

    try {
      if (!serverConnection || serverConnection.state !== 'Connected') {
        throw new Error('Нет подключения к серверу');
      }

      // Используем SignalR для покидания сервера
      await serverConnection.invoke('LeaveServer', serverId);
      
      // Навигация обрабатывается в useServers через SignalR событие
      console.log('LeaveServer completed, navigation will be handled by useServers');
      
    } catch (err) {
      console.error('Leave server error:', err);
      // Ошибка при покидании сервера
    }
  }, [currentServer, serverConnection]);

  const handleDeleteServer = useCallback(async () => {
    if (!currentServer?.serverId && !currentServer?.ServerId) return;
    
    const serverId = currentServer?.serverId || currentServer?.ServerId;
    const serverName = currentServer?.name || currentServer?.Name;
    
    if (!window.confirm(`Вы уверены, что хотите УДАЛИТЬ сервер "${serverName}"? Это действие нельзя отменить!`)) {
      return;
    }

    try {
      if (!serverConnection || serverConnection.state !== 'Connected') {
        throw new Error('Нет подключения к серверу');
      }

      // Используем SignalR для удаления сервера
      await serverConnection.invoke('DeleteServer', serverId);
      
      // Навигация обрабатывается в useServers через SignalR событие
      console.log('DeleteServer completed, navigation will be handled by useServers');
      
    } catch (err) {
      console.error('Delete server error:', err);
      // Ошибка при удалении сервера
    }
  }, [currentServer, serverConnection]);

  const getContextMenuItems = useCallback(() => {
    switch (contextMenu.type) {
      case 'empty':
        return [
          {
            text: 'Создать категорию',
            icon: <CreateNewFolder sx={{ fontSize: 16 }} />,
            onClick: handleCreateCategory
          },
          {
            text: 'Создать канал',
            icon: <Add sx={{ fontSize: 16 }} />,
            onClick: handleCreateChannelWithoutCategory
          }
        ];
      case 'channel':
        return [
          {
            text: 'Создать канал',
            icon: <Add sx={{ fontSize: 16 }} />,
            onClick: () => handleCreateChannelInCategory(contextMenu.data.category)
          },
          {
            text: 'Изменить канал',
            icon: <Edit sx={{ fontSize: 16 }} />,
            onClick: () => handleEditChannel(contextMenu.data.channel)
          },
          {
            text: 'Удалить канал',
            icon: <Delete sx={{ fontSize: 16 }} />,
            onClick: () => handleDeleteChannelFromContext(contextMenu.data.channel),
            danger: true
          }
        ];
      case 'category':
        return [
          {
            text: 'Изменить категорию',
            icon: <Edit sx={{ fontSize: 16 }} />,
            onClick: () => handleEditCategory(contextMenu.data)
          },
          {
            text: 'Удалить категорию',
            icon: <Delete sx={{ fontSize: 16 }} />,
            onClick: () => handleDeleteCategory(contextMenu.data),
            danger: true
          }
        ];
      default:
        return [];
    }
  }, [contextMenu.type, contextMenu.data, handleCreateCategory, handleCreateChannelInCategory, handleCreateChannelWithoutCategory, handleEditChannel, handleDeleteChannelFromContext, handleEditCategory, handleDeleteCategory]);

  if (!selectedServer) {
    return (
      <div className="server-panel">
        <div className="server-panel-header">
          <h3>Выберите сервер</h3>
        </div>
      </div>
    );
  }

  // Убираем проверку userServers, так как мы больше не используем useServers в ServerPanel
  // Проверка доступа к серверу теперь обрабатывается в HomePage через useServer

  return (
    <div className="server-panel">
      <div className={`server-panel-header ${(serverBanner?.banner || serverBanner?.bannerColor) ? 'with-banner' : ''}`}>
        {(serverBanner?.banner || serverBanner?.bannerColor) && (
          <div 
            className="server-panel-banner"
            style={{
              backgroundImage: serverBanner?.banner ? `url(${BASE_URL}${serverBanner.banner})` : 'none',
              backgroundColor: serverBanner?.bannerColor || '#3f3f3f'
            }}
          />
        )}
        <div className="server-info" onClick={() => setShowDropdown(!showDropdown)}>
          <h3>{currentServer.Name || currentServer.name}</h3>
          <span className="dropdown-arrow">▼</span>
        </div>
        {showDropdown && (
          <div className="server-dropdown">
            <div 
              className="dropdown-item"
              onClick={() => {
                setShowDropdown(false);
                navigate(`/server/${currentServer?.serverId || currentServer?.ServerId}/settings`);
              }}
            >
              <Settings sx={{ fontSize: 16, marginRight: 8 }} />
              Настройки сервера
            </div>
            <div 
              className="dropdown-item"
              onClick={handleAddMember}
            >
              <PersonAdd sx={{ fontSize: 16, marginRight: 8 }} />
              Добавить участника
            </div>
            {currentServer?.ownerId === user?.id || currentServer?.OwnerId === user?.id ? (
              <div 
                className="dropdown-item dropdown-item-danger"
                onClick={handleDeleteServer}
              >
                <Delete sx={{ fontSize: 16, marginRight: 8 }} />
                Удалить сервер
              </div>
            ) : (
              <div 
                className="dropdown-item dropdown-item-danger"
                onClick={handleLeaveServer}
              >
                <ExitToApp sx={{ fontSize: 16, marginRight: 8 }} />
                Покинуть сервер
              </div>
            )}
          </div>
        )}
      </div>
      
      <div 
        className={`server-channels ${(serverBanner?.banner || serverBanner?.bannerColor) ? 'with-banner' : ''}`}
        onContextMenu={(e) => {
          if (!e.target.closest('.category-item') && !e.target.closest('.channel-item')) {
            e.preventDefault();
            handleContextMenu(e, 'empty');
          }
        }}
      >
        <CategoriesList
          categories={server?.categories || currentServer?.categories}
          selectedChat={selectedChat}
          onChatClick={handleChatClick}
          onAddChannel={handleAddChannel}
          onChannelContextMenu={(e, channel, category) => handleContextMenu(e, 'channel', { channel, category })}
          onCategoryContextMenu={(e, category) => handleContextMenu(e, 'category', category)}
          onEmptySpaceContextMenu={(e) => handleContextMenu(e, 'empty')}
          onChannelSettings={handleChannelSettings}
          connection={connectionRef.current}
          serverId={currentServer?.serverId}
          onCategoriesReordered={handleCategoriesReordered}
          onChatsReordered={handleChatsReordered}
        />
      </div>

      <CreateChannelModal
        isOpen={showCreateChannelModal}
        onClose={handleCloseCreateChannelModal}
        onSubmit={handleCreateChannel}
        categoryId={selectedCategoryForChannel?.categoryId || selectedCategoryForChannel?.CategoryId || null}
        categoryName={selectedCategoryForChannel?.categoryName || selectedCategoryForChannel?.CategoryName}
      />

      <ChannelSettingsModal
        isOpen={showChannelSettingsModal}
        onClose={handleCloseChannelSettingsModal}
        channel={selectedChannelForSettings}
        onUpdateChannel={handleUpdateChannel}
        onDeleteChannel={handleDeleteChannel}
      />

      <CreateCategoryModal
        isOpen={showCreateCategoryModal}
        onClose={() => setShowCreateCategoryModal(false)}
        onSubmit={handleCreateCategorySubmit}
      />

      <ContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={handleCloseContextMenu}
        items={getContextMenuItems()}
      />

      <AddMemberModal
        isOpen={showAddMemberModal}
        onClose={handleCloseAddMemberModal}
        serverId={currentServer?.serverId || currentServer?.ServerId}
        onMemberAdded={handleMemberAdded}
        connection={connectionRef.current}
      />

      <UserPanel
        userId={user?.id}
        username={user?.username || user?.userName}
        isOpen={true}
        isMuted={false}
        isAudioEnabled={true}
        onToggleMute={() => {}}
        onToggleAudio={() => {}}
      />
    </div>
  );
};

export default memo(ServerPanel);
