import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { useAuthContext } from '../../../shared/lib/contexts/AuthContext';
import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import tokenManager from '../../../shared/lib/services/tokenManager';

// Хелпер для получения заголовков авторизации
const getAuthHeaders = () => {
  const token = tokenManager.getToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const readPrivateFlag = (obj) => {
  if (obj?.isPrivate !== undefined && obj?.isPrivate !== null) return obj.isPrivate === true;
  if (obj?.IsPrivate !== undefined && obj?.IsPrivate !== null) return obj.IsPrivate === true;
  return undefined;
};

const mergeCategoryFromEvent = (category, updatedCategory) => {
  const isPrivate = readPrivateFlag(updatedCategory);
  const categoryName =
    updatedCategory.categoryName ??
    updatedCategory.CategoryName ??
    category.categoryName ??
    category.CategoryName;

  return {
    ...category,
    categoryName,
    CategoryName: categoryName,
    isPrivate: isPrivate ?? category.isPrivate ?? category.IsPrivate ?? false,
    IsPrivate: isPrivate ?? category.IsPrivate ?? category.isPrivate ?? false,
    allowedRoleIds:
      updatedCategory.allowedRoleIds ??
      updatedCategory.AllowedRoleIds ??
      category.allowedRoleIds ??
      category.AllowedRoleIds,
    allowedUserIds:
      updatedCategory.allowedUserIds ??
      updatedCategory.AllowedUserIds ??
      category.allowedUserIds ??
      category.AllowedUserIds,
  };
};

const mergeChatFromEvent = (chat, updatedChat) => ({
  ...chat,
  ...updatedChat,
  chatId: updatedChat.chatId ?? updatedChat.ChatId ?? chat.chatId ?? chat.ChatId,
  name: updatedChat.name ?? updatedChat.Name ?? chat.name ?? chat.Name,
  categoryId: updatedChat.categoryId ?? updatedChat.CategoryId ?? chat.categoryId ?? chat.CategoryId,
  chatOrder: updatedChat.chatOrder ?? updatedChat.ChatOrder ?? chat.chatOrder ?? chat.ChatOrder,
  typeId: updatedChat.typeId ?? updatedChat.TypeId ?? chat.typeId ?? chat.TypeId,
  isPrivate: readPrivateFlag(updatedChat) ?? readPrivateFlag(chat) ?? false,
  allowedRoleIds:
    updatedChat.allowedRoleIds ??
    updatedChat.AllowedRoleIds ??
    chat.allowedRoleIds ??
    chat.AllowedRoleIds,
  members: updatedChat.members ?? updatedChat.Members ?? chat.members ?? chat.Members ?? [],
});

const findChatInCategories = (categories, chatId) => {
  if (!chatId) return null;
  for (const category of categories || []) {
    const chats = category.chats || category.Chats || [];
    const chat = chats.find((item) => String(item.chatId ?? item.ChatId) === String(chatId));
    if (chat) return chat;
  }
  return null;
};
import { CategoriesList } from '../../categories-list';
import { CreateChannelModal, ChannelSettingsModal, CreateCategoryModal, ContextMenu, AddMemberModal } from '../../../shared/ui/molecules';

const EMPTY_GUID_LIST = [];
import {
  canManageChannels,
  canManageServer,
  canCreateInvites,
  getServerPermissions,
  isServerOwner as checkIsServerOwner,
} from '../../../entities/role/lib/serverPermissions';
import { voiceCallApi } from '../../../entities/voice-call/api/voiceCallApi';
import { useCallStore } from '../../../shared/lib/stores/callStore';
import { setServerHubConnection, clearServerHubConnection } from '../../../shared/lib/services/serverHubRegistry';
import { 
  CreateNewFolder, 
  Add, 
  Edit, 
  Delete,
  Settings,
  PersonAdd,
  Group,
  ExitToApp
} from '@mui/icons-material';
import './ServerPanel.css';

const ServerPanel = ({ 
  selectedServer, 
  onChatSelected, 
  selectedChat,
  onServerDataUpdated,
  unreadCountByChat = {}
}) => {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  
  const [server, setServer] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [selectedCategoryForChannel, setSelectedCategoryForChannel] = useState(null);
  const [showChannelSettingsModal, setShowChannelSettingsModal] = useState(false);
  const [selectedChannelForSettings, setSelectedChannelForSettings] = useState(null);
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [selectedCategoryForEdit, setSelectedCategoryForEdit] = useState(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [contextMenu, setContextMenu] = useState({ isOpen: false, position: { x: 0, y: 0 }, type: null, data: null });
  const [serverConnection, setServerConnection] = useState(null);
  const [bannerLoadError, setBannerLoadError] = useState(false);
  const connectionRef = useRef(null);
  const currentServerRef = useRef(null);
  
  const currentServer = server || selectedServer;
  const isConnectingRef = useRef(false);
  const isOwner = checkIsServerOwner(currentServer, user?.id);
  const serverPermissions = getServerPermissions(currentServer);
  const userCanManageChannels = canManageChannels(serverPermissions, isOwner);
  const userCanManageServer = canManageServer(serverPermissions, isOwner);
  const userCanCreateInvites = canCreateInvites(serverPermissions, isOwner);

  const fetchServerData = useCallback(async () => {
    if (!selectedServer?.serverId) return null;
    
    try {
      const response = await fetch(`${BASE_URL}/api/server/${selectedServer.serverId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });
      
      if (response.ok) {
        const raw = await response.json();
        const serverData = {
          ...raw,
          serverId: raw.serverId ?? raw.ServerId,
          categories: raw.categories ?? raw.Categories ?? [],
        };
        console.log('ServerPanel: Received server data:', serverData);
        setServer(serverData);
        if (onServerDataUpdated) {
          onServerDataUpdated(serverData);
        }
        return serverData;
      } else {
        console.error('ServerPanel: Failed to fetch server data, status:', response.status);
        return null;
      }
    } catch (error) {
      console.error('Error fetching server data:', error);
      return null;
    }
  }, [selectedServer?.serverId, onServerDataUpdated]);

  const findChannelInServer = useCallback((serverData, chatId) => {
    if (!serverData?.categories) return null;
    for (const cat of serverData.categories) {
      const chats = cat.chats || cat.Chats || [];
      const ch = chats.find(c => (c.chatId ?? c.ChatId) === chatId);
      if (ch) return ch;
    }
    return null;
  }, []);

  const handleAddMemberToChannel = useCallback(async (serverId, channelId, userId) => {
    const res = await fetch(`${BASE_URL}/api/server/${serverId}/channels/${channelId}/members`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ userId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Не удалось добавить участника');
    }
    const serverData = await fetchServerData();
    if (channelId && serverData) {
      const updated = findChannelInServer(serverData, channelId);
      if (updated) setSelectedChannelForSettings(updated);
    }
  }, [fetchServerData, findChannelInServer]);

  const handleRemoveMemberFromChannel = useCallback(async (serverId, channelId, memberUserId) => {
    const res = await fetch(`${BASE_URL}/api/server/${serverId}/channels/${channelId}/members/${memberUserId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Не удалось убрать участника');
    }
    const serverData = await fetchServerData();
    if (channelId && serverData) {
      const updated = findChannelInServer(serverData, channelId);
      if (updated) setSelectedChannelForSettings(updated);
    }
  }, [fetchServerData, findChannelInServer]);

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
        fetchServerData();
        return newCategory;
      } else {
        throw new Error('Failed to create category');
      }
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }, [selectedServer?.serverId, fetchServerData]);

  useEffect(() => {
    if (!serverConnection) return;

    const handleChatCreated = (newChat, categoryId) => {
      console.log('ServerPanel: ChatCreated event received in useEffect:', { newChat, categoryId });
      setServer(prev => {
        if (!prev) return prev;

        const processedChat = mergeChatFromEvent({}, newChat);

        const isPrivate = processedChat.isPrivate === true;
        if (isPrivate) {
          const memberIds = (processedChat.members || []).map(m => m.userId ?? m.UserId ?? m.user_id).filter(Boolean);
          const myId = user?.id ?? user?.userId;
          const isOwner = prev.ownerId === myId || prev.OwnerId === myId;
          const hasAccess = isOwner || (myId && memberIds.some(id => String(id) === String(myId)));
          if (!hasAccess) return prev;
        }

        const updatedCategories = [...(prev.categories || [])];
        
        if (categoryId === null) {
          const existingNullCategory = updatedCategories.find(cat => {
            const id = cat.categoryId || cat.CategoryId;
            return id === null || id === undefined;
          });
          if (existingNullCategory) {
            const existingChat = (existingNullCategory.chats || existingNullCategory.Chats || []).find(chat => 
              (chat.chatId || chat.ChatId) === (processedChat.chatId || processedChat.ChatId)
            );
            
            if (!existingChat) {
              existingNullCategory.chats = [...(existingNullCategory.chats || existingNullCategory.Chats || []), processedChat];
            }
          } else {
            const newNullCategory = {
              categoryId: null,
              categoryName: null,
              chats: [processedChat],
              categoryOrder: -1
            };
            updatedCategories.push(newNullCategory);
          }
        } else {
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
          if ((cat.categoryId || cat.CategoryId) === null) {
            return (cat.chats || cat.Chats || []).length > 0;
          }
          return true;
        });
        
        const updatedServer = { ...prev, categories: updatedCategories };
        
        if (onServerDataUpdated) {
          onServerDataUpdated(updatedServer);
        }
        
        return updatedServer;
      });
    };

    const handleChatUpdated = (updatedChat) => {
      console.log('ServerPanel: ChatUpdated event received:', updatedChat);
      const chatId = updatedChat.chatId ?? updatedChat.ChatId;
      const hasPrivacyPayload =
        (updatedChat.isPrivate !== undefined && updatedChat.isPrivate !== null) ||
        (updatedChat.IsPrivate !== undefined && updatedChat.IsPrivate !== null);

      if (hasPrivacyPayload) {
        setTimeout(() => fetchServerData(), 0);
      }

      setServer((prev) => {
        if (!prev) return prev;

        const oldChat = findChatInCategories(prev.categories ?? prev.Categories, chatId);
        const processedChat = mergeChatFromEvent(oldChat || {}, updatedChat);

        const prevCategories = prev.categories ?? prev.Categories ?? [];
        const updatedCategories = [...prevCategories].map((cat) => ({
          ...cat,
          chats: (cat.chats || cat.Chats || []).map((chat) =>
            String(chat.chatId ?? chat.ChatId) === String(processedChat.chatId)
              ? mergeChatFromEvent(chat, processedChat)
              : chat
          ),
        }));

        const updatedServer = { ...prev, categories: updatedCategories };

        if (onServerDataUpdated) {
          onServerDataUpdated(updatedServer);
        }

        return updatedServer;
      });

      setSelectedChannelForSettings((prev) => {
        if (!prev) return prev;
        if (String(prev.chatId ?? prev.ChatId) !== String(chatId)) return prev;
        return mergeChatFromEvent(prev, updatedChat);
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
          isPrivate: readPrivateFlag(newCategory) ?? false,
          allowedRoleIds: newCategory.allowedRoleIds || newCategory.AllowedRoleIds,
          allowedUserIds: newCategory.allowedUserIds || newCategory.AllowedUserIds,
          chats: (newCategory.chats || newCategory.Chats || []).map(chat => ({
            ...chat,
            chatId: chat.chatId || chat.ChatId,
            name: chat.name || chat.Name,
            categoryId: chat.categoryId || chat.CategoryId,
            chatOrder: chat.chatOrder || chat.ChatOrder,
            typeId: chat.typeId || chat.TypeId,
            isPrivate: readPrivateFlag(chat) ?? false,
            allowedRoleIds: chat.allowedRoleIds || chat.AllowedRoleIds,
            members: chat.members || chat.Members || []
          }))
        };
        
        const updatedCategories = [...(prev.categories || []), processedCategory];
        
        const updatedServer = { ...prev, categories: updatedCategories };
        
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
        
        if (onServerDataUpdated) {
          onServerDataUpdated(updatedServer);
        }
        
        return updatedServer;
      });
    };

    const handleCategoryUpdated = (updatedCategory) => {
      console.log('ServerPanel: CategoryUpdated event received:', updatedCategory);

      setServer((prev) => {
        if (!prev) return prev;

        const updatedCategories = (prev.categories || []).map((cat) => {
          const catId = cat.categoryId ?? cat.CategoryId;
          const updatedId = updatedCategory.categoryId ?? updatedCategory.CategoryId;
          if (String(catId) !== String(updatedId)) {
            return cat;
          }

          return mergeCategoryFromEvent(cat, updatedCategory);
        });

        const updatedServer = { ...prev, categories: updatedCategories };

        if (onServerDataUpdated) {
          onServerDataUpdated(updatedServer);
        }

        return updatedServer;
      });

      fetchServerData();
    };

    console.log('ServerPanel: Registering SignalR handlers, serverConnection:', serverConnection);
    console.log('ServerPanel: Registering ChatCreated handler:', handleChatCreated);
    const handleChannelMemberAdded = (srvId, channelId) => {
      if (selectedServer?.serverId === srvId) fetchServerData();
    };
    const handleChannelMemberRemoved = (srvId, channelId) => {
      if (selectedServer?.serverId === srvId) fetchServerData();
    };

    serverConnection.on("ChatCreated", handleChatCreated);
    serverConnection.on("ChatDeleted", handleChatDeleted);
    serverConnection.on("ChatUpdated", handleChatUpdated);
    serverConnection.on("CategoryCreated", handleCategoryCreated);
    serverConnection.on("CategoryDeleted", handleCategoryDeleted);
    serverConnection.on("CategoryUpdated", handleCategoryUpdated);
    serverConnection.on("ChannelMemberAdded", handleChannelMemberAdded);
    serverConnection.on("ChannelMemberRemoved", handleChannelMemberRemoved);

    const handleUserPermissionsUpdated = (updatedUserId, permissions) => {
      if (String(updatedUserId) !== String(user?.id)) return;
      setServer((prev) => (prev ? { ...prev, permissions: permissions || {} } : prev));
    };
    serverConnection.on("UserPermissionsUpdated", handleUserPermissionsUpdated);

    const handleVoiceMemberModerated = ({
      serverId: eventServerId,
      channelId,
      targetUserId,
      muteMic,
      deafen,
      moderatorUserId,
    }) => {
      const activeServerId = selectedServer?.serverId || currentServer?.serverId;
      if (String(eventServerId) !== String(activeServerId)) return;

      if (String(moderatorUserId) === String(user?.id)) {
        voiceCallApi.emitServerVoiceModeration({
          channelId,
          targetUserId,
          moderatorUserId,
          serverId: eventServerId,
          muteMic: muteMic ?? null,
          deafen: deafen ?? null,
        });
        return;
      }

      const updates = {
        isServerMuted: muteMic !== null && muteMic !== undefined ? Boolean(muteMic) : undefined,
        isServerDeafened: deafen !== null && deafen !== undefined ? Boolean(deafen) : undefined,
      };
      if (muteMic === true) {
        updates.isMuted = true;
        updates.isSpeaking = false;
      } else if (muteMic === false) {
        updates.isMuted = false;
      }
      if (deafen === true) {
        updates.isGlobalAudioMuted = true;
        updates.isAudioDisabled = true;
        updates.isDeafened = true;
      } else if (deafen === false) {
        updates.isServerDeafened = false;
      }
      Object.keys(updates).forEach((key) => {
        if (updates[key] === undefined) delete updates[key];
      });
      if (Object.keys(updates).length > 0) {
        useCallStore.getState().updateVoiceChannelParticipant(channelId, targetUserId, updates);
      }
    };
    serverConnection.on('VoiceMemberModerated', handleVoiceMemberModerated);

    return () => {
      serverConnection.off("ChatCreated", handleChatCreated);
      serverConnection.off("ChatDeleted", handleChatDeleted);
      serverConnection.off("ChatUpdated", handleChatUpdated);
      serverConnection.off("CategoryCreated", handleCategoryCreated);
      serverConnection.off("CategoryDeleted", handleCategoryDeleted);
      serverConnection.off("CategoryUpdated", handleCategoryUpdated);
      serverConnection.off("ChannelMemberAdded", handleChannelMemberAdded);
      serverConnection.off("ChannelMemberRemoved", handleChannelMemberRemoved);
      serverConnection.off("UserPermissionsUpdated", handleUserPermissionsUpdated);
      serverConnection.off('VoiceMemberModerated', handleVoiceMemberModerated);
    };
  }, [serverConnection, onServerDataUpdated, user, selectedServer?.serverId, fetchServerData]);


  // Получаем баннер из данных сервера (используем server или selectedServer)
  const serverBanner = useMemo(() => {
    const serverData = server || selectedServer;
    if (!serverData) return null;
    
    // Проверяем оба варианта (с маленькой и большой буквы, так как C# может вернуть с большой)
    const banner = serverData.banner || serverData.Banner;
    const bannerColor = serverData.bannerColor || serverData.BannerColor;
    
    const result = {
      banner: banner,
      bannerColor: bannerColor
    };
    
    console.log('ServerPanel: serverBanner computed:', result, 'from serverData:', serverData);
    return result;
  }, [server, selectedServer]);

  // Сбрасываем ошибку загрузки баннера при смене сервера
  useEffect(() => {
    setBannerLoadError(false);
  }, [server?.banner, selectedServer?.banner]);

  useEffect(() => {
    if (selectedServer) {
      fetchServerData();
    }
  }, [selectedServer, fetchServerData]);


  useEffect(() => {
    let isMounted = true;
    
    if (currentServerRef.current === selectedServer?.serverId && 
        connectionRef.current && 
        connectionRef.current.state === 'Connected') {
      console.log('Connection already exists and is connected, skipping...');
      return;
    }
    
    const connectToServer = async () => {
      console.log('connectToServer: selectedServer?.serverId:', selectedServer?.serverId, 'user?.userId:', user?.userId, 'user?.id:', user?.id);
      if (!selectedServer?.serverId || !user?.id) return;
      
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
        const previousServerId = currentServerRef.current;
        await         connectionRef.current.stop();
        connectionRef.current = null;
        setServerConnection(null);
        clearServerHubConnection(previousServerId);
      }
      console.log('ServerPanel: Creating connection to serverhub with userId:', user.id);
      const newConnection = new HubConnectionBuilder()
        .withUrl(`${BASE_URL}/serverhub?userId=${user.id}`, {
          skipNegotiation: true,
          transport: 1
        })
        .withAutomaticReconnect()
        .build();
      console.log('ServerPanel: Connection created, starting...');

      newConnection.onreconnected(() => {
        if (selectedServer?.serverId) {
          setServerHubConnection(newConnection, selectedServer.serverId);
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
        setServerHubConnection(newConnection, selectedServer.serverId);
        currentServerRef.current = selectedServer.serverId;
        console.log('Connected to server hub');
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
          await newConnection.invoke("JoinServerGroup", selectedServer.serverId.toString());
          console.log('ServerPanel: Successfully connected to serverhub and joined group');
        } catch (error) {
          console.error('ServerPanel: Error joining server group:', error);
        }
        
        if (!isMounted) {
          console.log('Component unmounted before adding handlers, stopping...');
          await newConnection.stop();
          return;
        }
        
        // SignalR event handlers are registered in useEffect above

        newConnection.on("MemberAdded", (data) => {
          if (!isMounted) return;
          console.log('MemberAdded event received:', data);
        });

        newConnection.on("ServerLeft", (serverId) => {
          if (!isMounted) return;
          console.log('ServerLeft event received in ServerPanel:', serverId);
        });

        newConnection.on("ServerDeleted", (serverId) => {
          if (!isMounted) return;
          console.log('ServerDeleted event received in ServerPanel:', serverId);
        });

        newConnection.on("Error", (errorMessage) => {
          if (!isMounted) return;
          console.error('ServerHub error:', errorMessage);
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
        
        const disconnectedServerId = selectedServer?.serverId;
        connectionRef.current.stop();
        setServerConnection(null);
        clearServerHubConnection(disconnectedServerId);
      }
    };
  }, [selectedServer?.serverId, user?.id, onServerDataUpdated, user?.userId]); // Возвращаем все зависимости


  const memoizedCategories = useMemo(() => {
    return server?.categories ?? server?.Categories ?? currentServer?.categories ?? currentServer?.Categories ?? [];
  }, [server?.categories, server?.Categories, currentServer?.categories, currentServer?.Categories]);

  const handleChatClick = useCallback((chatId, groupName, chatType) => {
    if (!onChatSelected) return;

    let channelMeta = null;
    for (const category of memoizedCategories) {
      const categoryChats = category.chats ?? category.Chats ?? [];
      const found = categoryChats.find(
        (chat) => String(chat.chatId ?? chat.ChatId ?? chat.chat_id) === String(chatId),
      );
      if (found) {
        channelMeta = found;
        break;
      }
    }

    onChatSelected({
      chatId,
      chat_id: chatId,
      groupName,
      username: groupName,
      chatType,
      chatTypeId: chatType,
      isGroupChat: false,
      isServerChat: true,
      isPrivate: channelMeta?.isPrivate ?? channelMeta?.IsPrivate ?? false,
      IsPrivate: channelMeta?.isPrivate ?? channelMeta?.IsPrivate ?? false,
      allowedRoleIds: channelMeta?.allowedRoleIds ?? channelMeta?.AllowedRoleIds ?? null,
      members: channelMeta?.members ?? channelMeta?.Members ?? [],
    });
  }, [onChatSelected, memoizedCategories]);

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
      
      if (!serverConnection || serverConnection.state !== 'Connected') {
        throw new Error(`SignalR connection not available. State: ${serverConnection?.state || 'null'}`);
      }
      
      const serverId = selectedServer?.serverId || currentServer?.serverId;
      const categoryId = selectedCategoryForChannel?.categoryId || selectedCategoryForChannel?.CategoryId || null;
      const chatName = channelData.name;
      const chatType = parseInt(channelData.type);
      
      console.log('CreateChat parameters:', {
        serverId: serverId,
        serverIdType: typeof serverId,
        categoryId: categoryId,
        categoryIdType: typeof categoryId,
        chatName: chatName,
        chatNameType: typeof chatName,
        chatType: chatType,
        chatTypeType: typeof chatType
      });
      
      const isPrivate = Boolean(channelData.isPrivate);
      const memberIds = Array.isArray(channelData.memberIds) ? channelData.memberIds : [];
      await serverConnection.invoke("CreateChat", 
        serverId,
        categoryId,
        chatName,
        chatType,
        isPrivate,
        memberIds.length > 0 ? memberIds : null
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
    const channelId = channel.chatId ?? channel.ChatId;
    const categories = server?.categories ?? server?.Categories ?? [];
    const freshChannel = findChatInCategories(categories, channelId) || channel;
    setSelectedChannelForSettings(freshChannel);
    setShowChannelSettingsModal(true);
  }, [server?.categories, server?.Categories]);

  const handleCloseChannelSettingsModal = useCallback(() => {
    setShowChannelSettingsModal(false);
    setSelectedChannelForSettings(null);
  }, []);

  const handleUpdateChannel = useCallback(async (channelId, updates) => {
    if (!serverConnection) {
      throw new Error('SignalR connection not available');
    }

    try {
      const serverId = selectedServer?.serverId || currentServer?.serverId;

      if (updates?.name) {
        await serverConnection.invoke('UpdateChatName', serverId, channelId, updates.name);
      }

      if (updates?.isPrivate !== undefined || updates?.allowedRoleIds !== undefined) {
        const roleIds = (updates.allowedRoleIds || []).map((id) => String(id));
        await serverConnection.invoke(
          'UpdateChatPrivacy',
          serverId,
          channelId,
          updates.isPrivate ?? false,
          (updates.memberIds || []).map((id) => String(id)),
          roleIds
        );
      }

      console.log('Канал обновлен успешно');
    } catch (error) {
      console.error('Ошибка обновления канала:', error);
      throw error;
    }
  }, [selectedServer?.serverId, currentServer?.serverId, serverConnection]);

  const handleDeleteChannel = useCallback(async (channelId) => {
    if (!serverConnection) {
      throw new Error('SignalR connection not available');
    }

    try {
      const serverId = selectedServer?.serverId || currentServer?.serverId;
      
      console.log('DeleteChat parameters:', {
        serverId: serverId,
        serverIdType: typeof serverId,
        channelId: channelId,
        channelIdType: typeof channelId
      });
      
      await serverConnection.invoke("DeleteChat", 
        serverId,
        channelId
      );
      console.log('Канал удален успешно');
    } catch (error) {
      console.error('Ошибка удаления канала:', error);
      throw error;
    }
  }, [server?.serverId, serverConnection]);

  const handleContextMenu = useCallback((e, type, data = null) => {
    if (!userCanManageChannels) return;
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      type,
      data
    });
  }, [userCanManageChannels]);

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
    const categoryId = category.categoryId ?? category.CategoryId;
    const categories = server?.categories ?? server?.Categories ?? [];
    const freshCategory =
      categories.find((item) => String(item.categoryId ?? item.CategoryId) === String(categoryId)) ||
      category;
    setSelectedCategoryForEdit(freshCategory);
    setShowEditCategoryModal(true);
  }, [server?.categories, server?.Categories]);

  const handleUpdateCategorySubmit = useCallback(async (categoryData) => {
    if (!serverConnection || serverConnection.state !== 'Connected') {
      throw new Error('Нет соединения с сервером');
    }

    const categoryId = selectedCategoryForEdit?.categoryId || selectedCategoryForEdit?.CategoryId;
    if (!categoryId) {
      throw new Error('ID категории не найден');
    }

    const serverId = selectedServer?.serverId || currentServer?.serverId;
    const roleIds = (categoryData.allowedRoleIds || []).map((id) => String(id));
    const userIds = (categoryData.allowedUserIds || []).map((id) => String(id));

    await serverConnection.invoke(
      'UpdateCategory',
      serverId,
      categoryId,
      categoryData.categoryName,
      categoryData.isPrivate ?? false,
      roleIds,
      userIds
    );
    setShowEditCategoryModal(false);
    setSelectedCategoryForEdit(null);
  }, [serverConnection, selectedCategoryForEdit, selectedServer?.serverId, currentServer?.serverId]);

  const handleDeleteCategory = useCallback(async (category) => {
    if (window.confirm(`Вы уверены, что хотите удалить категорию "${category.CategoryName || category.categoryName}"? Все каналы внутри также будут удалены.`)) {
      try {
        if (serverConnection && serverConnection.state === 'Connected') {
          const categoryId = category.categoryId || category.CategoryId;
          if (!categoryId) {
            throw new Error('ID категории не найден');
          }
          const serverId = selectedServer?.serverId || currentServer?.serverId;
          
          await serverConnection.invoke("DeleteCategory", 
            serverId,
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

  const handleCategoriesReordered = useCallback(() => {
    fetchServerData();
  }, [fetchServerData]);

  const handleChatsReordered = useCallback(() => {
    fetchServerData();
  }, [fetchServerData]);


  const handleCreateCategorySubmit = useCallback(async (categoryData) => {
    try {
      if (serverConnection && serverConnection.state === 'Connected') {
        const serverId = selectedServer?.serverId || currentServer?.serverId;
        const roleIds = (categoryData.allowedRoleIds || []).map((id) => String(id));
        const userIds = (categoryData.allowedUserIds || []).map((id) => String(id));

        if (categoryData.isPrivate) {
          await serverConnection.invoke(
            'CreatePrivateCategory',
            serverId,
            categoryData.categoryName,
            roleIds,
            userIds
          );
        } else {
          await serverConnection.invoke('CreateCategory', serverId, categoryData.categoryName);
        }

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
  }, [serverConnection, createCategory, server?.serverId, selectedServer?.serverId, currentServer?.serverId]);

  const handleAddMember = useCallback(() => {
    setShowAddMemberModal(true);
    setShowDropdown(false);
  }, []);

  const handleCloseAddMemberModal = useCallback(() => {
    setShowAddMemberModal(false);
  }, []);

  const handleMemberAdded = useCallback((result) => {
    console.log('Member added successfully:', result);
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

      await serverConnection.invoke('LeaveServer', selectedServer?.serverId || currentServer?.serverId);
      
      console.log('LeaveServer completed, navigation will be handled by useServers');
      
    } catch (err) {
      console.error('Leave server error:', err);
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

      await serverConnection.invoke('DeleteServer', selectedServer?.serverId || currentServer?.serverId);
      
      console.log('DeleteServer completed, navigation will be handled by useServers');
      
    } catch (err) {
      console.error('Delete server error:', err);
    }
  }, [currentServer, serverConnection]);

  const getContextMenuItems = useCallback(() => {
    if (!userCanManageChannels) {
      return [];
    }

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
  }, [contextMenu.type, contextMenu.data, userCanManageChannels, handleCreateCategory, handleCreateChannelInCategory, handleCreateChannelWithoutCategory, handleEditChannel, handleDeleteChannelFromContext, handleEditCategory, handleDeleteCategory]);

  if (!selectedServer) {
    return (
      <div className="server-panel">
        <div className="server-panel-header">
          <h3>Выберите сервер</h3>
        </div>
      </div>
    );
  }

  // Логирование для отладки
  console.log('ServerPanel render:', {
    server,
    selectedServer,
    serverBanner,
    hasBanner: !!(serverBanner?.banner || serverBanner?.bannerColor),
    bannerUrl: serverBanner?.banner ? `${BASE_URL}${serverBanner.banner}` : null
  });

  return (
    <div className="server-panel">
      <div className={`server-panel-header ${(serverBanner?.banner || serverBanner?.bannerColor) ? 'with-banner' : ''}`}>
        {(serverBanner?.banner || serverBanner?.bannerColor) && (
          <>
            {/* Скрытое изображение для проверки загрузки */}
            {serverBanner?.banner && !bannerLoadError && (
              <img
                src={`${BASE_URL}${serverBanner.banner}`}
                alt=""
                style={{ display: 'none' }}
                onError={() => {
                  console.warn('ServerPanel: Banner image failed to load:', serverBanner.banner);
                  setBannerLoadError(true);
                }}
                onLoad={() => {
                  console.log('ServerPanel: Banner image loaded successfully');
                  setBannerLoadError(false);
                }}
              />
            )}
            <div 
              className="server-panel-banner"
              style={{
                backgroundImage: (serverBanner?.banner && !bannerLoadError) 
                  ? `url(${BASE_URL}${serverBanner.banner})` 
                  : 'none',
                backgroundColor: serverBanner?.bannerColor || '#3f3f3f'
              }}
            />
          </>
        )}
        <div className="server-info" onClick={() => setShowDropdown(!showDropdown)}>
          <h3>{currentServer.Name || currentServer.name}</h3>
          <span className="dropdown-arrow">▼</span>
        </div>
        {showDropdown && (
          <div className="server-dropdown">
            {userCanManageServer && (
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
            )}
            <div 
              className="dropdown-item"
              onClick={() => {
                setShowDropdown(false);
                navigate(`/server/${currentServer?.serverId || currentServer?.ServerId}/settings`);
              }}
            >
              <Group sx={{ fontSize: 16, marginRight: 8 }} />
              Участники
            </div>
            {userCanCreateInvites && (
            <div 
              className="dropdown-item"
              onClick={handleAddMember}
            >
              <PersonAdd sx={{ fontSize: 16, marginRight: 8 }} />
              Добавить участника
            </div>
            )}
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
          if (!userCanManageChannels) return;
          if (!e.target.closest('.category-item') && !e.target.closest('.channel-item')) {
            e.preventDefault();
            handleContextMenu(e, 'empty');
          }
        }}
      >
        <div className="server-channels-scroll">
        <CategoriesList
          categories={memoizedCategories}
          selectedChat={selectedChat}
          unreadCountByChat={unreadCountByChat}
          onChatClick={handleChatClick}
          onAddChannel={userCanManageChannels ? handleAddChannel : undefined}
          onChannelContextMenu={userCanManageChannels
            ? (e, channel, category) => handleContextMenu(e, 'channel', { channel, category })
            : undefined}
          onCategoryContextMenu={userCanManageChannels
            ? (e, category) => handleContextMenu(e, 'category', category)
            : undefined}
          onEmptySpaceContextMenu={userCanManageChannels
            ? (e) => handleContextMenu(e, 'empty')
            : undefined}
          onChannelSettings={userCanManageChannels ? handleChannelSettings : undefined}
          canManageChannels={userCanManageChannels}
          connection={connectionRef.current}
          serverId={currentServer?.serverId}
          onServerDataUpdated={onServerDataUpdated}
          onCategoriesReordered={handleCategoriesReordered}
          onChatsReordered={handleChatsReordered}
          userId={user?.id}
          userName={user?.username || user?.userName}
        />
        </div>
      </div>

      <CreateChannelModal
        isOpen={showCreateChannelModal}
        onClose={handleCloseCreateChannelModal}
        onSubmit={handleCreateChannel}
        categoryId={selectedCategoryForChannel?.categoryId || selectedCategoryForChannel?.CategoryId || null}
        categoryName={selectedCategoryForChannel?.categoryName || selectedCategoryForChannel?.CategoryName}
        serverId={currentServer?.serverId ?? selectedServer?.serverId}
        serverConnection={serverConnection}
      />

      <ChannelSettingsModal
        isOpen={showChannelSettingsModal}
        onClose={handleCloseChannelSettingsModal}
        channel={selectedChannelForSettings}
        serverId={currentServer?.serverId ?? selectedServer?.serverId}
        serverConnection={serverConnection}
        onUpdateChannel={handleUpdateChannel}
        onDeleteChannel={handleDeleteChannel}
        onAddMemberToChannel={handleAddMemberToChannel}
        onRemoveMemberFromChannel={handleRemoveMemberFromChannel}
      />

      <CreateCategoryModal
        isOpen={showCreateCategoryModal}
        onClose={() => setShowCreateCategoryModal(false)}
        onSubmit={handleCreateCategorySubmit}
        serverId={currentServer?.serverId ?? selectedServer?.serverId}
        serverConnection={serverConnection}
      />

      <CreateCategoryModal
        isOpen={showEditCategoryModal}
        onClose={() => {
          setShowEditCategoryModal(false);
          setSelectedCategoryForEdit(null);
        }}
        onSubmit={handleUpdateCategorySubmit}
        initialName={selectedCategoryForEdit?.categoryName || selectedCategoryForEdit?.CategoryName || ''}
        initialIsPrivate={readPrivateFlag(selectedCategoryForEdit) === true}
        initialAllowedRoleIds={selectedCategoryForEdit?.allowedRoleIds || selectedCategoryForEdit?.AllowedRoleIds || EMPTY_GUID_LIST}
        initialAllowedUserIds={selectedCategoryForEdit?.allowedUserIds || selectedCategoryForEdit?.AllowedUserIds || EMPTY_GUID_LIST}
        title="Настройки категории"
        submitButtonText="Сохранить"
        submitLoadingText="Сохранение..."
        serverId={currentServer?.serverId ?? selectedServer?.serverId}
        serverConnection={serverConnection}
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
    </div>
  );
};

export default memo(ServerPanel);
