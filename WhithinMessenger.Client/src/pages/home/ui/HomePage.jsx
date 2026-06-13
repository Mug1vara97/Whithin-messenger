import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChatList } from '../../../widgets/chat-list';
import { ServerList } from '../../../widgets/server-list';
import { ServerDiscovery } from '../../../widgets/server-discovery';
import { ChatRoom } from '../../../widgets/chat-room';
import { ServerPanel } from '../../../widgets/server-panel';
import { FriendsPanel } from '../../../widgets/friends-panel';
import { VoiceCallView } from '../../../widgets/voice-call';
import IdeasBoardView from '../../../widgets/ideas-board/ui/IdeasBoardView';
import { isVoiceChannel, isIdeasBoardChannel } from '../../../shared/lib/constants/chatChannelTypes';
import { useServer } from '../../../entities/server/hooks';
import { serverApi } from '../../../entities/server/api/serverApi';
import { useChatList } from '../../../entities/chat';
import { useNotificationContext } from '../../../shared/lib/contexts/NotificationContext';
import { useAuthContext } from '../../../shared/lib/contexts/AuthContext';
import { useServerContext } from '../../../shared/lib/contexts/useServerContext';
import { useConnectionContext } from '../../../shared/lib/contexts/ConnectionContext';
import { useProfileModal } from '../../../shared/lib/contexts/ProfileModalContext';
import { NotificationsModal, SoundpadSoundsModal, CreateServerModal } from '../../../shared/ui/organisms';
import { soundpadBridge } from '../../../shared/lib/soundpad/soundpadBridge';
import { UserAvatar } from '../../../shared/ui';
import { ResizableSidebarShell } from '../../../shared/ui/molecules/ResizableSidebarShell';
import { Call, CallEnd } from '@mui/icons-material';
import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import { findChannelInCategories } from '../../../shared/lib/voice/callOnlyVoiceChannels';
import { getAppSoundUrl } from '../../../shared/lib/utils/appSoundSettings';
import {
  canMuteMembers,
  canManageMessages,
  canSendMessages,
  getServerPermissions,
  isServerOwner as checkIsServerOwner,
} from '../../../entities/role/lib/serverPermissions';
// import { VoiceChannelSelector } from '../../../shared/ui/molecules';
import './HomePage.css';

