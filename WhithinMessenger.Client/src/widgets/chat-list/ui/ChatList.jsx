import React, { useState, useCallback, memo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { People, BookmarkBorder } from '@mui/icons-material';
import { SearchBar, UserAvatar, CreateGroupChatModal, UserPanel } from '../../../shared/ui';
import { useChatList } from '../../../entities/chat';
import { useAuthContext } from '../../../shared/lib/contexts/AuthContext';
import { useConnectionContext } from '../../../shared/lib/contexts/ConnectionContext';
import { getUserStatusColor, getUserStatusLabel } from '../../../shared/lib/utils/userStatus';
import { formatChatListLastMessage } from '../../../shared/lib/utils/formatChatListLastMessage';
import { formatChatListMessageTime } from '../../../shared/lib/utils/formatChatListMessageTime';
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
}) => {
  const { user } = useAuthContext();
  const { getConnection } = useConnectionContext();
  const location = useLocation();
  const [selectedChat, setSelectedChat] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [statusOverrides, setStatusOverrides] = useState({});
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

  const handleSearchChange = useCallback((query) => {
    searchUsers(query);
  }, [searchUsers]);

  const handleChatSelection = useCallback((chat) => {
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


  const renderChatList = () => {
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
        <ul className="chat-list">
          {chats && chats.length > 0 ? (
            chats.map((chat, index) => {
              const unreadForChat = unreadCountByChat[chat.chatId] || unreadCountByChat[chat.chat_id] || 0;
              const chatPresenceStatus = getChatPresenceStatus(chat);
              const hasUnread = unreadForChat > 0;
              const lastMessageRaw = chat.lastMessage ?? chat.LastMessage ?? '';
              const lastMessagePreview = formatChatListLastMessage(lastMessageRaw);
              const lastMessageTimeLabel = formatChatListMessageTime(
                chat.lastMessageTime ?? chat.LastMessageTime
              );
              const isSavedMessages = Boolean(chat.isSavedMessages ?? chat.IsSavedMessages);
              const subtitle = lastMessagePreview
                ?? (isSavedMessages ? 'Сохранённые сообщения' : (chat.isGroupChat ? 'Групповой чат' : null));

              return (
              <li
                key={`${chat.chatId}-${chat.lastMessageTime}-${index}`}
                className={`chat-item ${selectedChat?.chatId === chat.chatId ? 'active' : ''} ${hasUnread ? 'has-unread' : ''} ${isSavedMessages ? 'chat-item--saved' : ''}`}
                onClick={() => handleChatSelection(chat)}
              >
                <div className="chat-avatar-wrap">
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
                          <span
                            className="user-avatar-presence-dot"
                            style={{ backgroundColor: getUserStatusColor(chatPresenceStatus) }}
                            title={getUserStatusLabel(chatPresenceStatus)}
                          />
                        ) : null
                      }
                    />
                  )}
                </div>
                <div className="chat-info">
                  <div className="chat-name-row">
                    <div className="chat-name">
                      {chat.username}
                    </div>
                    {lastMessageTimeLabel && (
                      <div className="chat-last-time">
                        {lastMessageTimeLabel}
                      </div>
                    )}
                  </div>
                  {subtitle && (
                    <div className="chat-last-message">
                      {subtitle}
                    </div>
                  )}
                </div>
                {unreadForChat > 0 && (
                  <div className="chat-unread-badge">
                    {unreadForChat > 99 ? '99+' : unreadForChat}
                  </div>
                )}
              </li>
              );
            })
          ) : (
            <div className="no-chats">
              <p>Нет чатов</p>
            </div>
          )}
        </ul>
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
        <SearchBar onSearchChange={handleSearchChange} />
        {isSearching ? renderSearchResults() : renderChatList()}
        {showModal && (
          <CreateGroupChatModal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            onChatCreated={handleCreateGroupChat}
          />
        )}
        <UserPanel
          userId={user?.id}
          username={user?.username || user?.userName}
          isOpen={true}
        />
      </div>
    </div>
  );
};

export default memo(ChatList);
