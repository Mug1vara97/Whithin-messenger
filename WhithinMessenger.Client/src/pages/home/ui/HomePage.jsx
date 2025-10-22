import React, { useState, useEffect, useCallback, memo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChatList } from '../../../widgets/chat-list';
import { ServerList } from '../../../widgets/server-list';
import { ServerDiscovery } from '../../../widgets/server-discovery';
import { ChatRoom } from '../../../widgets/chat-room';
import { ServerPanel } from '../../../widgets/server-panel';
import { FriendsPanel } from '../../../widgets/friends-panel';
import { VoiceCallView } from '../../../widgets/voice-call';
import MinimizedCallWidget from '../../../widgets/voice-call/ui/MinimizedCallWidget';
import { useServer } from '../../../entities/server/hooks';
import { useChatList } from '../../../entities/chat';
import { useAuthContext } from '../../../shared/lib/contexts/AuthContext';
import { useServerContext } from '../../../shared/lib/contexts/useServerContext';
import { SettingsModal } from '../../../shared/ui/organisms';
import useVoiceCallStore from '../../../shared/lib/stores/voiceCallStore';
import './HomePage.css';

const HomePage = () => {
  const { serverId, channelId, chatId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthContext();
  
  // Состояние минимизированного звонка
  const { isInCall, isCallMinimized, currentRoomId } = useVoiceCallStore();
  
  const [selectedChat, setSelectedChat] = useState(null);
  const [selectedServer, setSelectedServer] = useState(null);
  const [serverDataFromPanel, setServerDataFromPanel] = useState(null);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [showCreateServerModal, setShowCreateServerModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  
  const showFriends = location.pathname === '/channels/@me/friends';

  const { server: serverData, accessDenied: serverAccessDenied } = useServer(serverId);
  const { chats, createPrivateChat } = useChatList(user?.id || null, (chatId) => {
    navigate(`/channels/@me/${chatId}`);
  });
  const { createServer, servers, createConnection } = useServerContext();

  React.useEffect(() => {
    if (user?.id) {
      console.log('HomePage: Creating server connection for user:', user.id);
      createConnection(user.id);
    }
  }, [user?.id, createConnection]);

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
      console.log('HomePage: serverData updated, current selectedChat:', selectedChat);
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
  }, [selectedServer, servers, serverId, navigate, selectedChat]);

  useEffect(() => {
    if (serverId && channelId) {
      const currentServerData = serverDataFromPanel || serverData;
      
      if (currentServerData) {
        const foundChannel = currentServerData.categories
          ?.flatMap(category => category.chats || category.Chats || [])
          .find(chat => (chat.chatId || chat.ChatId || chat.chat_id) === channelId);
        
        console.log('All channels in server:', currentServerData.categories?.flatMap(category => category.chats || category.Chats || []));
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
          
          // Не вызываем joinCall автоматически - пусть VoiceCallView сам подключится
          
        } else {
          console.log('HomePage: Channel not found, setting selectedChat to null');
          setSelectedChat(null);
          navigate(`/server/${serverId}`, { replace: true });
        }
      }
    }
  }, [serverId, channelId, serverData, serverDataFromPanel, navigate]);

  useEffect(() => {
    if (chatId && chats && chats.length > 0) {

      const foundChat = chats.find(chat => (chat.chatId || chat.chat_id) === chatId);
      
      if (foundChat) {
        setSelectedChat(foundChat);
        setSelectedServer(null);
        
      } else {
        setSelectedChat(null);
        setSelectedServer(null);
        navigate('/', { replace: true });
      }
    } else if (chatId && chats && chats.length === 0) {
      setSelectedChat(null);
      setSelectedServer(null);
      navigate('/', { replace: true });
    }
  }, [chatId, chats, navigate]);

  const handleChatSelected = (chat) => {
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

  const handleServerDataUpdated = (updatedServerData) => {
    console.log('HomePage: Server data updated from ServerPanel:', updatedServerData);
    setServerDataFromPanel(updatedServerData);
  };

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
    navigate('/channels/@me/friends');
  }, [navigate]);

  const handleCreateServerClick = useCallback(() => {
    setShowCreateServerModal(true);
  }, []);

  const handleCreateServer = useCallback(async (serverData) => {
    try {
      await createServer(serverData);
      setShowCreateServerModal(false);
    } catch (error) {
      console.error('Error creating server:', error);
      alert('Ошибка при создании сервера: ' + error.message);
    }
  }, [createServer]);

  const handleCloseCreateServerModal = useCallback(() => {
    setShowCreateServerModal(false);
  }, []);

  const handleSettingsClick = useCallback(() => {
    setShowSettingsModal(true);
  }, []);

  const handleCloseSettingsModal = useCallback(() => {
    setShowSettingsModal(false);
  }, []);

  const handleNotificationsClick = useCallback(() => {
    setShowNotificationsModal(true);
  }, []);

  const handleCloseNotificationsModal = useCallback(() => {
    setShowNotificationsModal(false);
  }, []);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (showCreateServerModal) {
          setShowCreateServerModal(false);
        } else if (showSettingsModal) {
          setShowSettingsModal(false);
        } else if (showNotificationsModal) {
          setShowNotificationsModal(false);
        }
      }
    };

    if (showCreateServerModal || showSettingsModal || showNotificationsModal) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showCreateServerModal, showSettingsModal, showNotificationsModal]);

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
            onNotificationsClick={handleNotificationsClick}
            userId={user?.id}
          />
          <div className="content-area">
            {selectedServer ? (
              <ServerPanel 
                selectedServer={selectedServer}
                onChatSelected={handleChatSelected}
                selectedChat={selectedChat}
                onServerDataUpdated={handleServerDataUpdated}
              />
            ) : (
              <ChatList 
                onChatSelected={handleChatSelected}
                onFriendsSelected={handleFriendsSelected}
                selectedChatId={selectedChat?.chatId || selectedChat?.chat_id}
              />
            )}
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
                  {/* Check if it's a voice channel - но не показываем VoiceCallView здесь */}
                  {(selectedChat.chatType === 4 || 
                    selectedChat.typeId === 4 || 
                    selectedChat.TypeId === 4 ||
                    selectedChat.typeId === "44444444-4444-4444-4444-444444444444") ? (
                    <div className="voice-channel-placeholder">
                      <h3>Голосовой канал: {selectedChat.groupName || selectedChat.name || selectedChat.Name || selectedChat.username}</h3>
                      <p>Звонок активен. Используйте минимизированный виджет для управления.</p>
                    </div>
                  ) : (
                    <ChatRoom
                      chatId={selectedChat.chatId || selectedChat.chat_id}
                      groupName={selectedChat.groupName || selectedChat.username}
                      isGroupChat={selectedChat.isGroupChat}
                      isServerChat={selectedServer ? true : false}
                      chatTypeId={selectedChat.chatTypeId}
                      userId={user?.id}
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

      {/* Минимизированный звонок - отображается когда звонок активен но минимизирован */}
      {isInCall && isCallMinimized && <MinimizedCallWidget />}
      
      {/* Полный интерфейс звонка - отображается когда звонок активен и не минимизирован */}
      {isInCall && !isCallMinimized && (
        <VoiceCallView
          channelId={currentRoomId}
          channelName="Голосовой канал"
          userId={user?.id}
          userName={user?.username}
        />
      )}
      
      {/* Голосовой канал - отображается когда выбран голосовой канал но звонок не активен */}
      {selectedChat && (selectedChat.chatType === 4 || selectedChat.typeId === 4 || selectedChat.TypeId === 4 || selectedChat.typeId === "44444444-4444-4444-4444-444444444444") && !isInCall && (
        <VoiceCallView
          channelId={selectedChat.chatId || selectedChat.chat_id}
          channelName={selectedChat.groupName || selectedChat.name || selectedChat.Name || selectedChat.username}
          userId={user?.id}
          userName={user?.username}
        />
      )}

      {showCreateServerModal && (
        <div 
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseCreateServerModal();
            }
          }}
        >
          <div className="create-modal">
            <div className="modal-header">
              <h3>Создать новый сервер</h3>
              <button 
                className="modal-close-button"
                onClick={handleCloseCreateServerModal}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <CreateServerForm
              onClose={handleCloseCreateServerModal}
              onCreate={handleCreateServer}
            />
          </div>
        </div>
      )}

      <SettingsModal 
        isOpen={showSettingsModal} 
        onClose={handleCloseSettingsModal} 
      />

      {showNotificationsModal && (
        <div 
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseNotificationsModal();
            }
          }}
        >
          <div className="notifications-modal">
            <div className="modal-header">
              <h3>Уведомления</h3>
              <button 
                className="modal-close-button"
                onClick={handleCloseNotificationsModal}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="notifications-content">
              <p>Нет новых уведомлений</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CreateServerForm = ({ onClose, onCreate }) => {
  const [serverName, setServerName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (serverName.trim()) {
      onCreate({
        serverName: serverName.trim(),
        description: description.trim(),
        isPublic
      });
    }
  };

  const resetModalState = () => {
    setServerName('');
    setDescription('');
    setIsPublic(false);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={serverName}
        onChange={(e) => setServerName(e.target.value)}
        placeholder="Название сервера"
        className="modal-input"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Описание сервера"
        className="modal-input"
        rows={3}
      />
      <div className="server-type-toggle">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          <span className="toggle-text">
            {isPublic ? 'Публичный сервер' : 'Приватный сервер'}
          </span>
        </label>
        <p className="toggle-description">
          {isPublic 
            ? 'Сервер будет виден в поиске и доступен всем' 
            : 'Сервер будет доступен только по приглашению'}
        </p>
      </div>
      <div className="modal-actions">
        <button
          onClick={handleSubmit}
          disabled={!serverName.trim()}
        >
          Создать
        </button>
        <button onClick={resetModalState}>
          Отмена
        </button>
      </div>
    </form>
  );
};

export default memo(HomePage);