const HomePage = () => {
  const { serverId, channelId, chatId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthContext();
  const { openSettings, closeSettings, isSettingsOpen } = useProfileModal();
  const connectionContext = useConnectionContext();
  const getConnection = connectionContext?.getConnection;
  
  const [selectedChat, setSelectedChat] = useState(null);
  const [selectedServer, setSelectedServer] = useState(null);
  const [serverDataFromPanel, setServerDataFromPanel] = useState(null);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [showCreateServerModal, setShowCreateServerModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showSoundpadModal, setShowSoundpadModal] = useState(false);
  const isElectronApp = soundpadBridge.isElectronAvailable();
  
  const showFriends = location.pathname === '/channels/@me/friends';

  useEffect(() => {
    if (chatId || channelId || showFriends) {
      setShowDiscovery(false);
    }
  }, [chatId, channelId, showFriends]);

  const { server: serverData, accessDenied: serverAccessDenied } = useServer(serverId);
  // const [createdServerData, setCreatedServerData] = useState(null); // Не используется
  const handleChatCreatedNavigate = useCallback((createdChatId) => {
    navigate(`/channels/@me/${createdChatId}`);
  }, [navigate]);

  const { chats, createPrivateChat, unreadCountByChat: messageUnreadCountByChat, initialChatsLoaded, refreshChats, searchResults, isSearching, isLoading, searchUsers } = useChatList(user?.id || null, handleChatCreatedNavigate);
  const { createServer, fetchServers, servers, createConnection } = useServerContext();
  const {
    notifications,
    unreadCount,
    loading: notificationsLoading,
    error: notificationsError,
    markAsRead,
    markChatAsRead,
    deleteNotification,
    refreshNotifications,
    refreshUnreadCount
  } = useNotificationContext();
  const markReadTimerRef = useRef(null);

  // Состояние для активного звонка в чате
  const [activeChatCall, setActiveChatCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [desktopCallOverlayActive, setDesktopCallOverlayActive] = useState(false);
  const [groupChatConnection, setGroupChatConnection] = useState(null);
  const ringtoneAudioRef = useRef(null);
  const joinedChatGroupsRef = useRef(new Set());
  const groupChatConnectionRef = useRef(null);
  const chatsRef = useRef([]);
  const callerProfilesRef = useRef(new Map());
  const waitingForRingtoneGestureRef = useRef(false);
  const gestureRetryHandlerRef = useRef(null);
  /** Синхронизация URL /channels/@me/:chatId со списком чатов (избегаем редиректа на / пока чаты не загрузились). */
  const privateChatRouteResolveRef = useRef({ chatId: null, refreshCalls: 0 });

  // Функция для обработки звонков в чатах
  const handleJoinVoiceChannel = useCallback((callData) => {
    console.log('HomePage: handleJoinVoiceChannel called with:', callData);
    
    // Устанавливаем активный звонок в чате
    setActiveChatCall({
      chatId: callData.chatId,
      chatName: callData.roomName,
      userId: callData.userId,
      userName: callData.userName
    });
    
    console.log('HomePage: Voice call started in chat:', callData.roomName);
  }, []);

  // Функция для завершения звонка в чате
  const handleEndChatCall = useCallback(() => {
    console.log('HomePage: Ending chat call');
    setActiveChatCall(null);
  }, []);

  const stopIncomingCallRingtone = useCallback(() => {
    if (gestureRetryHandlerRef.current) {
      const handler = gestureRetryHandlerRef.current;
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
      window.removeEventListener('touchstart', handler);
      gestureRetryHandlerRef.current = null;
    }
    waitingForRingtoneGestureRef.current = false;

    if (!ringtoneAudioRef.current) return;

    ringtoneAudioRef.current.pause();
    ringtoneAudioRef.current.currentTime = 0;
    ringtoneAudioRef.current = null;
  }, []);

  const tryPlayIncomingRingtone = useCallback((audio) => {
    if (!audio) return;

    audio.play().then(() => {
      waitingForRingtoneGestureRef.current = false;
      if (gestureRetryHandlerRef.current) {
        const handler = gestureRetryHandlerRef.current;
        window.removeEventListener('pointerdown', handler);
        window.removeEventListener('keydown', handler);
        window.removeEventListener('touchstart', handler);
        gestureRetryHandlerRef.current = null;
      }
    }).catch((error) => {
      if (error?.name === 'NotAllowedError') {
        if (waitingForRingtoneGestureRef.current) return;
        waitingForRingtoneGestureRef.current = true;

        const retryPlayback = () => {
          const currentAudio = ringtoneAudioRef.current;
          if (!currentAudio) return;
          currentAudio.play().catch(() => {
            // Если браузер все еще блокирует, ждем следующий жест пользователя.
          });
        };

        gestureRetryHandlerRef.current = retryPlayback;
        window.addEventListener('pointerdown', retryPlayback, { passive: true });
        window.addEventListener('keydown', retryPlayback);
        window.addEventListener('touchstart', retryPlayback, { passive: true });
        return;
      }

      console.warn('HomePage: failed to play incoming call ringtone:', error);
    });
  }, []);

  useEffect(() => {
    chatsRef.current = Array.isArray(chats) ? chats : [];
  }, [chats]);

  useEffect(() => {
    soundpadBridge.syncAudioConfigToElectron().catch(() => {});
    soundpadBridge.warmUpInAppMixer().catch(() => {});
    soundpadBridge.warmUpSystemBridge().catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id || !getConnection) return undefined;

    let mounted = true;
    let incomingCallHandler = null;
    let messageSentHandler = null;

    const setupIncomingCallListener = async () => {
      try {
        const connection = await getConnection('groupchathub', user.id);
        if (!mounted) return;

        setGroupChatConnection(connection);

        incomingCallHandler = (payload) => {
          const chatIdValue = payload?.chatId || payload?.ChatId;
          const callerId = payload?.callerId || payload?.CallerId;
          const callerName = payload?.caller || payload?.Caller;

          if (!chatIdValue) return;
          if (String(callerId) === String(user.id)) return;

          const matchedChat = chatsRef.current.find((chat) => String(chat.chatId || chat.chat_id) === String(chatIdValue));
          const displayName = matchedChat?.groupName || matchedChat?.username || callerName || 'Неизвестный';
          const callerKey = callerId ? String(callerId) : '';
          const cachedCallerProfile = callerKey ? callerProfilesRef.current.get(callerKey) : null;

          const fallbackAvatarUrl = matchedChat?.avatarUrl || matchedChat?.avatar || null;
          const fallbackAvatarColor = matchedChat?.avatarColor || '#5865F2';

          setIncomingCall({
            chatId: String(chatIdValue),
            callerId: callerKey || null,
            callerName: callerName || displayName,
            chatName: displayName,
            avatarUrl: cachedCallerProfile?.avatarUrl || fallbackAvatarUrl,
            avatarColor: cachedCallerProfile?.avatarColor || fallbackAvatarColor
          });

          if (callerKey && !cachedCallerProfile) {
            fetch(`${BASE_URL}/api/profile/${callerKey}/profile`)
              .then(async (response) => {
                if (!response.ok) return null;
                const profile = await response.json();
                return {
                  avatarUrl: profile?.avatar || null,
                  avatarColor: profile?.avatarColor || fallbackAvatarColor
                };
              })
              .then((profileData) => {
                if (!profileData) return;

                callerProfilesRef.current.set(callerKey, profileData);
                setIncomingCall((prev) => {
                  if (!prev || prev.callerId !== callerKey) return prev;
                  return {
                    ...prev,
                    avatarUrl: profileData.avatarUrl || prev.avatarUrl,
                    avatarColor: profileData.avatarColor || prev.avatarColor
                  };
                });
              })
              .catch((error) => {
                console.warn('HomePage: failed to load caller avatar for incoming call:', error);
              });
          }
        };

        messageSentHandler = (payload) => {
          const messageId = payload?.messageId ?? payload?.MessageId;
          const chatIdValue = payload?.chatId ?? payload?.ChatId;
          const senderId = payload?.senderId ?? payload?.SenderId;
          if (!messageId || !chatIdValue) return;
          if (String(senderId) === String(user.id)) return;

          const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidPattern.test(String(messageId))) return;

          connection
            .invoke('AcknowledgeDelivery', String(messageId), String(chatIdValue))
            .catch((error) => {
              console.warn('HomePage: AcknowledgeDelivery failed:', error);
            });
        };

        connection.on('IncomingCall', incomingCallHandler);
        connection.on('MessageSent', messageSentHandler);
        groupChatConnectionRef.current = connection;
      } catch (error) {
        console.error('HomePage: failed to setup IncomingCall listener', error);
      }
    };

    setupIncomingCallListener();

    return () => {
      mounted = false;
      if (groupChatConnectionRef.current) {
        if (incomingCallHandler) {
          groupChatConnectionRef.current.off('IncomingCall', incomingCallHandler);
        }
        if (messageSentHandler) {
          groupChatConnectionRef.current.off('MessageSent', messageSentHandler);
        }
      }
    };
  }, [getConnection, user?.id]);

  useEffect(() => {
    if (!groupChatConnection || groupChatConnection.state !== 'Connected' || !Array.isArray(chats)) return;

    chats.forEach((chat) => {
      const chatIdValue = String(chat.chatId || chat.chat_id || '');
      if (!chatIdValue || joinedChatGroupsRef.current.has(chatIdValue)) return;

      groupChatConnection
        .invoke('JoinGroup', chatIdValue)
        .then(() => {
          joinedChatGroupsRef.current.add(chatIdValue);
        })
        .catch((error) => {
          console.warn('HomePage: failed to join chat group for incoming calls:', chatIdValue, error);
        });
    });

    groupChatConnection
      .invoke('AcknowledgePendingDeliveries')
      .catch((error) => {
        console.warn('HomePage: AcknowledgePendingDeliveries failed:', error);
      });
  }, [chats, groupChatConnection]);

  const activeIncomingCallKey = incomingCall
    ? `${incomingCall.chatId}:${incomingCall.callerId || incomingCall.callerName || ''}`
    : null;

  useEffect(() => {
    if (!activeIncomingCallKey) {
      stopIncomingCallRingtone();
      return undefined;
    }

    const audio = new Audio(getAppSoundUrl('incomingCall') || '/den-den-mushi.mp3');
    audio.loop = true;
    audio.volume = 0.45;
    ringtoneAudioRef.current = audio;

    tryPlayIncomingRingtone(audio);

    return () => {
      stopIncomingCallRingtone();
    };
  }, [activeIncomingCallKey, stopIncomingCallRingtone, tryPlayIncomingRingtone]);

  useEffect(() => {
    if (!incomingCall) return undefined;

    const timeoutId = setTimeout(() => {
      setIncomingCall(null);
    }, 180000);

    return () => clearTimeout(timeoutId);
  }, [incomingCall]);

  useEffect(() => {
    if (activeChatCall) {
      setIncomingCall(null);
    }
  }, [activeChatCall]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('incomingCallChanged', { detail: incomingCall }));
  }, [incomingCall]);

  useEffect(() => {
    const onDesktopCallOverlayActive = (event) => {
      setDesktopCallOverlayActive(Boolean(event.detail?.active));
    };

    window.addEventListener('desktopCallOverlayActive', onDesktopCallOverlayActive);
    return () => window.removeEventListener('desktopCallOverlayActive', onDesktopCallOverlayActive);
  }, []);

  const handleAcceptIncomingCall = useCallback(() => {
    if (!incomingCall || !user?.id) return;

    const callData = {
      roomId: incomingCall.chatId,
      roomName: `Звонок с ${incomingCall.chatName}`,
      userName: user.username,
      userId: user.id,
      isPrivateCall: true,
      chatId: incomingCall.chatId
    };

    handleJoinVoiceChannel(callData);
    navigate(`/channels/@me/${incomingCall.chatId}`);
    setIncomingCall(null);
  }, [handleJoinVoiceChannel, incomingCall, navigate, user?.id, user?.username]);

  const handleDeclineIncomingCall = useCallback(() => {
    setIncomingCall(null);
  }, []);

  useEffect(() => {
    const onOverlayAction = (event) => {
      if (event.detail?.action === 'accept') {
        handleAcceptIncomingCall();
      } else if (event.detail?.action === 'decline') {
        handleDeclineIncomingCall();
      }
    };

    window.addEventListener('incomingCallOverlayAction', onOverlayAction);
    return () => window.removeEventListener('incomingCallOverlayAction', onOverlayAction);
  }, [handleAcceptIncomingCall, handleDeclineIncomingCall]);

  React.useEffect(() => {
    if (user?.id) {
      console.log('HomePage: Creating server connection for user:', user.id);
      createConnection(user.id);
    }
  }, [user?.id, createConnection]); // Возвращаем createConnection

  React.useEffect(() => {
    const handleServerCreated = (event) => {
      const serverData = event.detail;
      console.log('HomePage: ServerCreated event received, navigating to new server:', serverData);
      console.log('HomePage: Current location:', window.location.pathname);
      console.log('HomePage: Target URL:', `/server/${serverData.serverId}`);
      
      setTimeout(() => {
        console.log('HomePage: Executing navigation to:', `/server/${serverData.serverId}`);
        try {
          navigate(`/server/${serverData.serverId}`);
          console.log('HomePage: Navigation executed successfully');
        } catch (error) {
          console.error('HomePage: Navigation failed:', error);
        }
      }, 200);
    };

    window.addEventListener('serverCreated', handleServerCreated);
    
    return () => {
      window.removeEventListener('serverCreated', handleServerCreated);
    };
  }, [navigate]);

  useEffect(() => {
    if (serverAccessDenied) {
      console.warn('SECURITY WARNING: Server API returned access denied. Redirecting to home page.');
      setSelectedServer(null);
      setSelectedChat(null);
      navigate('/', { replace: true });
    }
  }, [serverAccessDenied, navigate]);

  useEffect(() => {
    if (servers && servers.length > 0) {
      console.log('HomePage: Servers updated:', servers);
    }
  }, [servers]);

  useEffect(() => {
    if (serverId && serverData) {
      console.log('HomePage: Setting selectedServer to:', serverData);
      setSelectedServer(serverData);
    }
  }, [serverId, serverData]);

  useEffect(() => {
    if (selectedServer && servers && serverId) {
      console.log('HomePage: Checking if selectedServer is in servers list');
      console.log('HomePage: selectedServer.serverId:', selectedServer.serverId);
      console.log('HomePage: current serverId:', serverId);
      console.log('HomePage: servers list:', servers.map(s => s.serverId));
      
      if (selectedServer.serverId !== serverId) {
        console.log('HomePage: selectedServer does not match current serverId, skipping check');
        return;
      }
      
      const isServerInList = servers.some(server => server.serverId === selectedServer.serverId);
      if (!isServerInList) {
        console.log('HomePage: Selected server no longer in user servers, checking again in 1 second...');
        setTimeout(() => {
          const isServerInListAfterDelay = servers.some(server => server.serverId === selectedServer.serverId);
          if (!isServerInListAfterDelay) {
            console.log('HomePage: Selected server still not in user servers after delay, clearing selection');
            setSelectedServer(null);
            setSelectedChat(null);
            navigate('/channels/@me');
          } else {
            console.log('HomePage: Server found in list after delay, keeping selection');
          }
        }, 1000);
      } else {
        console.log('HomePage: Selected server is in servers list, keeping selection');
      }
    }
  }, [selectedServer, servers, serverId, navigate]);

  useEffect(() => {
    if (serverId && channelId) {
      // Добавляем небольшую задержку, чтобы дать время обновиться данным сервера
      const timeoutId = setTimeout(() => {
        const currentServerData = serverDataFromPanel || serverData;
        console.log('HomePage: Using serverDataFromPanel:', !!serverDataFromPanel);
        console.log('HomePage: Using serverData:', !!serverData);
        console.log('HomePage: Current server data source:', serverDataFromPanel ? 'serverDataFromPanel' : 'serverData');
        
        if (currentServerData) {
          const foundChannel = currentServerData.categories
            ?.flatMap(category => category.chats || category.Chats || [])
            .find(chat => (chat.chatId || chat.ChatId || chat.chat_id) === channelId);
          
          const allChannels = currentServerData.categories?.flatMap(category => category.chats || category.Chats || []);
          console.log('All channels in server:', allChannels);
          console.log('All channels details:', allChannels?.map(ch => ({ 
            chatId: ch.chatId, 
            ChatId: ch.ChatId, 
            chat_id: ch.chat_id, 
            name: ch.name || ch.Name 
          })));
          console.log('HomePage: Looking for channelId:', channelId);
          console.log('HomePage: Found channel:', foundChannel);
          
          if (foundChannel) {
            const channelData = {
              ...foundChannel,
              chatId: foundChannel.chatId || foundChannel.ChatId || foundChannel.chat_id,
              groupName: foundChannel.name || foundChannel.Name || foundChannel.groupName,
              username: foundChannel.name || foundChannel.Name || foundChannel.username
            };
            console.log('HomePage: Setting selectedChat to:', channelData);
            setSelectedChat(channelData);
          } else {
            console.log('HomePage: Channel not found, setting selectedChat to null');
            setSelectedChat(null);
            navigate(`/server/${serverId}`, { replace: true });
          }
        }
      }, 200); // Задержка 200мс для обновления данных
      
      return () => clearTimeout(timeoutId);
    }
  }, [serverId, channelId, serverData, serverDataFromPanel, navigate]);

  // Слушаем событие переключения канала для обновления интерфейса
  useEffect(() => {
    const handleVoiceChannelSwitched = (event) => {
      const { channelId: newChannelId, channelName: newChannelName, sourceChannelId } = event.detail;
      console.log('HomePage: voiceChannelSwitched event received:', { newChannelId, newChannelName, sourceChannelId, currentSelectedChat: selectedChat });
      
      // Если переключились в канал, который сейчас открыт, обновляем selectedChat
      if (selectedChat && (selectedChat.chatId || selectedChat.chat_id) === newChannelId) {
        console.log('HomePage: Updating selectedChat with new channel name:', newChannelName);
        setSelectedChat(prev => ({
          ...prev,
          groupName: newChannelName,
          name: newChannelName,
          Name: newChannelName,
          username: newChannelName
        }));
      } else if (selectedChat && (selectedChat.chatId || selectedChat.chat_id) === sourceChannelId) {
        // Если переключились из канала, который сейчас открыт, обновляем selectedChat на новый канал
        console.log('HomePage: User switched from current channel, updating selectedChat to new channel:', newChannelId);
        
        // Получаем данные нового канала из serverData
        const currentServerData = serverDataFromPanel || serverData;
        if (currentServerData) {
          const allChannels = currentServerData.categories?.flatMap(category => category.chats || category.Chats || []) || [];
          const foundChannel = allChannels.find(chat => 
            (chat.chatId || chat.ChatId || chat.chat_id) === newChannelId
          );
          
          if (foundChannel) {
            const channelData = {
              ...foundChannel,
              chatId: foundChannel.chatId || foundChannel.ChatId || foundChannel.chat_id,
              groupName: foundChannel.name || foundChannel.Name || foundChannel.groupName || newChannelName,
              name: foundChannel.name || foundChannel.Name || newChannelName,
              Name: foundChannel.name || foundChannel.Name || newChannelName,
              username: foundChannel.name || foundChannel.Name || foundChannel.username || newChannelName,
              chatType: foundChannel.typeId || foundChannel.chatType,
              chatTypeId: foundChannel.typeId || foundChannel.chatType,
              isGroupChat: false,
              isServerChat: true
            };
            console.log('HomePage: Setting selectedChat to new channel:', channelData);
            setSelectedChat(channelData);
            
            // Обновляем URL без перезагрузки страницы (используем replace: true для сохранения состояния)
            if (serverId) {
              // Используем window.history для обновления URL без размонтирования компонентов
              window.history.replaceState(null, '', `/server/${serverId}/${newChannelId}`);
            }
          } else {
            // Если канал не найден в данных сервера, создаем базовый объект
            console.log('HomePage: Channel not found in server data, creating basic channel object');
            setSelectedChat({
              chatId: newChannelId,
              chat_id: newChannelId,
              groupName: newChannelName,
              name: newChannelName,
              Name: newChannelName,
              username: newChannelName,
              chatType: '44444444-4444-4444-4444-444444444444',
              chatTypeId: '44444444-4444-4444-4444-444444444444',
              isGroupChat: false,
              isServerChat: true
            });
            
            if (serverId) {
              // Используем window.history для обновления URL без размонтирования компонентов
              window.history.replaceState(null, '', `/server/${serverId}/${newChannelId}`);
            }
          }
        } else {
          // Если нет данных сервера, создаем базовый объект
          console.log('HomePage: No server data available, creating basic channel object');
          setSelectedChat({
            chatId: newChannelId,
            chat_id: newChannelId,
            groupName: newChannelName,
            name: newChannelName,
            Name: newChannelName,
            username: newChannelName,
            chatType: '44444444-4444-4444-4444-444444444444',
            chatTypeId: '44444444-4444-4444-4444-444444444444',
            isGroupChat: false,
            isServerChat: true
          });
          
          if (serverId) {
            // Используем window.history для обновления URL без размонтирования компонентов
            window.history.replaceState(null, '', `/server/${serverId}/${newChannelId}`);
          }
        }
      }
    };
    
    window.addEventListener('voiceChannelSwitched', handleVoiceChannelSwitched);
    return () => {
      window.removeEventListener('voiceChannelSwitched', handleVoiceChannelSwitched);
    };
  }, [selectedChat, serverData, serverDataFromPanel, serverId, navigate]);

  useEffect(() => {
    if (!chatId) {
      privateChatRouteResolveRef.current = { chatId: null, refreshCalls: 0 };
      return;
    }
    if (!initialChatsLoaded) {
      return;
    }

    const id = String(chatId);
    if (privateChatRouteResolveRef.current.chatId !== id) {
      privateChatRouteResolveRef.current = { chatId: id, refreshCalls: 0 };
    }

    const foundChat = chats.find((c) => String(c.chatId || c.chat_id) === id);

    if (foundChat) {
      privateChatRouteResolveRef.current.refreshCalls = 0;
      setSelectedChat((prev) => {
        const prevId = String(prev?.chatId || prev?.chat_id || '');
        const nextId = String(foundChat.chatId || foundChat.chat_id || '');
        if (prevId === nextId) {
          return prev;
        }
        return foundChat;
      });
      setSelectedServer(null);
      return;
    }

    if (privateChatRouteResolveRef.current.refreshCalls < 2) {
      privateChatRouteResolveRef.current.refreshCalls += 1;
      void refreshChats();
      return;
    }

    privateChatRouteResolveRef.current = { chatId: null, refreshCalls: 0 };
    setSelectedChat(null);
    setSelectedServer(null);
    navigate('/channels/@me', { replace: true });
  }, [chatId, chats, navigate, initialChatsLoaded, refreshChats]);

  const handleChatSelected = (chat) => {
    setShowDiscovery(false);

    if (chat && !chat.isServerChat) {
      setSelectedChat(chat);
      setSelectedServer(null);
      navigate(`/channels/@me/${chat.chatId || chat.chat_id}`);
    } else if (chat && selectedServer) {
      setSelectedChat(chat);
      navigate(`/server/${selectedServer.serverId}/channel/${chat.chatId || chat.chat_id}`);
    } else {
      setSelectedChat(chat);
    }
  };

  const handleCloseSelectedChat = useCallback(() => {
    setSelectedChat(null);
    if (selectedServer?.serverId) {
      navigate(`/server/${selectedServer.serverId}`);
    } else {
      navigate('/channels/@me');
    }
  }, [selectedServer, navigate]);

  useEffect(() => {
    const handleVoiceCallEnded = (event) => {
      const endedChannelId = event.detail?.channelId;
      if (!endedChannelId || !selectedChat) return;

      const activeChatId = selectedChat.chatId || selectedChat.chat_id;
      if (!activeChatId || String(activeChatId) !== String(endedChannelId)) return;

      const currentServerData = serverDataFromPanel || serverData;
      const channelInServer = findChannelInCategories(
        currentServerData?.categories,
        endedChannelId
      );
      if (!channelInServer) {
        handleCloseSelectedChat();
      }
    };

    window.addEventListener('voiceCallEnded', handleVoiceCallEnded);
    return () => window.removeEventListener('voiceCallEnded', handleVoiceCallEnded);
  }, [selectedChat, serverData, serverDataFromPanel, handleCloseSelectedChat]);

  const handleServerDataUpdated = useCallback((updatedServerData) => {
    console.log('HomePage: Server data updated from ServerPanel:', updatedServerData);
    console.log('HomePage: Updated categories:', updatedServerData.categories);
    console.log('HomePage: All channels in updated data:', updatedServerData.categories?.flatMap(category => category.chats || category.Chats || []));
    setServerDataFromPanel(updatedServerData);
  }, []);

  const handleServerSelected = useCallback((server) => {
    setSelectedServer(server);
    setSelectedChat(null); 
    setShowDiscovery(false);
    
    if (server) {
      navigate(`/server/${server.serverId}`);
    } else {
      navigate('/channels/@me');
    }
  }, [navigate]);

  const handleDiscoverClick = useCallback((show) => {
    setShowDiscovery(show);
  }, []);

  const handleFriendsSelected = useCallback(() => {
    setShowDiscovery(false);
    navigate('/channels/@me/friends');
  }, [navigate]);

  const handleCreateServerClick = useCallback(() => {
    setShowCreateServerModal(true);
  }, []);

  const handleCreateServer = useCallback(async (serverData) => {
    const newServer = await createServer({
      serverName: serverData.serverName,
      description: serverData.description || '',
      isPublic: serverData.isPublic || false,
    });

    if (serverData.avatarFile && newServer?.serverId) {
      try {
        await serverApi.uploadServerAvatar(newServer.serverId, serverData.avatarFile);
        await fetchServers();
      } catch (avatarError) {
        console.error('Error uploading server icon:', avatarError);
      }
    }

    setShowCreateServerModal(false);

    if (newServer?.serverId) {
      const channelPath = newServer.defaultChannelId
        ? `/server/${newServer.serverId}/channel/${newServer.defaultChannelId}`
        : `/server/${newServer.serverId}`;
      navigate(channelPath);
    }

    return newServer;
  }, [createServer, fetchServers, navigate]);

  const handleCloseCreateServerModal = useCallback(() => {
    setShowCreateServerModal(false);
  }, []);

  const handleSettingsClick = useCallback(() => {
    openSettings('account');
  }, [openSettings]);

  const handleNotificationsClick = useCallback(() => {
    setShowNotificationsModal(true);
  }, []);

  const handleCloseNotificationsModal = useCallback(() => {
    setShowNotificationsModal(false);
  }, []);

  const handleSoundpadClick = useCallback(() => {
    setShowSoundpadModal(true);
  }, []);

  const handleCloseSoundpadModal = useCallback(() => {
    setShowSoundpadModal(false);
  }, []);

  const handleOpenNotification = useCallback(async (notification) => {
    const notificationId = notification.id || notification.Id;
    const targetChatId = notification.chatId || notification.ChatId;
    const targetServerId = notification.serverId || notification.ServerId;
    const isRead = notification.isRead ?? notification.IsRead;
    if (!isRead && notificationId) {
      await markAsRead(notificationId);
    }
    setShowNotificationsModal(false);
    if (targetChatId) {
      if (targetServerId) {
        navigate(`/server/${targetServerId}/channel/${targetChatId}`);
      } else {
        navigate(`/channels/@me/${targetChatId}`);
      }
    }
  }, [markAsRead, navigate]);

  const handleDeleteNotification = useCallback(async (e, notification) => {
    e.stopPropagation();
    const notificationId = notification.id || notification.Id;
    if (!notificationId) return;
    await deleteNotification(notificationId);
  }, [deleteNotification]);

  /**
   * Server channel unread counters do not appear in DM-only `messageUnreadCountByChat` from ChatList hub,
   * so we must always sync read state once the chat is visible and listing/messages settle.
   * New realtime messages bump `messagesTailKey` in ChatRoom and re-trigger a debounced read.
   */
  const scheduleMarkChatNotificationsRead = useCallback(
    (explicitChatId) => {
      const targetId = explicitChatId || selectedChat?.chatId || selectedChat?.chat_id;
      if (!targetId) return;
      if (document.visibilityState !== 'visible') return;
      if (showFriends || showDiscovery || showNotificationsModal) return;

      window.clearTimeout(markReadTimerRef.current);
      markReadTimerRef.current = window.setTimeout(async () => {
        try {
          await markChatAsRead(targetId);
        } catch (err) {
          console.error('Failed to auto-mark chat notifications as read', err);
        }
      }, 400);
    },
    [selectedChat, showFriends, showDiscovery, showNotificationsModal, markChatAsRead]
  );

  useEffect(() => {
    return () => {
      window.clearTimeout(markReadTimerRef.current);
    };
  }, []);

  useEffect(() => {
    scheduleMarkChatNotificationsRead();
  }, [scheduleMarkChatNotificationsRead]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleMarkChatNotificationsRead();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [scheduleMarkChatNotificationsRead]);

  useEffect(() => {
    if (showNotificationsModal) {
      refreshNotifications();
      refreshUnreadCount();
    }
  }, [showNotificationsModal, refreshNotifications, refreshUnreadCount]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;

      if (showCreateServerModal) {
        e.preventDefault();
        setShowCreateServerModal(false);
        return;
      }
      if (isSettingsOpen) {
        e.preventDefault();
        closeSettings();
        return;
      }
      if (showNotificationsModal) {
        e.preventDefault();
        setShowNotificationsModal(false);
        return;
      }
      if (showSoundpadModal) {
        e.preventDefault();
        setShowSoundpadModal(false);
        return;
      }

      if (selectedChat && !showFriends && !showDiscovery) {
        e.preventDefault();
        handleCloseSelectedChat();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [
    showCreateServerModal,
    isSettingsOpen,
    closeSettings,
    showNotificationsModal,
    showSoundpadModal,
    selectedChat,
    showFriends,
    showDiscovery,
    handleCloseSelectedChat,
  ]);

  const activeServerForPermissions = serverDataFromPanel || selectedServer;
  const serverChannelPermissions = getServerPermissions(activeServerForPermissions);
  const isActiveServerOwner = checkIsServerOwner(activeServerForPermissions, user?.id);
  const userCanMuteMembers = canMuteMembers(serverChannelPermissions, isActiveServerOwner);

  return (
    <div className="home-page">
      <div className="home-content">
        <div className="main-layout">
          <ServerList 
            onServerSelected={handleServerSelected}
            selectedServerId={selectedServer?.serverId}
            onDiscoverClick={handleDiscoverClick}
            onCreateServerClick={handleCreateServerClick}
            onSettingsClick={handleSettingsClick}
            onSoundpadClick={isElectronApp ? handleSoundpadClick : undefined}
            onNotificationsClick={handleNotificationsClick}
            unreadNotificationsCount={unreadCount}
            userId={user?.id}
          />
          <div className="content-area">
            <ResizableSidebarShell>
              {selectedServer ? (
                <ServerPanel
                  selectedServer={selectedServer}
                  onChatSelected={handleChatSelected}
                  selectedChat={selectedChat}
                  onServerDataUpdated={handleServerDataUpdated}
                  unreadCountByChat={messageUnreadCountByChat}
                />
              ) : (
                <ChatList
                  onChatSelected={handleChatSelected}
                  onFriendsSelected={handleFriendsSelected}
                  selectedChatId={selectedChat?.chatId || selectedChat?.chat_id}
                  unreadCountByChat={messageUnreadCountByChat}
                  chats={chats}
                  searchResults={searchResults}
                  isSearching={isSearching}
                  isLoading={isLoading}
                  searchUsers={searchUsers}
                  createPrivateChat={createPrivateChat}
                />
              )}
            </ResizableSidebarShell>
            <div className="main-area">
              {showFriends ? (
                <FriendsPanel 
                  onStartChat={async (userId) => {
                    try {
                      await createPrivateChat(userId);
                    } catch (error) {
                      console.error('Error creating private chat:', error);
                    }
                  }}
                />
              ) : showDiscovery ? (
                <ServerDiscovery 
                  onServerSelected={handleServerSelected}
                  onClose={() => setShowDiscovery(false)}
                />
                  ) : selectedChat ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                  {/* Check if it's a voice channel */}
                  {isVoiceChannel(selectedChat) ? (
                    <VoiceCallView
                      channelId={selectedChat.chatId || selectedChat.chat_id}
                      channelName={selectedChat.groupName || selectedChat.name || selectedChat.Name || selectedChat.username}
                      userId={user?.id || user?.userId}
                      userName={user?.username || user?.name}
                      onClose={handleCloseSelectedChat}
                      serverId={selectedServer?.serverId}
                      canMuteMembers={userCanMuteMembers}
                    />
                  ) : isIdeasBoardChannel(selectedChat) ? (
                    <IdeasBoardView
                      channelId={selectedChat.chatId || selectedChat.chat_id}
                      channelName={selectedChat.groupName || selectedChat.name || selectedChat.Name || selectedChat.username}
                      serverId={selectedServer?.serverId}
                      userId={user?.id || user?.userId}
                      canCreate={canSendMessages(serverChannelPermissions, isActiveServerOwner)}
                      canModerate={canManageMessages(serverChannelPermissions, isActiveServerOwner)}
                    />
                  ) : (
                    <ChatRoom
                      key={selectedChat.chatId || selectedChat.chat_id}
                      chatId={selectedChat.chatId || selectedChat.chat_id}
                      groupName={selectedChat.groupName || selectedChat.username}
                      isGroupChat={selectedChat.isGroupChat}
                      isServerChat={selectedServer ? true : false}
                      chatTypeId={selectedChat.chatTypeId}
                      userId={user?.id}
                      userPermissions={serverChannelPermissions}
                      isServerOwner={isActiveServerOwner}
                      serverId={selectedServer?.serverId}
                      serverOwnerId={selectedServer?.ownerId ?? selectedServer?.OwnerId}
                      onJoinVoiceChannel={handleJoinVoiceChannel}
                      activeChatCall={activeChatCall}
                      onEndChatCall={handleEndChatCall}
                      onMessagesActivity={scheduleMarkChatNotificationsRead}
                    />
                  )}
                </div>
              ) : selectedServer ? (
                <div className="no-chat-selected">
                  <h4>Выберите канал для начала общения</h4>
                  <p>Список каналов находится в левой панели</p>
                </div>
              ) : (
                <div className="no-selection">
                  <h3>Добро пожаловать в Whithin Messenger!</h3>
                  <p>Выберите сервер или чат для начала общения</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CreateServerModal
        isOpen={showCreateServerModal}
        onClose={handleCloseCreateServerModal}
        onCreate={handleCreateServer}
      />

      {isElectronApp && (
        <SoundpadSoundsModal
          isOpen={showSoundpadModal}
          onClose={handleCloseSoundpadModal}
        />
      )}

      <NotificationsModal
        isOpen={showNotificationsModal}
        onClose={handleCloseNotificationsModal}
        notifications={notifications}
        loading={notificationsLoading}
        error={notificationsError}
        unreadCount={unreadCount}
        onOpenNotification={handleOpenNotification}
        onDeleteNotification={handleDeleteNotification}
      />

      {incomingCall && !desktopCallOverlayActive && (
        <div className="global-incoming-call-overlay">
          <div className="global-incoming-call-card">
            <div className="global-incoming-call-avatar-ring">
              <UserAvatar
                username={incomingCall.callerName}
                avatarUrl={incomingCall.avatarUrl}
                avatarColor={incomingCall.avatarColor}
                size={88}
              />
            </div>
            <div className="global-incoming-call-user">{incomingCall.callerName}</div>
            {incomingCall.chatName && incomingCall.chatName !== incomingCall.callerName ? (
              <div className="global-incoming-call-chat-name">{incomingCall.chatName}</div>
            ) : null}
            <div className="global-incoming-call-text">Входящий звонок...</div>
            <div className="global-incoming-call-actions">
              <button
                type="button"
                className="global-incoming-call-button decline"
                onClick={handleDeclineIncomingCall}
                title="Отклонить"
              >
                <CallEnd style={{ fontSize: '20px' }} />
              </button>
              <button
                type="button"
                className="global-incoming-call-button accept"
                onClick={handleAcceptIncomingCall}
                title="Принять"
              >
                <Call style={{ fontSize: '20px' }} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(HomePage);
