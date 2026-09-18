import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { HubConnectionState } from '@microsoft/signalr';
import { useConnectionContext } from '../../../shared/lib/contexts/ConnectionContext';
import { PROFILE_UPDATED_EVENT } from '../../../shared/lib/contexts/ProfileModalContext';
import { patchChatListItemWithProfile } from '../../../shared/lib/utils/profilePatchHelpers';
import { useStartupBoot } from '../../../shared/lib/contexts/StartupBootContext';
import {
  decryptChatListItem,
  decryptChatListItems,
  needsChatListE2eDecrypt,
  normalizeChatUpdatedPayload,
} from '../../../shared/lib/e2e/e2eChatListPreview';
import {
  handleChatKeyRewrapNeeded,
  syncSessionE2eKeys,
} from '../../../shared/lib/e2e/e2eSessionSync';

const resolveCurrentUserId = (userId) => userId || null;

const getPinOrder = (chat) => {
  const order = chat?.pinOrder ?? chat?.PinOrder;
  return order == null ? Number.MAX_SAFE_INTEGER : Number(order);
};

const comparePinnedChats = (a, b) => {
  const orderA = getPinOrder(a);
  const orderB = getPinOrder(b);
  if (orderA !== orderB) return orderA - orderB;

  const pinnedAtA = new Date(a.pinnedAt ?? a.PinnedAt ?? 0).getTime();
  const pinnedAtB = new Date(b.pinnedAt ?? b.PinnedAt ?? 0).getTime();
  return pinnedAtA - pinnedAtB;
};

const sortChats = (items) => {
  const saved = [];
  const pinned = [];
  const unpinned = [];

  items.forEach((chat) => {
    if (Boolean(chat.isSavedMessages ?? chat.IsSavedMessages)) {
      saved.push(chat);
      return;
    }

    if (Boolean(chat.isPinned ?? chat.IsPinned)) {
      pinned.push(chat);
      return;
    }

    unpinned.push(chat);
  });

  pinned.sort(comparePinnedChats);
  unpinned.sort((a, b) => {
    const timeA = new Date(a.lastMessageTime || 0).getTime();
    const timeB = new Date(b.lastMessageTime || 0).getTime();
    return timeB - timeA;
  });

  return [...saved, ...pinned, ...unpinned];
};

const applyPinnedChatOrder = (items, orderedChatIds) => {
  const orderMap = new Map(
    orderedChatIds.map((id, index) => [String(id), index]),
  );

  const updated = items.map((chat) => {
    const chatId = String(chat.chatId ?? chat.chat_id ?? '');
    if (!orderMap.has(chatId)) {
      return chat;
    }

    const order = orderMap.get(chatId);
    return {
      ...chat,
      pinOrder: order,
      PinOrder: order,
    };
  });

  return sortChats(updated);
};

const normalizeChatListItem = (chat) => {
  if (!chat || typeof chat !== 'object') {
    return chat;
  }

  return {
    ...chat,
    chatId: chat.chatId ?? chat.ChatId,
    username: chat.username ?? chat.Username ?? '',
    userId: chat.userId ?? chat.UserId,
    avatarUrl: chat.avatarUrl ?? chat.AvatarUrl ?? null,
    avatarColor: chat.avatarColor ?? chat.AvatarColor ?? null,
    nameplate: chat.nameplate ?? chat.Nameplate ?? null,
    avatarDecoration: chat.avatarDecoration ?? chat.AvatarDecoration ?? null,
    userStatus: chat.userStatus ?? chat.UserStatus ?? null,
    isGroupChat: Boolean(chat.isGroupChat ?? chat.IsGroupChat),
    isSavedMessages: Boolean(chat.isSavedMessages ?? chat.IsSavedMessages),
    isPinned: Boolean(chat.isPinned ?? chat.IsPinned),
    pinnedAt: chat.pinnedAt ?? chat.PinnedAt ?? null,
    pinOrder: chat.pinOrder ?? chat.PinOrder ?? null,
    lastMessage: chat.lastMessage ?? chat.LastMessage ?? '',
    lastMessageTime: chat.lastMessageTime ?? chat.LastMessageTime ?? null,
    lastMessageEncryptionVersion:
      Number(chat.lastMessageEncryptionVersion ?? chat.LastMessageEncryptionVersion ?? 0) || 0,
    lastMessageEncryptedPayload:
      chat.lastMessageEncryptedPayload ?? chat.LastMessageEncryptedPayload ?? null,
    lastMessageSenderId: chat.lastMessageSenderId ?? chat.LastMessageSenderId ?? null,
    unreadCount: chat.unreadCount ?? chat.UnreadCount ?? 0,
  };
};

