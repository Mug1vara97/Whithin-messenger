import React, { useState, useCallback, memo } from 'react';
import { useLocation } from 'react-router-dom';
import { People } from '@mui/icons-material';
import { SearchBar, UserAvatar, CreateGroupChatModal, UserPanel } from '../../../shared/ui';
import { useChatList } from '../../../entities/chat';
import { useAuthContext } from '../../../shared/lib/contexts/AuthContext';
import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import './ChatList.css';

const ChatList = ({ onChatSelected, onFriendsSelected }) => {
  const { user } = useAuthContext();
  const location = useLocation();
  const [selectedChat, setSelectedChat] = useState(null);
  const [showModal, setShowModal] = useState(false);
  
  
  const {
    chats,
    searchResults,
    isSearching,
    isLoading,
    searchUsers,
    createPrivateChat
  } = useChatList(user?.id);

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
      // После создания группового чата обновляем список чатов
      // и выбираем созданный чат
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
            chats.map((chat, index) => (
              <li
                key={`${chat.chatId}-${chat.lastMessageTime}-${index}`}
                className={`chat-item ${selectedChat?.chatId === chat.chatId ? 'active' : ''}`}
                onClick={() => handleChatSelection(chat)}
              >
                <div className="chat-avatar-container">
                  <div 
                    className="chat-avatar" 
                    style={{
                      backgroundColor: chat.avatarUrl ? 'transparent' : (chat.avatarColor || '#5865F2'),
                      backgroundImage: chat.avatarUrl?.startsWith('/uploads/') 
                        ? `url(${BASE_URL}${chat.avatarUrl})` 
                        : (chat.avatarUrl?.startsWith('http') ? `url(${chat.avatarUrl})` : 'none'),
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  >
                    {!chat.avatarUrl && (
                      <span style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>
                        {chat.isGroupChat ? 'G' : (chat.username ? chat.username.charAt(0).toUpperCase() : 'U')}
                      </span>
                    )}
                  </div>
                  <div className="status-indicator"></div>
                </div>
                <div className="chat-info">
                  <div className="chat-name">
                    {chat.username}
                  </div>
                  {chat.isGroupChat && <div className="group-indicator">(Group)</div>}
                </div>
              </li>
            ))
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
                      size="32px"
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
          isMuted={false}
          isAudioEnabled={true}
          onToggleMute={() => {}}
          onToggleAudio={() => {}}
        />
      </div>
    </div>
  );
};

export default memo(ChatList);
