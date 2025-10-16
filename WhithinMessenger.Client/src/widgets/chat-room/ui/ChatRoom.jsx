import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../../shared/lib/contexts/AuthContext';
import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import { 
  useChat, 
  useMessageSearch, 
  useMediaHandlers, 
  useContextMenu, 
  useMessageForward 
} from '../../../shared/lib/hooks';
import { MessageInput, MessageItem } from '../../../shared/ui';
import MessageSearch from '../../../shared/ui/molecules/MessageSearch/MessageSearch';
import MediaFile from '../../../shared/ui/molecules/MediaFile/MediaFile';
import RepliedMedia from '../../../shared/ui/molecules/RepliedMedia/RepliedMedia';
import ChatInfoModal from '../../../shared/ui/molecules/ChatInfoModal/ChatInfoModal';
import AddUserModal from '../../../shared/ui/molecules/AddUserModal/AddUserModal';
import { UserAvatar } from '../../../shared/ui';
import { Call, Mic, Stop, AttachFile } from '@mui/icons-material';
import './ChatRoom.css';

const ChatRoom = ({ 
  chatId, 
  groupName, 
  isServerChat = false, 
  isGroupChat = false, 
  onJoinVoiceChannel,
  chatTypeId,
  activePrivateCall 
}) => {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const username = user?.username;
  const userId = user?.id || user?.userId;

  const {
    messages,
    connection,
    isLoading,
    error,
    messagesEndRef,
    sendMessage,
    editMessage,
    deleteMessage,
    forwardMessage,
    scrollToBottom
  } = useChat(chatId, username, userId);

  const {
    searchQuery,
    searchResults,
    isSearching,
    searchMessages,
    clearSearch,
    scrollToMessage
  } = useMessageSearch(chatId);

  const {
    isRecording,
    recordingTime,
    fileInputRef,
    handleSendMedia,
    handleAudioRecording,
    formatRecordingTime,
    cancelRecording
  } = useMediaHandlers(connection, chatId, userId, username);

  const {
    contextMenu,
    highlightedMessageId,
    handleContextMenu,
    closeContextMenu
  } = useContextMenu();

  const {
    messageToForward,
    forwardModalVisible,
    availableChats,
    forwardMessageText,
    setForwardMessageText,
    forwardTextareaRef,
    startForward,
    closeForwardModal,
    handleForward
  } = useMessageForward(userId);

  const [newMessage, setNewMessage] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [isPrivateChat, setIsPrivateChat] = useState(false);
  const [otherUserInCall] = useState(false);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [chatParticipants, setChatParticipants] = useState([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [chatUserProfile, setChatUserProfile] = useState(null);

  const inputRef = useRef(null);

  // Функция для загрузки информации о чате через SignalR
  const loadChatInfo = useCallback(() => {
    if (!chatId || !connection) return;
    
    console.log('ChatRoom - Loading chat info via SignalR for chatId:', chatId);
    console.log('ChatRoom - Connection state:', connection.state);
    
    // Проверяем состояние соединения
    if (connection.state !== 'Connected') {
      console.log('ChatRoom - Connection not ready, waiting...');
      
      // Ждем подключения и повторяем попытку
      const checkConnection = () => {
        if (connection.state === 'Connected') {
          console.log('ChatRoom - Connection ready, sending GetChatInfo');
          connection.invoke("GetChatInfo", chatId).catch(error => {
            console.error('Error invoking GetChatInfo:', error);
          });
        } else {
          console.log('ChatRoom - Still waiting for connection...');
          setTimeout(checkConnection, 100);
        }
      };
      
      checkConnection();
      return;
    }
    
    // Отправляем запрос через SignalR
    connection.invoke("GetChatInfo", chatId).catch(error => {
      console.error('Error invoking GetChatInfo:', error);
      
      // Fallback к API если SignalR не работает
      console.log('ChatRoom - Falling back to API for chat info');
      fetch(`${BASE_URL}/api/chat/${chatId}/info`)
        .then(response => response.json())
        .then(chatInfo => {
          console.log('ChatRoom - Loaded chat info via API:', chatInfo);
          setChatUserProfile({
            avatar: chatInfo.type === 'group' ? chatInfo.chatAvatar : chatInfo.avatar,
            avatarColor: chatInfo.type === 'group' ? chatInfo.chatAvatarColor : chatInfo.avatarColor
          });
        })
        .catch(apiError => {
          console.error('Error loading chat info via API:', apiError);
        });
    });
  }, [chatId, connection]);

  // Функция для загрузки участников чата через SignalR
  const loadChatParticipants = useCallback(async () => {
    if (!chatId || isPrivateChat || !connection) {
      console.log('🔍 ChatRoom - Skipping participants load: chatId =', chatId, 'isPrivateChat =', isPrivateChat, 'connection =', !!connection);
      return;
    }

    try {
      console.log('🔍 ChatRoom - Loading participants via SignalR for chatId:', chatId);
      await connection.invoke('GetChatParticipants', chatId);
    } catch (error) {
      console.error('❌ ChatRoom - Error loading participants via SignalR:', error);
      setChatParticipants([]);
    }
  }, [chatId, isPrivateChat, connection]);

  // Настраиваем обработчик для получения участников через SignalR
  useEffect(() => {
    if (!connection) return;

    const handleReceiveChatParticipants = (participants) => {
      console.log('🔍 ChatRoom - Received participants via SignalR:', participants);
      console.log('🔍 ChatRoom - Participants details:', participants.map(p => ({
        userId: p.userId,
        username: p.username,
        avatarUrl: p.avatarUrl,
        avatarColor: p.avatarColor,
        userStatus: p.userStatus
      })));
      if (participants && Array.isArray(participants)) {
        setChatParticipants(participants);
        console.log('✅ ChatRoom - Loaded', participants.length, 'participants:', participants.map(p => p.username));
      } else {
        console.log('❌ ChatRoom - Invalid participants data:', participants);
        setChatParticipants([]);
      }
    };

    const handleError = (error) => {
      console.error('❌ ChatRoom - SignalR error:', error);
      setChatParticipants([]);
    };

    const handleGroupUpdated = (action, userId) => {
      console.log('🔍 ChatRoom - Group updated:', action, userId);
      if (action === 'user_added' && showChatInfo && connection && chatId) {
        // Обновляем список участников только если модальное окно открыто
        console.log('🔍 ChatRoom - Reloading participants after user added');
        connection.invoke('GetChatParticipants', chatId).catch(error => {
          console.error('❌ ChatRoom - Error reloading participants:', error);
        });
      }
    };

    const handleChatInfoReceived = (chatInfo) => {
      console.log('ℹ️ ChatRoom - Chat info received:', chatInfo);
      setChatUserProfile({
        avatar: chatInfo.type === 'group' ? chatInfo.chatAvatar : chatInfo.avatar,
        avatarColor: chatInfo.type === 'group' ? chatInfo.chatAvatarColor : chatInfo.avatarColor
      });
    };

    const handleConnectionStateChanged = (state) => {
      console.log('ChatRoom - Connection state changed to:', state);
      if (state === 'Connected' && showChatInfo) {
        console.log('ChatRoom - Connection established, loading chat info');
        loadChatInfo();
      }
    };

    const handleChatDeleted = (data) => {
      // Если удален текущий чат, перенаправляем на список чатов
      if (typeof data === 'object' && data.chatId === chatId) {
        navigate('/channels/@me');
      } else if (typeof data === 'string' && data === chatId) {
        navigate('/channels/@me');
      }
    };

    connection.on('ReceiveChatParticipants', handleReceiveChatParticipants);
    connection.on('GroupUpdated', handleGroupUpdated);
    connection.on('ChatInfoReceived', handleChatInfoReceived);
    connection.on('Error', handleError);
    connection.on('chatdeleted', handleChatDeleted);
    
    // Слушаем изменения состояния соединения
    connection.onclose(() => handleConnectionStateChanged('Disconnected'));
    connection.onreconnecting(() => handleConnectionStateChanged('Reconnecting'));
    connection.onreconnected(() => handleConnectionStateChanged('Connected'));

    return () => {
      connection.off('ReceiveChatParticipants', handleReceiveChatParticipants);
      connection.off('GroupUpdated', handleGroupUpdated);
      connection.off('ChatInfoReceived', handleChatInfoReceived);
      connection.off('Error', handleError);
      connection.off('chatdeleted', handleChatDeleted);
    };
  }, [connection, showChatInfo]);

  // Загружаем участников при открытии ChatInfo
  useEffect(() => {
    if (showChatInfo && !isPrivateChat && connection && chatId) {
      console.log('🔍 ChatRoom - Loading participants via SignalR for chatId:', chatId);
      connection.invoke('GetChatParticipants', chatId).catch(error => {
        console.error('❌ ChatRoom - Error loading participants via SignalR:', error);
        setChatParticipants([]);
      });
    }
  }, [showChatInfo, isPrivateChat, chatId, connection]);

  // Загружаем информацию о чате
  useEffect(() => {
    if (showChatInfo && connection && chatId) {
      console.log('ChatRoom - Loading chat info via SignalR for chatId:', chatId);
      connection.invoke("GetChatInfo", chatId).catch(error => {
        console.error('Error invoking GetChatInfo:', error);
      });
    }
  }, [showChatInfo, chatId, connection]);

  useEffect(() => {
    setIsPrivateChat(chatTypeId === 1 || (!isGroupChat && !isServerChat));
  }, [chatTypeId, isGroupChat, isServerChat]);

  const isCallActiveInThisChat = activePrivateCall && 
    String(activePrivateCall.chatId) === String(chatId) && 
    isPrivateChat;

  const handleAddUserClick = () => {
    console.log('🔍 ChatRoom - Add user button clicked');
    setShowAddUserModal(true);
  };

  const handleUserAdded = (userId) => {
    console.log('🔍 ChatRoom - User added:', userId);
    // Обновляем список участников
    loadChatParticipants();
  };

  const handleSendMessage = useCallback(async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    let success = false;

    if (editingMessageId) {
      // Редактируем существующее сообщение
      console.log('Editing message:', editingMessageId, 'with content:', newMessage);
      success = await editMessage(editingMessageId, newMessage);
    } else {
      // Отправляем новое сообщение
      console.log('Sending new message:', newMessage);
      success = await sendMessage(
        newMessage, 
        replyingToMessage?.messageId || null,
        null
      );
    }

    if (success) {
      if (editingMessageId) {
        setEditingMessageId(null);
      }
      setReplyingToMessage(null);
      setNewMessage('');
    }
  }, [newMessage, replyingToMessage, editingMessageId]);

  const handleEditMessage = (messageId, currentContent) => {
    setEditingMessageId(messageId);
    setNewMessage(currentContent);
    scrollToBottom();
  };

  const handleDeleteMessage = async (messageId) => {
    const message = messages.find(m => m.messageId === messageId);
    if (!message) return;

    const canDelete = message.senderUsername === username;

    if (!canDelete) {
      alert('Вы можете удалять только свои сообщения');
      return;
    }

    await deleteMessage(messageId);
    if (editingMessageId === messageId) {
      setEditingMessageId(null);
      setNewMessage('');
    }
  };

  const handleReplyToMessage = (message) => {
    setReplyingToMessage(message);
    closeContextMenu();
  };

  const handleForwardMessage = (message) => {
    startForward(message);
    closeContextMenu();
  };

  const handleContextMenuClick = (e, messageId) => {
    const message = messages.find(m => m.messageId === messageId);
    const isOwnMessage = message?.senderUsername === username;
    const canDelete = isOwnMessage;
    
    handleContextMenu(e, messageId, isOwnMessage, canDelete, 'message');
  };

  const handleStartCall = (e) => {
    if (isPrivateChat && !isCallActiveInThisChat && !otherUserInCall) {
      handleContextMenu(e, null, false, false, 'call');
    }
  };

  const handleCallWithNotification = () => {
    const callData = {
      roomId: chatId.toString(),
      roomName: `Звонок с ${groupName}`,
      userName: username,
      userId: userId,
      isPrivateCall: true,
      chatId: chatId
    };
    
    if (connection) {
      connection.invoke('SendCallNotification', chatId, username, userId, groupName);
    }
    
    if (onJoinVoiceChannel) {
      onJoinVoiceChannel(callData);
    }
    closeContextMenu();
  };

  const handleCallWithoutNotification = () => {
    const callData = {
      roomId: chatId.toString(),
      roomName: `Звонок с ${groupName}`,
      userName: username,
      userId: userId,
      isPrivateCall: true,
      chatId: chatId
    };
    
    if (onJoinVoiceChannel) {
      onJoinVoiceChannel(callData);
    }
    closeContextMenu();
  };



  useEffect(() => {
    const handleGlobalPaste = async (e) => {
      const activeElement = document.activeElement;
      const isInChatContainer = activeElement?.closest('.group-chat-container') || 
                               activeElement === inputRef.current;
      
      const isInModal = activeElement?.closest('.modal') || 
                       activeElement?.closest('[role="dialog"]');
      
      if (!isInChatContainer || isInModal) return;
      
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
          e.preventDefault();
          await handleSendMedia(file);
          return;
        }
      }
      if (e.clipboardData && e.clipboardData.getData('text')) {
        const text = e.clipboardData.getData('text');
        if (text && activeElement !== inputRef.current) {
          e.preventDefault();
          setNewMessage((prev) => prev + text);
          inputRef.current?.focus();
        }
      }
    };
    
    const handleGlobalKeyDown = async (e) => {
      const activeElement = document.activeElement;
      const isInChatContainer = activeElement?.closest('.group-chat-container') || 
                               activeElement === inputRef.current;
      
      const isInModal = activeElement?.closest('.modal') || 
                       activeElement?.closest('[role="dialog"]');
      
      if (!isInChatContainer || isInModal) return;
      
      if (activeElement?.tagName === 'INPUT' || 
          activeElement?.tagName === 'TEXTAREA' || 
          activeElement?.contentEditable === 'true') {
        return;
      }
      
      if (e.key === 'Enter' && activeElement !== inputRef.current && newMessage.trim() !== '') {
        e.preventDefault();
        await handleSendMessage(e);
        if (activeElement.classList?.contains('group-chat-container')) {
          activeElement.blur();
        }
        return;
      }
      if (
        activeElement !== inputRef.current &&
        e.key.length === 1 &&
        !e.ctrlKey && !e.metaKey && !e.altKey
      ) {
        setNewMessage((prev) => prev + e.key);
        inputRef.current?.focus();
        e.preventDefault();
      }
      if (
        activeElement !== inputRef.current &&
        e.key === 'Backspace'
      ) {
        setNewMessage((prev) => prev.slice(0, -1));
        inputRef.current?.focus();
        e.preventDefault();
      }
    };
    
    window.addEventListener('paste', handleGlobalPaste);
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [newMessage]);


  const ForwardModal = () => {
    useEffect(() => {
      if (forwardModalVisible && forwardTextareaRef.current) {
        forwardTextareaRef.current.focus();
      }
    }, []);

    if (!forwardModalVisible) return null;

    return (
      <div className="modal-overlay">
        <div className="modal-content forward-modal">
          <h3>Переслать сообщение</h3>
          
          <div className="forwarded-message-preview">
            <strong>{messageToForward?.senderUsername}</strong>
            <p>{messageToForward?.content}</p>
          </div>

          <div className="forward-message-input">
            <input
              ref={forwardTextareaRef}
              type="text"
              placeholder="Добавьте комментарий к пересылаемому сообщению..."
              value={forwardMessageText}
              onChange={(e) => setForwardMessageText(e.target.value)}
              className="forward-input"
              autoFocus
            />
          </div>

          <div className="chat-list">
            <h4>Выберите чат для пересылки:</h4>
            {availableChats.map(chat => (
              <div
                key={chat.chatId}
                className="chat-item"
                onClick={() => handleForward(chat.chatId, forwardMessage)}
              >
                {chat.name || `Чат с ${chat.username}`}
              </div>
            ))}
          </div>
          <div className="forward-modal-buttons">
            <button 
              className="cancel-button" 
              onClick={closeForwardModal}
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Дополнительная проверка безопасности - если нет chatId, показываем ошибку
  if (!chatId) {
    console.warn('SECURITY WARNING: ChatRoom rendered without chatId');
    return (
      <div className="chat-room-error">
        <h3>Ошибка доступа к чату</h3>
        <p>Чат не найден или у вас нет прав доступа к нему.</p>
      </div>
    );
  }

  return (
    <div
      className="group-chat-container"
      tabIndex={0}
      style={{ outline: 'none' }}
    >
      <div className="chat-header">
        <div className="header-left">
          <div className="user-info" onClick={() => setShowChatInfo(true)}>
            <h2 className="username clickable-chat-title">{groupName}</h2>
          </div>
        </div>
        <div className="header-actions">

          {(isPrivateChat || isGroupChat) && !isCallActiveInThisChat && !otherUserInCall && (
            <button
              onClick={handleStartCall}
              className="voice-call-button"
              title="Начать звонок"
            >
              <Call style={{ fontSize: '20px' }} />
            </button>
          )}

          {isGroupChat && (
            <button className="add-member-button" onClick={handleAddUserClick}>
              Добавить участника
            </button>
          )}
          
          <MessageSearch
            searchQuery={searchQuery}
            searchResults={searchResults}
            isSearching={isSearching}
            onSearch={searchMessages}
            onClearSearch={clearSearch}
            onScrollToMessage={scrollToMessage}
          />
        </div>
      </div>

      {isCallActiveInThisChat && (
        <div style={{
          position: 'relative',
          width: '100%',
          height: '400px',
          backgroundColor: '#18191c',
          borderBottom: '1px solid #202225',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{ 
            flex: 1, 
            position: 'relative', 
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#8e9297'
          }}>
            <div id="voice-chat-container-private" style={{ 
              width: '100%', 
              height: '100%'
            }} />
          </div>
        </div>
      )}

      <div className="messages">
        {isLoading && (
          <div className="chat-loading">
            <div className="loading-spinner"></div>
            <p>Загрузка сообщений...</p>
          </div>
        )}

        {error && (
          <div className="chat-error">
            <p>Ошибка загрузки сообщений: {error}</p>
          </div>
        )}

        {!isLoading && !error && messages.length === 0 && (
          <div className="chat-empty">
            <p>Начните общение!</p>
          </div>
        )}

        {messages.map((msg) => {
          
          return (
            <div
              key={msg.messageId}
              id={`message-${msg.messageId}`}
              className={`message ${msg.senderUsername === username ? 'my-message' : 'user-message'} ${
                highlightedMessageId === msg.messageId ? 'highlighted' : ''
              }`}
              onContextMenu={(e) => handleContextMenuClick(e, msg.messageId)}
            >
              <UserAvatar 
                username={msg.senderUsername}
                avatarUrl={msg.avatarUrl}
                avatarColor={msg.avatarColor}
              />
              <div className="message-content">
                <strong className="message-username">{msg.senderUsername}</strong>
                {msg.repliedMessage && (
                  <div className="replied-message" onClick={() => scrollToMessage(msg.repliedMessage.messageId)}>
                    <div className="replied-message-header">
                      <strong>{msg.repliedMessage.senderUsername}</strong>
                    </div>
                    <div className="replied-message-content">
                      <RepliedMedia 
                        content={msg.repliedMessage.content} 
                        mediaFiles={msg.repliedMessage.mediaFiles || []} 
                      />
                    </div>
                  </div>
                )}
                {msg.forwardedMessage && (
                  <>
                    <div className="forwarded-message">
                      <div className="forwarded-message-header">
                        <span>Переслано от</span>
                        <strong>{msg.forwardedMessage.senderUsername}</strong>
                        <span>из</span>
                        <strong>{msg.forwardedMessage.originalChatName}</strong>
                      </div>
                      <div className="forwarded-message-content">
                        {msg.forwardedMessage.content}
                      </div>
                    </div>
                    {msg.content && (
                      <div className="message-text">
                        {msg.content}
                      </div>
                    )}
                  </>
                )}
                {!msg.forwardedMessage && (
                  <div className="message-text">
                    {msg.content}
                  </div>
                )}
                
                {/* Добавляем отображение медиафайлов */}
                {msg.mediaFiles && msg.mediaFiles.length > 0 && (
                  <div className="message-media">
                    {msg.mediaFiles.map((mediaFile) => (
                      <MediaFile
                        key={mediaFile.id}
                        mediaFile={mediaFile}
                        canDelete={false}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {contextMenu.visible && contextMenu.type === 'message' && (
          <div 
            className="context-menu"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => handleReplyToMessage(messages.find(m => m.messageId === contextMenu.messageId))}
              className="context-menu-button"
            >
              Ответить
            </button>
            <button 
              onClick={() => handleForwardMessage(messages.find(m => m.messageId === contextMenu.messageId))}
              className="context-menu-button"
            >
              Переслать
            </button>
            {contextMenu.isOwnMessage && (
              <button 
                onClick={() => {
                  const message = messages.find(m => m.messageId === contextMenu.messageId);
                  handleEditMessage(contextMenu.messageId, message?.content);
                  closeContextMenu();
                }}
                className="context-menu-button"
              >
                Редактировать
              </button>
            )}
            {contextMenu.canDelete && (
              <button 
                onClick={() => {
                  handleDeleteMessage(contextMenu.messageId);
                  closeContextMenu();
                }}
                className="context-menu-button"
              >
                Удалить
              </button>
            )}
          </div>
        )}

        {contextMenu.visible && contextMenu.type === 'call' && (
          <div 
            className="context-menu call-type-menu"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
              zIndex: 1000000000,
              position: 'fixed'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={handleCallWithNotification}
              className="context-menu-button call-with-notification"
            >
              <Call style={{ fontSize: '16px' }} />
              Звонить с уведомлением
            </button>
            <button 
              onClick={handleCallWithoutNotification}
              className="context-menu-button call-without-notification"
            >
              <Call style={{ fontSize: '16px' }} />
              Звонить без уведомления
            </button>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <form className={`input-container ${replyingToMessage ? 'replying' : ''}`} onSubmit={handleSendMessage}>
        {editingMessageId && (
          <div className="editing-notice">
            <span className='editing-text'>Редактирование сообщения</span>
            <button 
              onClick={() => {
                setEditingMessageId(null);
                setNewMessage('');
              }} 
              className="cancel-edit-button"
            >
              ×
            </button>
          </div>
        )}
        
        {replyingToMessage && (
          <div className="reply-preview">
            <div className="reply-info">
              <div className="reply-header">
                <strong>{replyingToMessage.senderUsername}</strong>
                <span>Ответ на сообщение</span>
              </div>
              <div className="reply-content">
                {replyingToMessage.content}
              </div>
            </div>
            <button 
              onClick={() => setReplyingToMessage(null)} 
              className="cancel-reply-button"
            >
              ×
            </button>
          </div>
        )}
        
        {isRecording ? (
          <div className="recording-indicator-input">
            <span className="recording-dot">●</span>
            <span className="recording-time">{formatRecordingTime(recordingTime)}</span>
            <span className="recording-hint">Запись... (ESC для отмены)</span>
            <button 
              type="button"
              onClick={cancelRecording}
              className="cancel-recording-button"
              title="Отменить запись"
            >
              ×
            </button>
          </div>
        ) : (
          <>
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={
                editingMessageId 
                  ? "Редактируйте сообщение..." 
                  : replyingToMessage 
                    ? "Напишите ответ..." 
                    : "Введите сообщение..."
              }
              className="message-input no-focus-outline"
              onPaste={async (e) => {
                if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
                  const file = e.clipboardData.files[0];
                  if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
                    e.preventDefault();
                    await handleSendMedia(file);
                  }
                }
              }}
              autoComplete="off"
              spellCheck={true}
            />
            <button type="submit" className="send-button">
              {editingMessageId ? 'Сохранить' : replyingToMessage ? 'Отправить' : 'Отправить'}
            </button>
          </>
        )}
        
        {!editingMessageId && (
          <>
            <div className="voice-message-wrapper">
              {isRecording && (
                <button 
                  type="button"
                  onClick={cancelRecording}
                  className="cancel-recording-button-left"
                  title="Отменить запись"
                >
                  Отменить
                </button>
              )}
              <button
                type="button"
                onClick={handleAudioRecording}
                className={`voice-record-button ${isRecording ? 'recording' : ''}`}
                title={isRecording ? "Нажмите для остановки и отправки" : "Нажмите для начала записи"}
              >
                {isRecording ? <Stop /> : <Mic />}
              </button>
            </div>
            
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={(e) => handleSendMedia(e.target.files[0])}
              accept="image/*, video/*, audio/*"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current.click()}
              className="media-button"
            >
              <AttachFile />
            </button>
          </>
        )}
      </form>
      
      
      <ForwardModal />
      
      <ChatInfoModal 
        open={showChatInfo}
        onClose={() => setShowChatInfo(false)}
        chatInfo={{
          chatId: chatId,
          name: groupName || 'Чат',
          type: isPrivateChat ? 'private' : 'group',
          avatar: chatUserProfile?.avatar,
          avatarColor: chatUserProfile?.avatarColor || '#5865F2',
          chatAvatar: chatUserProfile?.avatar,
          chatAvatarColor: chatUserProfile?.avatarColor
        }}
        mediaFiles={messages.flatMap(msg => msg.mediaFiles || [])}
        participants={chatParticipants}
        onParticipantsUpdated={loadChatParticipants}
        connection={connection}
      />

      {/* Модальное окно добавления пользователей */}
      <AddUserModal
        open={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        chatId={chatId}
        onUserAdded={handleUserAdded}
        connection={connection}
      />
    </div>
  );
};

export default ChatRoom;