export const useChatList = (userId, onChatCreated = null) => {
  const navigate = useNavigate();
  const { markChatsReady } = useStartupBoot();
  const connectionContext = useConnectionContext();
  const getSharedConnection = connectionContext?.getConnection;
  const subscribeReconnected = connectionContext?.onReconnected;
  const subscribeReconnecting = connectionContext?.onReconnecting;
  const subscribeClosed = connectionContext?.onClose;
  const [chats, setChats] = useState([]);
  const [initialChatsLoaded, setInitialChatsLoaded] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading] = useState(false);
  const [connection, setConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const normalizeUnreadCount = useCallback((chat) => {
    return chat?.unreadCount ?? chat?.UnreadCount ?? chat?.unread_count ?? 0;
  }, []);
  const connectionRef = useRef(null);
  const onChatCreatedRef = useRef(onChatCreated);
  const navigateRef = useRef(navigate);
  const userIdRef = useRef(userId);
  const chatsRef = useRef(chats);

  useEffect(() => {
    onChatCreatedRef.current = onChatCreated;
  }, [onChatCreated]);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    if (initialChatsLoaded) {
      markChatsReady();
    }
  }, [initialChatsLoaded, markChatsReady]);

  const bindConnectionHandlers = useCallback((conn) => {
    const handleReceiveChats = async (receivedChats) => {
      setInitialChatsLoaded(true);
      if (!Array.isArray(receivedChats)) {
        return;
      }

      const normalized = receivedChats.map(normalizeChatListItem);
      const currentUserId = resolveCurrentUserId(userIdRef.current);

      if (currentUserId) {
        try {
          await syncSessionE2eKeys(currentUserId, normalized);
        } catch (error) {
          console.warn('E2E session key sync failed:', error);
        }
      }

      const decrypted = currentUserId
        ? await decryptChatListItems(normalized, currentUserId)
        : normalized;

      setChats(sortChats(decrypted));
    };

    const handleE2eChatKeyRewrapNeeded = async (payload) => {
      const currentUserId = resolveCurrentUserId(userIdRef.current);
      if (!currentUserId || !payload?.chatId) {
        return;
      }

      const chatId = String(payload.chatId);
      const chatItem = chatsRef.current.find((chat) => String(chat.chatId) === chatId);

      const synced = await handleChatKeyRewrapNeeded(currentUserId, payload, chatItem);
      if (!synced) {
        return;
      }

      setChats((prevChats) => {
        const existing = prevChats.find((chat) => String(chat.chatId) === chatId);
        if (!existing || !needsChatListE2eDecrypt(existing)) {
          return prevChats;
        }

        void decryptChatListItem(existing, currentUserId).then((decrypted) => {
          setChats((current) => sortChats(
            current.map((chat) =>
              String(chat.chatId) === chatId
                ? normalizeChatListItem({ ...chat, ...decrypted })
                : chat,
            ),
          ));
        });

        return prevChats;
      });
    };

    const handleSearchResults = (results) => {
      const filteredResults = Array.isArray(results)
        ? results.filter((user) => user.isFriend === true || user.hasExistingChat === true)
        : [];
      setSearchResults(filteredResults);
    };

    const handleChatCreated = async (createdUserId, chatResult) => {
      const currentUserId = userIdRef.current;
      const isParticipant = createdUserId === currentUserId || chatResult?.targetUserId === currentUserId;

      if (!isParticipant) {
        return;
      }

      try {
        await conn.invoke('GetUserChats');
      } catch (err) {
        console.error('Error getting chats after creation:', err);
      }
    };

    const handlePrivateChatCreated = async (chatResult) => {
      try {
        await conn.invoke('GetUserChats');

        if (onChatCreatedRef.current && chatResult?.chatId) {
          onChatCreatedRef.current(chatResult.chatId);
        }
      } catch (err) {
        console.error('Error getting chats after private chat creation:', err);
      }
    };

    const handleChatDeleted = (data) => {
      if (typeof data === 'object' && data.chatId) {
        setChats((prev) => prev.filter((chat) => chat.chatId !== data.chatId));
        navigateRef.current('/channels/@me');
        return;
      }

      if (typeof data === 'string') {
        setChats((prev) => prev.filter((chat) => chat.chatId !== data));
        navigateRef.current('/channels/@me');
      }
    };

    const handleChatUpdated = (payloadOrChatId, lastMessage, lastMessageTime) => {
      void (async () => {
        const patch = normalizeChatUpdatedPayload(payloadOrChatId, lastMessage, lastMessageTime);
        const currentUserId = resolveCurrentUserId(userIdRef.current);

        setChats((prevChats) => {
          const existing = prevChats.find(
            (chat) => String(chat.chatId) === String(patch.chatId),
          );

          const merged = normalizeChatListItem({
            ...(existing || { chatId: patch.chatId }),
            ...patch,
            _e2eLastMessageDecrypted: false,
            e2eLastMessageDecrypted: false,
          });

          if (currentUserId && needsChatListE2eDecrypt(merged)) {
            void decryptChatListItem(merged, currentUserId).then((decrypted) => {
              setChats((current) => sortChats(
                current.map((chat) =>
                  String(chat.chatId) === String(patch.chatId)
                    ? normalizeChatListItem({ ...chat, ...decrypted })
                    : chat,
                ),
              ));
            });
          }

          return sortChats(
            prevChats.map((chat) =>
              String(chat.chatId) === String(patch.chatId) ? merged : chat,
            ),
          );
        });
      })();
    };

    const handleError = (errorMessage) => {
      console.error('SignalR error:', errorMessage);
    };

    const handleChatUnreadUpdated = (chatId, unreadCount) => {
      setChats((prevChats) =>
        prevChats.map((chat) =>
          String(chat.chatId) === String(chatId) ? { ...chat, unreadCount } : chat,
        ),
      );
    };

    // Соединение общее — снимаем только свои хендлеры (по ссылке), не conn.off('event').
    const handlers = [
      ['receivechats', handleReceiveChats],
      ['receivesearchresults', handleSearchResults],
      ['chatcreated', handleChatCreated],
      ['privatechatcreated', handlePrivateChatCreated],
      ['chatdeleted', handleChatDeleted],
      ['chatupdated', handleChatUpdated],
      ['chatunreadupdated', handleChatUnreadUpdated],
      ['error', handleError],
      ['e2echatkeyrewrapneeded', handleE2eChatKeyRewrapNeeded],
    ];

    for (const [eventName, handler] of handlers) {
      conn.on(eventName, handler);
    }

    return () => {
      for (const [eventName, handler] of handlers) {
        conn.off(eventName, handler);
      }
    };
  }, []);

  useEffect(() => {
    if (!userId || !getSharedConnection) {
      connectionRef.current = null;
      setConnection(null);
      setIsConnected(false);
      setInitialChatsLoaded(false);
      setChats([]);
      return undefined;
    }

    let cancelled = false;
    let unbindHandlers = null;
    const unsubscribers = [];

    const reloadChats = async (conn, reason) => {
      if (cancelled || !conn || conn.state !== HubConnectionState.Connected) return;
      try {
        await conn.invoke('GetUserChats');
      } catch (err) {
        console.error(`Error reloading chats (${reason}):`, err);
      }
    };

    const attachToSharedConnection = async () => {
      setInitialChatsLoaded(false);

      let conn;
      try {
        conn = await getSharedConnection('hub', userId);
      } catch (err) {
        console.error('Ошибка подключения к hub (chat list):', err);
        if (!cancelled) {
          setIsConnected(false);
          setConnection(null);
          setInitialChatsLoaded(true);
        }
        return;
      }
      if (cancelled) return;

      unbindHandlers = bindConnectionHandlers(conn);
      connectionRef.current = conn;
      setConnection(conn);
      setIsConnected(conn.state === HubConnectionState.Connected);

      if (subscribeReconnecting) {
        unsubscribers.push(subscribeReconnecting(() => {
          if (!cancelled) setIsConnected(false);
        }));
      }
      if (subscribeClosed) {
        unsubscribers.push(subscribeClosed(() => {
          if (!cancelled) setIsConnected(false);
        }));
      }
      if (subscribeReconnected) {
        unsubscribers.push(subscribeReconnected(() => {
          if (cancelled) return;
          setIsConnected(true);
          void reloadChats(connectionRef.current, 'reconnect');
        }));
      }

      await reloadChats(conn, 'initial');
    };

    void attachToSharedConnection();

    return () => {
      cancelled = true;
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      if (unbindHandlers) {
        unbindHandlers();
        unbindHandlers = null;
      }
      connectionRef.current = null;
      setConnection(null);
      setIsConnected(false);
    };
  }, [userId, bindConnectionHandlers, getSharedConnection, subscribeReconnected, subscribeReconnecting, subscribeClosed]);

  useEffect(() => {
    const currentUserId = resolveCurrentUserId(userId);
    if (!currentUserId) return undefined;

    let cancelled = false;

    setChats((prev) => {
      if (!prev.some(needsChatListE2eDecrypt)) {
        return prev;
      }

      void decryptChatListItems(prev, currentUserId).then((decrypted) => {
        if (!cancelled) {
          setChats(sortChats(decrypted));
        }
      });

      return prev;
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const handleProfileUpdated = (event) => {
      const patch = event.detail;
      if (!patch?.userId) {
        return;
      }

      setChats((prevChats) =>
        sortChats(prevChats.map((chat) => patchChatListItemWithProfile(chat, patch))),
      );
    };

    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
  }, []);

  const refreshChats = useCallback(async () => {
    if (!connectionRef.current || connectionRef.current.state !== HubConnectionState.Connected) {
      return;
    }

    try {
      await connectionRef.current.invoke('GetUserChats');
    } catch (err) {
      console.error('Error refreshing chats:', err);
    }
  }, []);

  const searchUsers = useCallback(async (query) => {
    if (!query.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    if (connectionRef.current?.state === HubConnectionState.Connected) {
      try {
        await connectionRef.current.invoke('SearchUsers', query.trim());
      } catch (error) {
        console.error('Error searching users:', error);
      }
    } else {
      setIsSearching(false);
    }
  }, []);

  const createPrivateChat = useCallback(async (targetUserId) => {
    if (connectionRef.current?.state !== HubConnectionState.Connected) {
      return undefined;
    }

    try {
      const existingChat = chats.find(
        (chat) => !chat.isGroupChat && String(chat.userId) === String(targetUserId),
      );

      if (existingChat) {
        if (onChatCreatedRef.current && existingChat.chatId) {
          onChatCreatedRef.current(existingChat.chatId);
        }
        return existingChat;
      }

      const targetUserIdGuid = typeof targetUserId === 'string' ? targetUserId : targetUserId.toString();
      await connectionRef.current.invoke('CreatePrivateChat', targetUserIdGuid);
    } catch (error) {
      console.error('Error creating private chat:', error);
      throw error;
    }

    return undefined;
  }, [chats]);

  const createGroupChat = useCallback(async () => {
    throw new Error('Group chat creation not implemented yet');
  }, []);

  const setChatPinned = useCallback(async (chatId, isPinned) => {
    if (!connectionRef.current || connectionRef.current.state !== HubConnectionState.Connected) {
      return false;
    }

    try {
      await connectionRef.current.invoke(isPinned ? 'PinChat' : 'UnpinChat', chatId);
      return true;
    } catch (error) {
      console.error('Error setting chat pin:', error);
      return false;
    }
  }, []);

  const pinChat = useCallback(async (chatId) => setChatPinned(chatId, true), [setChatPinned]);
  const unpinChat = useCallback(async (chatId) => setChatPinned(chatId, false), [setChatPinned]);

  const reorderPinnedChats = useCallback(async (orderedChatIds) => {
    if (!connectionRef.current || connectionRef.current.state !== HubConnectionState.Connected) {
      return false;
    }

    if (!Array.isArray(orderedChatIds) || orderedChatIds.length === 0) {
      return true;
    }

    setChats((prevChats) => applyPinnedChatOrder(prevChats, orderedChatIds));

    try {
      await connectionRef.current.invoke('ReorderPinnedChats', orderedChatIds);
      return true;
    } catch (error) {
      console.error('Error reordering pinned chats:', error);
      try {
        await connectionRef.current.invoke('GetUserChats');
      } catch (refreshError) {
        console.error('Error refreshing chats after reorder failure:', refreshError);
      }
      return false;
    }
  }, []);

  const unreadCountByChat = useMemo(() => {
    return chats.reduce((acc, chat) => {
      const chatId = chat.chatId || chat.chat_id;
      if (!chatId) return acc;
      acc[chatId] = normalizeUnreadCount(chat);
      return acc;
    }, {});
  }, [chats, normalizeUnreadCount]);

  return {
    chats,
    initialChatsLoaded,
    refreshChats,
    unreadCountByChat,
    searchResults,
    isSearching,
    isLoading,
    isConnected,
    searchUsers,
    createPrivateChat,
    createGroupChat,
    pinChat,
    unpinChat,
    reorderPinnedChats,
  };
};
