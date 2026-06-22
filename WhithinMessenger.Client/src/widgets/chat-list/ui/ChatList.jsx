import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import React, { useState, useCallback, memo, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { People, BookmarkBorder, PushPin } from '@mui/icons-material';
import { SearchBar, UserAvatar, UserAvatarPresenceDot, CreateGroupChatModal, UserPanel } from '../../../shared/ui';
import ContextMenu from '../../../shared/ui/molecules/ContextMenu/ContextMenu';
import { useChatList } from '../../../entities/chat';
import { useAuthContext } from '../../../shared/lib/contexts/AuthContext';
import { useConnectionContext } from '../../../shared/lib/contexts/ConnectionContext';
import { useProfileModal } from '../../../shared/lib/contexts/ProfileModalContext';
import { useNotificationContext } from '../../../shared/lib/contexts/NotificationContext';
import { useServerContext } from '../../../shared/lib/contexts/useServerContext';
import { useFriends } from '../../../entities/friend/hooks/useFriends';
import { useFriendRequests } from '../../../entities/friend/hooks/useFriendRequests';
import { formatChatListLastMessage } from '../../../shared/lib/utils/formatChatListLastMessage';
import { formatChatListMessageTime } from '../../../shared/lib/utils/formatChatListMessageTime';
import { buildChatListContextMenuItems } from '../../../shared/lib/utils/buildChatListContextMenuItems';
import { getFriendActionForMember } from '../../../shared/lib/utils/friendActionForMember';
import { inviteUserToServer } from '../../../shared/lib/utils/inviteUserToServer';
import './ChatList.css';

const ChatList = ({
  onChatSelected,
  onFriendsSelected,
  unreadCountByChat = {},
  chats: chatsProp,
  searchResults: searchResultsProp,
  isSearching: isSearchingProp,
  isLoading: isLoadingProp,
  searchUsers: searchUsersProp,
  createPrivateChat: createPrivateChatProp,
  pinChat: pinChatProp,
  unpinChat: unpinChatProp,
  reorderPinnedChats: reorderPinnedChatsProp,
}) => {
  const { user } = useAuthContext();
  const { getConnection } = useConnectionContext();
  const { openProfile } = useProfileModal();
  const { markChatAsRead } = useNotificationContext();
  const { servers } = useServerContext();
  const { friends, fetchFriends, removeFriend } = useFriends();
  const { pendingRequests, sentRequests } = useFriendRequests();
  const location = useLocation();
  const [selectedChat, setSelectedChat] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [statusOverrides, setStatusOverrides] = useState({});
  const [chatContextMenu, setChatContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    chat: null,
  });
  const notificationConnectionRef = useRef(null);

  const useParentChatList = chatsProp !== undefined;
  const internalChatList = useChatList(useParentChatList ? null : user?.id);

  const chats = useParentChatList ? chatsProp : internalChatList.chats;
  const searchResults = useParentChatList ? (searchResultsProp ?? []) : internalChatList.searchResults;
  const isSearching = useParentChatList ? Boolean(isSearchingProp) : internalChatList.isSearching;
  const isLoading = useParentChatList ? Boolean(isLoadingProp) : internalChatList.isLoading;
  const searchUsers = useParentChatList ? (searchUsersProp ?? (() => {})) : internalChatList.searchUsers;
  const createPrivateChat = useParentChatList
    ? (createPrivateChatProp ?? (async () => {}))
    : internalChatList.createPrivateChat;
  const pinChat = useParentChatList
    ? (pinChatProp ?? (async () => false))
    : internalChatList.pinChat;
  const unpinChat = useParentChatList
    ? (unpinChatProp ?? (async () => false))
    : internalChatList.unpinChat;
  const reorderPinnedChats = useParentChatList
    ? (reorderPinnedChatsProp ?? (async () => false))
    : internalChatList.reorderPinnedChats;

  const chatSections = useMemo(() => {
    const savedChats = [];
    const pinnedChats = [];
    const unpinnedChats = [];

    (chats || []).forEach((chat) => {
      if (Boolean(chat.isSavedMessages ?? chat.IsSavedMessages)) {
        savedChats.push(chat);
        return;
      }

      if (Boolean(chat.isPinned ?? chat.IsPinned)) {
        pinnedChats.push(chat);
        return;
      }

      unpinnedChats.push(chat);
    });

    pinnedChats.sort((a, b) => {
      const orderA = a.pinOrder ?? a.PinOrder;
      const orderB = b.pinOrder ?? b.PinOrder;
      const resolvedA = orderA == null ? Number.MAX_SAFE_INTEGER : Number(orderA);
      const resolvedB = orderB == null ? Number.MAX_SAFE_INTEGER : Number(orderB);
      if (resolvedA !== resolvedB) return resolvedA - resolvedB;

      const pinnedAtA = new Date(a.pinnedAt ?? a.PinnedAt ?? 0).getTime();
      const pinnedAtB = new Date(b.pinnedAt ?? b.PinnedAt ?? 0).getTime();
      return pinnedAtA - pinnedAtB;
    });

    unpinnedChats.sort((a, b) => {
      const timeA = new Date(a.lastMessageTime ?? a.LastMessageTime ?? 0).getTime();
      const timeB = new Date(b.lastMessageTime ?? b.LastMessageTime ?? 0).getTime();
      return timeB - timeA;
    });

    return { savedChats, pinnedChats, unpinnedChats };
  }, [chats]);

  const skipNextChatClickRef = useRef(false);

  const handleSearchChange = useCallback((query) => {
    searchUsers(query);
  }, [searchUsers]);

  const handleChatSelection = useCallback((chat) => {
    if (skipNextChatClickRef.current) {
      skipNextChatClickRef.current = false;
      return;
    }

    if (chat) {
      setSelectedChat(chat);
      if (onChatSelected) {
        onChatSelected(chat);
      }
    }
  }, [onChatSelected]);

  const handlePrivateMessage = useCallback(async (user) => {
    try {
      const chat = await createPrivateChat(user.userId || user.id);
      if (chat) {
        handleChatSelection(chat);
      }
    } catch (error) {
      console.error('Error creating private chat:', error);
      alert('Ошибка при создании чата');
    }
  }, [createPrivateChat, handleChatSelection]);

  const handleCreateGroupChat = useCallback(async (chatId) => {
    try {
      const newChat = {
        chatId: chatId,
        username: 'Новый групповой чат',
        isGroupChat: true,
        lastMessageTime: Date.now()
      };
      handleChatSelection(newChat);
      setShowModal(false);
    } catch (error) {
      console.error('Error creating group chat:', error);
      alert(error.message || 'Ошибка при создании группового чата');
    }
  }, [handleChatSelection]);

  const handleShowModal = useCallback(() => {
    setShowModal(true);
  }, []);

  useEffect(() => {
    if (!user?.id || !getConnection) return undefined;
    let mounted = true;

    const setupPresenceRealtime = async () => {
      try {
        const notificationConnection = await getConnection('notificationhub', user.id);
        if (!mounted) return;
        notificationConnectionRef.current = notificationConnection;

        const onUserStatusChanged = (payload) => {
          const changedUserId = payload?.userId ?? payload?.UserId;
          const changedStatus = payload?.status ?? payload?.Status;
          if (!changedUserId || !changedStatus) return;

          setStatusOverrides((prev) => ({
            ...prev,
            [String(changedUserId)]: changedStatus
          }));
        };

        notificationConnection.on('UserStatusChanged', onUserStatusChanged);
      } catch (error) {
        console.error('Failed to subscribe chat-list presence updates:', error);
      }
    };

    setupPresenceRealtime();

    return () => {
      mounted = false;
      if (notificationConnectionRef.current) {
        notificationConnectionRef.current.off('UserStatusChanged');
      }
    };
  }, [user?.id, getConnection]);

  const getChatPresenceStatus = useCallback(
    (chat) => {
      if (chat.isGroupChat) {
        return null;
      }

      const userIdKey = String(chat.userId ?? chat.UserId ?? '');
      if (!userIdKey) {
        return chat.userStatus ?? chat.UserStatus ?? null;
      }

      return statusOverrides[userIdKey] ?? chat.userStatus ?? chat.UserStatus ?? null;
    },
    [statusOverrides]
  );

  const closeChatContextMenu = useCallback(() => {
    setChatContextMenu({ visible: false, x: 0, y: 0, chat: null });
  }, []);

  const handleCopyText = useCallback(async (value, errorMessage) => {
    try {
      await navigator.clipboard.writeText(String(value));
    } catch {
      alert(errorMessage);
    }
  }, []);

  const chatContextMenuItems = useMemo(() => {
    const chat = chatContextMenu.chat;
    if (!chat) return [];

    const chatId = chat.chatId ?? chat.chat_id;
    const targetUserId = chat.userId ?? chat.UserId;
    const targetUsername = chat.username || chat.Username || 'пользователя';
    const unreadForChat = unreadCountByChat[chatId] || unreadCountByChat[chat.chat_id] || 0;
    const isPinned = Boolean(chat.isPinned ?? chat.IsPinned);
    const friendAction = getFriendActionForMember(targetUserId, {
      userId: user?.id,
      friends,
      pendingRequests,
      sentRequests,
    });

    return buildChatListContextMenuItems({
      chat,
      chatId,
      targetUserId,
      targetUsername,
      hasUnread: unreadForChat > 0,
      isPinned,
      friendAction,
      servers: servers || [],
      handlers: {
        onMarkAsRead: unreadForChat > 0
          ? () => markChatAsRead(chatId)
          : undefined,
        onPin: chatId ? () => { void pinChat(chatId); } : undefined,
        onUnpin: chatId ? () => { void unpinChat(chatId); } : undefined,
        onProfile: targetUserId
          ? () => openProfile(targetUserId, targetUsername, getChatPresenceStatus(chat))
          : undefined,
        onStartCall: () => handleChatSelection(chat),
        onInviteToServer: (serverId) => {
          void inviteUserToServer(serverId, targetUserId)
            .then(() => alert('Пользователь приглашён на сервер'))
            .catch((error) => alert(error?.message || 'Не удалось пригласить на сервер'));
        },
        onRemoveFriend: friendAction?.kind === 'friend'
          ? () => {
              void removeFriend(targetUserId).then(() => fetchFriends());
            }
          : undefined,
        onIgnore: () => alert('Игнорирование пока не реализовано'),
        onBlock: () => alert('Блокировка пока не реализована'),
        onMute: () => alert('Заглушение пока не реализовано'),
        onCopyUserId: targetUserId
          ? () => handleCopyText(targetUserId, 'Не удалось скопировать ID пользователя')
          : undefined,
        onCopyChannelId: chatId
          ? () => handleCopyText(chatId, 'Не удалось скопировать ID канала')
          : undefined,
      },
    });
  }, [
    chatContextMenu.chat,
    unreadCountByChat,
    user?.id,
    friends,
    pendingRequests,
    sentRequests,
    servers,
    markChatAsRead,
    openProfile,
    getChatPresenceStatus,
    handleChatSelection,
    removeFriend,
    fetchFriends,
    handleCopyText,
    pinChat,
    unpinChat,
  ]);

  const handleChatContextMenu = useCallback((event, chat) => {
    const isSavedMessages = Boolean(chat.isSavedMessages ?? chat.IsSavedMessages);
    if (isSavedMessages) return;

    event.preventDefault();
    event.stopPropagation();
    setChatContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      chat,
    });
  }, []);

  const renderChatItem = useCallback((chat, dragProps = null) => {
    const { provided, snapshot } = dragProps || {};
    const chatId = chat.chatId ?? chat.chat_id;
    const unreadForChat = unreadCountByChat[chatId] || unreadCountByChat[chat.chat_id] || 0;
    const chatPresenceStatus = getChatPresenceStatus(chat);
    const hasUnread = unreadForChat > 0;
    const lastMessageRaw = chat.lastMessage ?? chat.LastMessage ?? '';
    const lastMessagePreview = formatChatListLastMessage(lastMessageRaw);
    const lastMessageTimeLabel = formatChatListMessageTime(
      chat.lastMessageTime ?? chat.LastMessageTime,
    );
    const isSavedMessages = Boolean(chat.isSavedMessages ?? chat.IsSavedMessages);
    const isPinned = Boolean(chat.isPinned ?? chat.IsPinned);
    const subtitle = lastMessagePreview
      ?? (isSavedMessages ? 'Сохранённые сообщения' : (chat.isGroupChat ? 'Групповой чат' : null));

    return (
      <div
        ref={provided?.innerRef}
        {...(provided?.draggableProps || {})}
        {...(provided?.dragHandleProps || {})}
        style={provided?.draggableProps?.style}
        key={chatId}
        className={`chat-item ${selectedChat?.chatId === chatId ? 'active' : ''} ${hasUnread ? 'has-unread' : ''} ${isSavedMessages ? 'chat-item--saved' : ''} ${isPinned ? 'chat-item--pinned' : ''} ${snapshot?.isDragging ? 'chat-item--dragging' : ''}`}
        onClick={() => handleChatSelection(chat)}
        onContextMenu={(event) => handleChatContextMenu(event, chat)}
      >
        <div className="user-avatar-slot chat-avatar-wrap">
          {isSavedMessages ? (
            <div className="chat-avatar chat-avatar--saved">
              <BookmarkBorder fontSize="small" />
            </div>
          ) : (
            <UserAvatar
              username={
                chat.isGroupChat && !chat.avatarUrl
                  ? 'G'
                  : chat.username
              }
              avatarUrl={chat.avatarUrl}
              avatarColor={chat.avatarColor || '#5865F2'}
              avatarDecoration={chat.isGroupChat ? null : chat.avatarDecoration}
              size={40}
              statusIndicator={
                !chat.isGroupChat ? (
                  <UserAvatarPresenceDot status={chatPresenceStatus} />
                ) : null
              }
            />
          )}
        </div>
        <div className="chat-info">
          <div className="chat-name-row">
            <div className="chat-name">
              {chat.username}
              {isPinned && !isSavedMessages && (
                <PushPin className="chat-pin-indicator" fontSize="inherit" titleAccess="Закреплено" />
              )}
            </div>
            {lastMessageTimeLabel && (
              <div className="chat-last-time">{lastMessageTimeLabel}</div>
            )}
          </div>
          {subtitle && <div className="chat-last-message">{subtitle}</div>}
        </div>
        {unreadForChat > 0 && (
          <div className="chat-unread-badge">
            {unreadForChat > 99 ? '99+' : unreadForChat}
          </div>
        )}
      </div>
    );
  }, [
    unreadCountByChat,
    getChatPresenceStatus,
    selectedChat?.chatId,
    handleChatSelection,
    handleChatContextMenu,
  ]);

  const handlePinnedDragStart = useCallback(() => {
    skipNextChatClickRef.current = false;
  }, []);

  const handlePinnedDragEnd = useCallback((result) => {
    if (!result.destination || result.source.droppableId !== 'pinned-chats') {
      return;
    }

    if (result.source.index === result.destination.index) {
      return;
    }

    if (result.reason === 'DROP') {
      skipNextChatClickRef.current = true;
      window.setTimeout(() => {
        skipNextChatClickRef.current = false;
      }, 250);
    }

    const items = Array.from(chatSections.pinnedChats);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);

    const orderedIds = items
      .map((chat) => chat.chatId ?? chat.chat_id)
      .filter(Boolean);

    void reorderPinnedChats(orderedIds);
  }, [chatSections.pinnedChats, reorderPinnedChats]);


  const renderChatList = () => {
    const { savedChats, pinnedChats, unpinnedChats } = chatSections;
    const hasAnyChats = savedChats.length + pinnedChats.length + unpinnedChats.length > 0;

    return (
      <div className="chat-list-container">
        <div className="friends-section">
          <button 
            className={`friends-button ${location.pathname === '/channels/@me/friends' ? 'active' : ''}`}
            onClick={onFriendsSelected}
            title="Друзья"
          >
            <div className="friends-button__icon">
              <People />
            </div>
            <span className="friends-button__text">Друзья</span>
          </button>
        </div>
        
        <div className="chat-list-header">
          <h3>Личные сообщения</h3>
          <div className="chat-list-header-actions">
            <button 
              className="add-chat-button" 
              onClick={handleShowModal}
              title="Создать групповой чат"
            >
              +
            </button>
          </div>
        </div>
        <DragDropContext onDragStart={handlePinnedDragStart} onDragEnd={handlePinnedDragEnd}>
          <div className="chat-list-scroll">
            {hasAnyChats ? (
              <>
                {savedChats.length > 0 && (
                  <div className="chat-list">
                    {savedChats.map((chat) => renderChatItem(chat))}
                  </div>
                )}
                {pinnedChats.length > 0 && (
                  <Droppable droppableId="pinned-chats">
                    {(dropProvided, dropSnapshot) => (
                      <div
                        ref={dropProvided.innerRef}
                        {...dropProvided.droppableProps}
                        className={`chat-list chat-list--pinned ${dropSnapshot.isDraggingOver ? 'chat-list--pinned-active' : ''}`}
                      >
                        {pinnedChats.map((chat, index) => {
                          const chatId = chat.chatId ?? chat.chat_id;
                          return (
                            <Draggable
                              key={String(chatId)}
                              draggableId={`pinned-${chatId}`}
                              index={index}
                            >
                              {(dragProvided, dragSnapshot) => renderChatItem(chat, {
                                provided: dragProvided,
                                snapshot: dragSnapshot,
                              })}
                            </Draggable>
                          );
                        })}
                        {dropProvided.placeholder}
                      </div>
                    )}
                  </Droppable>
                )}
                {unpinnedChats.length > 0 && (
                  <div className="chat-list">
                    {unpinnedChats.map((chat) => renderChatItem(chat))}
                  </div>
                )}
              </>
            ) : (
              <div className="chat-list">
                <div className="no-chats">
                  <p>Нет чатов</p>
                </div>
              </div>
            )}
          </div>
        </DragDropContext>
      </div>
    );
  };

  const renderSearchResults = () => {
    return (
      <div className="search-results-container">
        <h3>Результаты поиска</h3>
        <ul>
          {searchResults.length > 0 ? (
            searchResults.map(user => (
              <li 
                key={user.userId || user.id} 
                className="search-result-item"
                onClick={() => handlePrivateMessage(user)}
              >
                <div className="search-result-content">
                  <div className="search-result-avatar">
                    <UserAvatar
                      username={user.username}
                      avatarUrl={user.avatarUrl}
                      avatarColor={user.avatarColor}
                      avatarDecoration={user.avatarDecoration}
                      size={32}
                    />
                  </div>
                  <div className="search-result-info">
                    <div className="search-result-username">
                      {user.username}
                    </div>
                  </div>
                </div>
              </li>
            ))
          ) : (
            <li className="no-results">
              <p>Пользователи не найдены</p>
            </li>
          )}
        </ul>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="chat-list-container">
        <div className="chat-sidebar">
          <div className="loading">Загрузка чатов...</div>
        </div>
      </div>
    );
  }


  return (
    <div className="chat-list-wrapper">
      <div className="chat-sidebar">
        <div className="chat-sidebar-main">
          <SearchBar onSearchChange={handleSearchChange} />
          {isSearching ? renderSearchResults() : renderChatList()}
          {showModal && (
            <CreateGroupChatModal
              isOpen={showModal}
              onClose={() => setShowModal(false)}
              onChatCreated={handleCreateGroupChat}
            />
          )}
        </div>
        <UserPanel
          userId={user?.id || user?.userId || user?.Id}
          username={user?.username || user?.UserName || user?.userName}
          isOpen={true}
        />
      </div>
      <ContextMenu
        isOpen={chatContextMenu.visible}
        position={{ x: chatContextMenu.x, y: chatContextMenu.y }}
        onClose={closeChatContextMenu}
        items={chatContextMenuItems}
      />
    </div>
  );
};

export default memo(ChatList);
