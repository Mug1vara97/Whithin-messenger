import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../../shared/lib/contexts/AuthContext';
import { useProfileModal } from '../../../shared/lib/contexts/ProfileModalContext';
import { useConnectionContext } from '../../../shared/lib/contexts/ConnectionContext';
import { useCallStore } from '../../../shared/lib/stores/callStore';
import { voiceChannelService } from '../../../shared/lib/services/voiceChannelService';
import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import { openExternalUrl, splitTextWithLinks, buildMediaUrl } from '../../../shared/lib/utils/urlHelpers';
import { fetchAllChatMediaFiles, collectMediaFromMessages } from '../../../shared/lib/utils/fetchChatMedia';
import { formatDiscordMessageTimestamp, formatShortMessageTime } from '../../../shared/lib/utils/messageTime';
import { 
  useChat, 
  useMessageSearch, 
  useMediaHandlers, 
  useContextMenu,
  useClampedMenuPosition,
  useMessageForward 
} from '../../../shared/lib/hooks';
import { formatTypingLabel } from '../../../shared/lib/hooks/useChat';
import { MessageInput, MessageStatusIndicator } from '../../../shared/ui';
import { MessageStatus } from '../../../entities/message/model/types';
import MessageSearch from '../../../shared/ui/molecules/MessageSearch/MessageSearch';
import MediaFile from '../../../shared/ui/molecules/MediaFile/MediaFile';
import MessageMediaContent from '../../../shared/ui/molecules/MessageMediaContent/MessageMediaContent';
import MessageMediaAlbum from '../../../shared/ui/molecules/MessageMediaAlbum/MessageMediaAlbum';
import MediaSendOverlay from '../../../shared/ui/molecules/MediaSendOverlay/MediaSendOverlay';
import { categorizeMessageMedia } from '../../../shared/lib/utils/messageMediaHelpers';
import RepliedMedia from '../../../shared/ui/molecules/RepliedMedia/RepliedMedia';
import StickerMessage from '../../../shared/ui/molecules/StickerMessage/StickerMessage';
import StickerPicker from '../../../shared/ui/molecules/StickerPicker/StickerPicker';
import ChatAttachMenu from '../../../shared/ui/molecules/ChatAttachMenu/ChatAttachMenu';
import CreatePollModal from '../../../shared/ui/molecules/CreatePollModal/CreatePollModal';
import PollMessage from '../../../shared/ui/molecules/PollMessage/PollMessage';
import { stickerApi } from '../../../entities/sticker/api';
import ChatInfoModal from '../../../shared/ui/molecules/ChatInfoModal/ChatInfoModal';
import AddUserModal from '../../../shared/ui/molecules/AddUserModal/AddUserModal';
import { ForwardMessageModal } from '../../../shared/ui/molecules/ForwardMessageModal';
import { getPinnedMessagePreview } from '../../../shared/lib/utils/pinnedMessageHelpers';
import { UserAvatar } from '../../../shared/ui';
import { VoiceParticipantStatusIcons } from '../../../shared/ui/atoms/VoiceParticipantStatusIcons';
import { ChatVoiceCall } from '../../../shared/ui/molecules';
import { MemberListSidebar } from '../../../shared/ui/molecules/MemberListSidebar';
import { useMembers } from '../../../entities/member/hooks';
import { useRoles } from '../../../entities/role/hooks';
import { usePresenceOverrides } from '../../../shared/lib/hooks/usePresenceOverrides';
import { useServerHubConnection } from '../../../shared/lib/hooks/useServerHubConnection';
import {
  mapChatParticipantToListItem,
  mapServerMemberToListItem,
} from '../../../shared/lib/utils/memberListUtils';
import {
  Call,
  Mic,
  Stop,
  PushPin,
  Image as ImageIcon,
  Videocam,
  FolderZip,
  InsertDriveFile,
  EmojiEmotions,
  ReplyOutlined,
  ForwardOutlined,
  EditOutlined,
  DeleteOutline,
  People,
} from '@mui/icons-material';
import {
  canSendMessages,
  canAttachFiles,
  canSendVoiceMessages,
  canManageMessages,
} from '../../../entities/role/lib/serverPermissions';
import './ChatRoom.css';

const ChatRoom = ({ 
  chatId, 
  groupName, 
  isServerChat = false, 
  isGroupChat = false, 
  onJoinVoiceChannel,
  chatTypeId,
  activePrivateCall,
  activeChatCall,
  onEndChatCall,
  userPermissions = {},
  isServerOwner = false,
  serverId = null,
  serverOwnerId = null,
  /** When messages load/update; parent debounces the server «mark chat read» call */
  onMessagesActivity
}) => {
  const { user } = useAuthContext();
  const connectionContext = useConnectionContext();
  const getConnection = connectionContext?.getConnection;
  const navigate = useNavigate();
  const username = user?.username;
  const userId = user?.id || user?.userId;
  const { openProfile } = useProfileModal();

  const handleOpenAuthorProfile = useCallback(
    (message) => {
      const authorId = message?.senderId ?? message?.SenderId;
      if (!authorId) return;
      openProfile(authorId, message?.senderUsername);
    },
    [openProfile]
  );
  const {
    messages,
    pinnedMessages,
    connection,
    isLoading,
    isLoadingOlder,
    hasMoreOlder,
    error,
    messagesEndRef,
    messagesContainerRef,
    sendMessage,
    editMessage,
    deleteMessage,
    forwardMessage,
    pinMessage,
    unpinMessage,
    createPoll,
    votePoll,
    scrollToBottom,
    typingUsers,
    handleComposerTextChange,
    handleMessagesScroll,
    loadOlderMessages,
  } = useChat(chatId, username, userId);

  const typingLabel = useMemo(() => formatTypingLabel(typingUsers), [typingUsers]);

  const visiblePinnedMessages = useMemo(() => {
    const byId = new Map();
    pinnedMessages.forEach((msg) => {
      byId.set(String(msg.messageId), msg);
    });
    messages
      .filter((msg) => msg.isPinned)
      .forEach((msg) => {
        const key = String(msg.messageId);
        byId.set(key, { ...byId.get(key), ...msg, isPinned: true });
      });
    return Array.from(byId.values()).sort(
      (a, b) => new Date(a.pinnedAt || a.createdAt) - new Date(b.pinnedAt || b.createdAt),
    );
  }, [messages, pinnedMessages]);

  const [activePinnedIndex, setActivePinnedIndex] = useState(0);

  useEffect(() => {
    setActivePinnedIndex(0);
  }, [chatId, visiblePinnedMessages.length]);

  const activePinnedMessage = visiblePinnedMessages[activePinnedIndex] ?? visiblePinnedMessages[0] ?? null;
  const activePinnedPreview = useMemo(
    () => getPinnedMessagePreview(activePinnedMessage),
    [activePinnedMessage],
  );

  const PIN_INDICATOR_VISIBLE_COUNT = 5;
  const PIN_INDICATOR_SLOT_PX = 6;

  const pinnedIndicatorOffset = useMemo(() => {
    const total = visiblePinnedMessages.length;
    if (total <= PIN_INDICATOR_VISIBLE_COUNT) {
      return 0;
    }

    const maxOffset = total - PIN_INDICATOR_VISIBLE_COUNT;
    const centeredStart = activePinnedIndex - Math.floor(PIN_INDICATOR_VISIBLE_COUNT / 2);
    const start = Math.max(0, Math.min(centeredStart, maxOffset));
    return start * PIN_INDICATOR_SLOT_PX;
  }, [activePinnedIndex, visiblePinnedMessages.length]);

  const canScrollPinnedIndicator = visiblePinnedMessages.length > PIN_INDICATOR_VISIBLE_COUNT;

  const canSend = !isServerChat || canSendMessages(userPermissions, isServerOwner);
  const canAttach = !isServerChat || canAttachFiles(userPermissions, isServerOwner);
  const canVoice = !isServerChat || canSendVoiceMessages(userPermissions, isServerOwner);
  const canModerateMessages = isServerChat && canManageMessages(userPermissions, isServerOwner);
  const canPinMessages = canModerateMessages || !isServerChat;
  const [isPollModalOpen, setPollModalOpen] = useState(false);
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);

  const messagesTailKey = useMemo(() => {
    if (!messages?.length) return '0:';
    const tail = messages[messages.length - 1];
    const mid = tail?.messageId ?? tail?.MessageId ?? tail?.id ?? tail?.Id ?? '';
    return `${messages.length}:${mid}`;
  }, [messages]);


  useEffect(() => {
    if (!chatId || typeof onMessagesActivity !== 'function') return;
    onMessagesActivity(chatId);
  }, [chatId, messagesTailKey, onMessagesActivity]);

  const {
    searchQuery,
    searchResults,
    isSearching,
    searchMessages,
    clearSearch,
    scrollToMessage
  } = useMessageSearch(chatId, connection);

  const handlePinnedBarClick = useCallback(async () => {
    if (!activePinnedMessage?.messageId) return;

    await scrollToMessage(activePinnedMessage.messageId);

    if (visiblePinnedMessages.length > 1) {
      setActivePinnedIndex((index) => (index + 1) % visiblePinnedMessages.length);
    }
  }, [activePinnedMessage, visiblePinnedMessages.length, scrollToMessage]);

  const {
    isRecording,
    recordingTime,
    fileInputRef,
    handleSendMedia,
    queueMediaSend,
    cancelMediaSend,
    confirmMediaSend,
    pendingMediaSend,
    handleAudioRecording,
    formatRecordingTime,
    cancelRecording,
    uploadingFile,
    uploadProgress,
    isRecordingVideoNote,
    videoNoteRecordingTime,
    handleVideoNoteRecording,
    cancelVideoNoteRecording
  } = useMediaHandlers(connection, chatId, userId, username);

  const {
    contextMenu,
    highlightedMessageId,
    handleContextMenu,
    closeContextMenu
  } = useContextMenu();

  const contextMenuRef = useRef(null);
  const contextMenuPosition = useClampedMenuPosition(
    contextMenu.visible && contextMenu.type === 'message',
    { x: contextMenu.x, y: contextMenu.y },
    contextMenuRef
  );

  const {
    forwardModalVisible,
    startForward,
    closeForwardModal,
    forwardToSelected,
    modalProps,
  } = useMessageForward(chatId);

  const [newMessage, setNewMessage] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [isPrivateChat, setIsPrivateChat] = useState(false);
  const [otherUserInCall] = useState(false);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [chatInfoMediaFiles, setChatInfoMediaFiles] = useState([]);
  const [chatInfoMediaLoading, setChatInfoMediaLoading] = useState(false);
  const [chatParticipants, setChatParticipants] = useState([]);
  const [existingCallParticipants, setExistingCallParticipants] = useState([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [chatUserProfile, setChatUserProfile] = useState(null);
  const [showCallTypeSelector, setShowCallTypeSelector] = useState(false);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [stickerPanelWidth, setStickerPanelWidth] = useState(380);
  const [isSendingSticker, setIsSendingSticker] = useState(false);
  const [showMemberList, setShowMemberList] = useState(true);
  const notificationConnectionRef = useRef(null);

  const serverConnection = useServerHubConnection(isServerChat ? serverId : null);
  const { members: serverMembers, isLoading: serverMembersLoading } = useMembers(
    serverConnection,
    isServerChat ? serverId : null,
    userId
  );
  const { roles: serverRoles, fetchRoles: fetchServerRoles } = useRoles(
    serverConnection,
    isServerChat ? serverId : null,
    userId
  );
  const { resolveStatus } = usePresenceOverrides(userId);

  useEffect(() => {
    if (isServerChat && serverConnection && serverId) {
      fetchServerRoles();
    }
  }, [isServerChat, serverConnection, serverId, fetchServerRoles]);

  const isStickerPanelOpen = stickerPickerOpen && !editingMessageId && canSend;
  const showMembersSidebar =
    (isServerChat || isGroupChat) && !isPrivateChat && showMemberList && !isStickerPanelOpen;

  const handleMemberListToggle = useCallback(() => {
    if (isStickerPanelOpen) {
      setStickerPickerOpen(false);
      setShowMemberList(true);
      return;
    }
    setShowMemberList((open) => !open);
  }, [isStickerPanelOpen]);

  const handleStickerPickerToggle = useCallback(() => {
    setStickerPickerOpen((open) => !open);
  }, []);

  const sidebarMembers = useMemo(() => {
    if (isServerChat) {
      return (serverMembers || []).map((member) =>
        mapServerMemberToListItem(member, { serverOwnerId, resolveStatus, serverRoles })
      );
    }
    if (isGroupChat) {
      return (chatParticipants || []).map((participant) =>
        mapChatParticipantToListItem(participant, { resolveStatus })
      );
    }
    return [];
  }, [
    isServerChat,
    isGroupChat,
    serverMembers,
    chatParticipants,
    serverOwnerId,
    resolveStatus,
    serverRoles,
  ]);

  const inputRef = useRef(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key !== 'Escape') return;

      if (contextMenu.visible) {
        closeContextMenu();
        e.stopImmediatePropagation();
        return;
      }
      if (forwardModalVisible) {
        closeForwardModal();
        e.stopImmediatePropagation();
        return;
      }
      if (showChatInfo) {
        setShowChatInfo(false);
        e.stopImmediatePropagation();
        return;
      }
      if (showAddUserModal) {
        setShowAddUserModal(false);
        e.stopImmediatePropagation();
        return;
      }
      if (showCallTypeSelector) {
        setShowCallTypeSelector(false);
        e.stopImmediatePropagation();
        return;
      }
      if (pendingMediaSend?.files?.length > 0) {
        return;
      }
      if (stickerPickerOpen) {
        setStickerPickerOpen(false);
        e.stopImmediatePropagation();
        return;
      }
      if (editingMessageId) {
        setEditingMessageId(null);
        setNewMessage('');
        e.stopImmediatePropagation();
        return;
      }
      if (replyingToMessage) {
        setReplyingToMessage(null);
        e.stopImmediatePropagation();
        return;
      }
    };

    document.addEventListener('keydown', handleEscape, true);
    return () => document.removeEventListener('keydown', handleEscape, true);
  }, [
    contextMenu.visible,
    closeContextMenu,
    forwardModalVisible,
    closeForwardModal,
    showChatInfo,
    showAddUserModal,
    showCallTypeSelector,
    pendingMediaSend,
    stickerPickerOpen,
    editingMessageId,
    replyingToMessage,
  ]);

  const renderTextWithLinks = useCallback((text, keyPrefix) => {
    const parts = splitTextWithLinks(text);

    if (!parts.length) {
      return text;
    }

    return parts.map((part, index) => {
      if (part.type === 'link') {
        return (
          <a
            key={`${keyPrefix}-link-${index}`}
            href={part.href}
            className="message-link"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openExternalUrl(part.href);
            }}
          >
            {part.value}
          </a>
        );
      }

      return (
        <React.Fragment key={`${keyPrefix}-text-${index}`}>
          {part.value}
        </React.Fragment>
      );
    });
  }, []);

  const loadChatInfo = useCallback(() => {
    if (!chatId || !connection) return;
    
    console.log('ChatRoom - Loading chat info via SignalR for chatId:', chatId);
    console.log('ChatRoom - Connection state:', connection.state);
    
    if (connection.state !== 'Connected') {
      console.log('ChatRoom - Connection not ready, waiting...');
      
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
    
    connection.invoke("GetChatInfo", chatId).catch(error => {
      console.error('Error invoking GetChatInfo:', error);
      
      console.log('ChatRoom - Falling back to API for chat info');
      fetch(`${BASE_URL}/api/chat/${chatId}/info`)
        .then(response => response.json())
        .then(chatInfo => {
          console.log('ChatRoom - Loaded chat info via API:', chatInfo);
          setChatUserProfile({
            avatar: chatInfo.type === 'group' ? chatInfo.chatAvatar : chatInfo.avatar,
            avatarColor: chatInfo.type === 'group' ? chatInfo.chatAvatarColor : chatInfo.avatarColor,
            banner: chatInfo.banner ?? chatInfo.Banner ?? null,
          });
        })
        .catch(apiError => {
          console.error('Error loading chat info via API:', apiError);
        });
    });
  }, [chatId, connection]);

  const loadChatParticipants = useCallback(async () => {
    if (!chatId || isPrivateChat || !connection) {
      console.log('ChatRoom - Skipping participants load: chatId =', chatId, 'isPrivateChat =', isPrivateChat, 'connection =', !!connection);
      return;
    }

    try {
      console.log('ChatRoom - Loading participants via SignalR for chatId:', chatId);
      await connection.invoke('GetChatParticipants', chatId);
    } catch (error) {
      console.error('ChatRoom - Error loading participants via SignalR:', error);
      setChatParticipants([]);
    }
  }, [chatId, isPrivateChat, connection]);

  useEffect(() => {
    if (!connection) return;

    const handleReceiveChatParticipants = (participants) => {
      console.log('ChatRoom - Received participants via SignalR:', participants);
      console.log('ChatRoom - Participants details:', participants.map(p => ({
        userId: p.userId,
        username: p.username,
        avatarUrl: p.avatarUrl,
        avatarColor: p.avatarColor,
        userStatus: p.userStatus
      })));
      if (participants && Array.isArray(participants)) {
        setChatParticipants(participants);
        console.log('ChatRoom - Loaded', participants.length, 'participants:', participants.map(p => p.username));
      } else {
        console.log('ChatRoom - Invalid participants data:', participants);
        setChatParticipants([]);
      }
    };

    const handleError = (error) => {
      console.error('ChatRoom - SignalR error:', error);
      setChatParticipants([]);
    };

    const handleGroupUpdated = (action, userId) => {
      console.log('ChatRoom - Group updated:', action, userId);
      if (action === 'user_added' && (showChatInfo || showMemberList) && connection && chatId) {
        console.log('ChatRoom - Reloading participants after user added');
        connection.invoke('GetChatParticipants', chatId).catch(error => {
          console.error('ChatRoom - Error reloading participants:', error);
        });
      }
    };

    const handleChatInfoReceived = (chatInfo) => {
      console.log('ChatRoom - Chat info received:', chatInfo);
      setChatUserProfile({
        avatar: chatInfo.type === 'group' ? chatInfo.chatAvatar : chatInfo.avatar,
        avatarColor: chatInfo.type === 'group' ? chatInfo.chatAvatarColor : chatInfo.avatarColor,
        banner: chatInfo.banner ?? chatInfo.Banner ?? null,
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
  }, [connection, showChatInfo, showMemberList, chatId]);

  useEffect(() => {
    if (!isGroupChat || isPrivateChat || !connection || !chatId) return;
    if (!showMemberList && !showChatInfo) return;

    console.log('ChatRoom - Loading participants for member sidebar, chatId:', chatId);
    connection.invoke('GetChatParticipants', chatId).catch((error) => {
      console.error('ChatRoom - Error loading participants via SignalR:', error);
      setChatParticipants([]);
    });
  }, [isGroupChat, isPrivateChat, chatId, connection, showMemberList, showChatInfo]);

  useEffect(() => {
    if (showChatInfo && connection && chatId) {
      console.log('ChatRoom - Loading chat info via SignalR for chatId:', chatId);
      connection.invoke("GetChatInfo", chatId).catch(error => {
        console.error('Error invoking GetChatInfo:', error);
      });
    }
  }, [showChatInfo, chatId, connection]);

  useEffect(() => {
    if (!showChatInfo || !chatId) {
      return undefined;
    }

    let cancelled = false;
    setChatInfoMediaLoading(true);

    fetchAllChatMediaFiles(chatId)
      .then((files) => {
        if (!cancelled) {
          setChatInfoMediaFiles(files.length > 0 ? files : collectMediaFromMessages(messages));
        }
      })
      .catch((error) => {
        console.error('ChatRoom - failed to load chat media for info:', error);
        if (!cancelled) {
          setChatInfoMediaFiles(collectMediaFromMessages(messages));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setChatInfoMediaLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showChatInfo, chatId]);

  useEffect(() => {
    if (!userId || !getConnection) return undefined;
    let mounted = true;

    const setupRealtimePresence = async () => {
      try {
        const notificationConnection = await getConnection('notificationhub', userId);
        if (!mounted) return;
        notificationConnectionRef.current = notificationConnection;

        const onUserStatusChanged = (payload) => {
          const changedUserId = payload?.userId ?? payload?.UserId;
          const status = payload?.status ?? payload?.Status;
          const lastSeen = payload?.lastSeen ?? payload?.LastSeen;

          setChatParticipants((prev) =>
            prev.map((participant) =>
              String(participant.userId) === String(changedUserId)
                ? { ...participant, userStatus: status ?? participant.userStatus, lastSeen: lastSeen ?? participant.lastSeen }
                : participant
            )
          );
        };

        notificationConnection.on('UserStatusChanged', onUserStatusChanged);
      } catch (error) {
        console.error('ChatRoom - failed to subscribe to presence updates:', error);
      }
    };

    setupRealtimePresence();

    return () => {
      mounted = false;
      if (notificationConnectionRef.current) {
        notificationConnectionRef.current.off('UserStatusChanged');
      }
    };
  }, [userId, getConnection]);

  useEffect(() => {
    setIsPrivateChat(chatTypeId === 1 || (!isGroupChat && !isServerChat));
  }, [chatTypeId, isGroupChat, isServerChat]);

  useEffect(() => {
    if (!chatId || isServerChat) return undefined;

    const readParticipantsFromStore = (state) => {
      if (!state?.voiceChannelParticipants) return [];

      const direct =
        state.voiceChannelParticipants.get(chatId) ||
        state.voiceChannelParticipants.get(String(chatId));
      if (direct && Array.isArray(direct)) return direct;

      for (const [channelKey, participants] of state.voiceChannelParticipants.entries()) {
        if (String(channelKey) === String(chatId) && Array.isArray(participants)) {
          return participants;
        }
      }

      return [];
    };

    voiceChannelService.connect();
    voiceChannelService.subscribeToChannel(String(chatId));
    setExistingCallParticipants(readParticipantsFromStore(useCallStore.getState()));

    const unsubscribe = useCallStore.subscribe((state) => {
      setExistingCallParticipants(readParticipantsFromStore(state));
    });

    return () => {
      unsubscribe();
      voiceChannelService.unsubscribeFromChannel(String(chatId));
    };
  }, [chatId, isServerChat]);

  const isCallActiveInThisChat = (activePrivateCall && 
    String(activePrivateCall.chatId) === String(chatId) && 
    isPrivateChat) || (activeChatCall && 
    String(activeChatCall.chatId) === String(chatId));

  const usersAlreadyInCall = existingCallParticipants.filter((participant) => {
    const participantId = participant.odUserId || participant.userId;
    return String(participantId) !== String(userId);
  });
  const hasJoinableCallInThisChat = !isCallActiveInThisChat && usersAlreadyInCall.length > 0;
  const primaryJoinParticipant = usersAlreadyInCall[0] || null;

  const handleAddUserClick = () => {
    console.log('ChatRoom - Add user button clicked');
    setShowAddUserModal(true);
  };

  const handleUserAdded = (userId) => {
    console.log('ChatRoom - User added:', userId);
    loadChatParticipants();
  };

  const handleSendMessage = useCallback(async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const trimmedMessage = newMessage.trim();
    let success = false;

    if (editingMessageId) {
      console.log('Editing message:', editingMessageId, 'with content:', newMessage);
      success = await editMessage(editingMessageId, newMessage);
    } else {
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
  }, [newMessage, replyingToMessage, editingMessageId, editMessage, sendMessage]);

  const handleSendSticker = useCallback(async (sticker) => {
    if (!chatId || !sticker?.id || isSendingSticker) return;
    setIsSendingSticker(true);
    try {
      await stickerApi.sendSticker(chatId, sticker.id, {
        repliedToMessageId: replyingToMessage?.messageId || null,
      });
      setReplyingToMessage(null);
    } catch (err) {
      console.error('Failed to send sticker:', err);
      alert(err?.response?.data?.message || err?.message || 'Не удалось отправить стикер');
    } finally {
      setIsSendingSticker(false);
    }
  }, [chatId, isSendingSticker, replyingToMessage]);

  const handleStickerPanelResizeStart = useCallback((event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = stickerPanelWidth;
    const minWidth = 280;
    const maxWidth = Math.min(560, Math.max(320, window.innerWidth - 420));

    const handleMouseMove = (moveEvent) => {
      const nextWidth = startWidth + startX - moveEvent.clientX;
      setStickerPanelWidth(Math.min(maxWidth, Math.max(minWidth, nextWidth)));
    };

    const handleMouseUp = () => {
      document.body.classList.remove('is-resizing-sticker-panel');
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    document.body.classList.add('is-resizing-sticker-panel');
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [stickerPanelWidth]);

  const handleEditMessage = (messageId, currentContent) => {
    setEditingMessageId(messageId);
    setNewMessage(currentContent);
    scrollToBottom();
  };

  const handleDeleteMessage = async (messageId) => {
    const message = messages.find(m => m.messageId === messageId);
    if (!message) return;

    const isOwn = message.senderUsername === username;
    const canDelete = isOwn || canModerateMessages;

    if (!canDelete) {
      alert('У вас нет прав для удаления этого сообщения');
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
    if (!message) return;
    startForward(message);
    closeContextMenu();
  };

  const handleCreatePoll = async ({ question, options, allowMultiple, isAnonymous }) => {
    setIsCreatingPoll(true);
    try {
      return await createPoll({ question, options, allowMultiple, isAnonymous });
    } finally {
      setIsCreatingPoll(false);
    }
  };

  const handleContextMenuClick = (e, messageId) => {
    const message = messages.find(m => m.messageId === messageId);
    const isOwnMessage = message?.senderUsername === username;
    const canDelete = isOwnMessage || canModerateMessages;
    const canEdit = isOwnMessage || canModerateMessages;

    handleContextMenu(e, messageId, isOwnMessage, canDelete, 'message', canEdit);
  };

  const startChatCall = useCallback(() => {
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
  }, [chatId, groupName, onJoinVoiceChannel, userId, username]);

  const handleStartCall = () => {
    console.log('handleStartCall: clicked', { isPrivateChat, isGroupChat, isCallActiveInThisChat, otherUserInCall });
    
    if ((isPrivateChat || isGroupChat) && !isCallActiveInThisChat) {
      setShowCallTypeSelector(true);
      return;
    } else {
      console.log('handleStartCall: conditions not met for starting call');
    }
  };

  const handleCallWithNotification = async () => {
    if (connection) {
      try {
        await connection.invoke('SendCallNotification', chatId, username, userId);
      } catch (error) {
        console.error('Failed to send call notification:', error);
      }
    }

    startChatCall();
    setShowCallTypeSelector(false);
    closeContextMenu();
  };

  const handleCallWithoutNotification = () => {
    console.log('handleCallWithoutNotification: called with data:', { 
      chatId, groupName, username, userId, onJoinVoiceChannel 
    });

    startChatCall();
    setShowCallTypeSelector(false);
    closeContextMenu();
    console.log('handleCallWithoutNotification: call started');
  };

  useEffect(() => {
    const handleGlobalPaste = async (e) => {
      console.log('🔍 Paste event triggered', {
        target: e.target,
        files: e.clipboardData?.files?.length,
        hasText: !!e.clipboardData?.getData('text')
      });

      // Проверяем, что мы в контексте чата
      const chatContainer = document.querySelector('.group-chat-container');
      if (!chatContainer || !chatContainer.contains(e.target)) {
        console.log('❌ Paste outside chat container');
        return; // Вставка происходит вне чата
      }

      const activeElement = document.activeElement;
      
      // Проверяем, что это не модальное окно или превью изображения
      const isInModal = activeElement?.closest('.modal') || 
                       activeElement?.closest('[role="dialog"]') ||
                       activeElement?.closest('.image-preview-overlay');
      
      if (isInModal) {
        console.log('❌ Paste in modal');
        return;
      }
      
      // Проверяем, что это не другое поле ввода (например, поиск или редактирование)
      const isInOtherInput = activeElement?.tagName === 'INPUT' && activeElement !== inputRef.current;
      const isInOtherTextarea = activeElement?.tagName === 'TEXTAREA' && activeElement !== inputRef.current;
      
      if (isInOtherInput || isInOtherTextarea) {
        console.log('❌ Paste in other input');
        return;
      }
      
      // Проверяем наличие файлов ПЕРВЫМ делом
      console.log('📎 Checking for files:', e.clipboardData?.files);
      
      // Обрабатываем файлы (изображения и видео)
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        console.log('📎 File found:', {
          name: file.name,
          type: file.type,
          size: file.size
        });
        
        if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
          e.preventDefault();
          e.stopPropagation();
          console.log('✅ Sending file:', file.name, file.type);
          await queueMediaSend(file);
          console.log('✅ File sent successfully');
          return;
        } else {
          console.log('❌ File type not supported:', file.type);
        }
      } else {
        console.log('❌ No files in clipboard');
      }
      
      // Обрабатываем текст только если не в поле ввода сообщения
      if (activeElement !== inputRef.current) {
        if (e.clipboardData && e.clipboardData.getData('text')) {
          const text = e.clipboardData.getData('text');
          if (text) {
            console.log('📝 Pasting text:', text.substring(0, 50));
            e.preventDefault();
            setNewMessage((prev) => prev + text);
            inputRef.current?.focus();
          }
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
  }, [newMessage, queueMediaSend, handleSendMessage, setNewMessage]);


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
      className={`group-chat-container ${isStickerPanelOpen ? 'has-sticker-panel' : ''}`}
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
          {!isServerChat && (isPrivateChat || isGroupChat) && !isCallActiveInThisChat && !hasJoinableCallInThisChat && (
            <button
              onClick={handleStartCall}
              className="voice-call-button"
              title="Начать звонок"
            >
              <Call style={{ fontSize: '20px' }} />
            </button>
          )}

          {(isServerChat || isGroupChat) && !isPrivateChat && (
            <button
              type="button"
              className={`member-list-toggle ${showMembersSidebar ? 'active' : ''}`}
              onClick={handleMemberListToggle}
              title={showMembersSidebar ? 'Скрыть список участников' : 'Показать список участников'}
              aria-pressed={showMembersSidebar}
            >
              <People style={{ fontSize: '20px' }} />
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

      <div className="chat-room-body">
      <div className="chat-room-main">

      {!isServerChat && isCallActiveInThisChat && (
        <ChatVoiceCall
          chatId={chatId}
          chatName={activeChatCall?.chatName || groupName}
          userId={activeChatCall?.userId || userId}
          userName={activeChatCall?.userName || username}
          onClose={() => {
            // Логика закрытия звонка
            console.log('ChatVoiceCall: Call closed');
            if (onEndChatCall) {
              onEndChatCall();
            }
          }}
        />
      )}

      {!isServerChat && hasJoinableCallInThisChat && primaryJoinParticipant && (
        <div className="chat-voice-call-join-preview">
          <div className="join-preview-center">
            <div className="join-preview-title">Звонок уже идёт</div>
            <div className={`join-preview-users-grid ${usersAlreadyInCall.length === 1 ? 'single-user' : ''}`}>
              {usersAlreadyInCall.slice(0, 8).map((participant) => {
                const participantMuted = !!participant?.isMuted;
                const participantDeafened = !!(
                  participant?.isGlobalAudioMuted ||
                  participant?.isAudioDisabled ||
                  participant?.isDeafened
                );

                return (
                  <div
                    className="join-preview-user-item"
                    key={participant.odUserId || participant.userId || participant.userName}
                  >
                    <div className={`join-preview-user-avatar ${participant?.isSpeaking ? 'speaking' : ''}`}>
                      <UserAvatar
                        username={participant.userName || 'U'}
                        avatarUrl={participant.avatar}
                        avatarColor={participant.avatarColor}
                        size={74}
                      />
                    </div>
                    <div className="join-preview-user-name">{participant.userName || 'User'}</div>
                    <div className="join-preview-user-status-row">
                      <VoiceParticipantStatusIcons
                        isMuted={participantMuted}
                        isDeafened={participantDeafened}
                        isSpeaking={!!participant?.isSpeaking}
                        variant="pills"
                      />
                    </div>
                  </div>
                );
              })}
              {usersAlreadyInCall.length > 8 && (
                <div className="join-preview-user-more">+{usersAlreadyInCall.length - 8}</div>
              )}
            </div>
          </div>
          <div className="join-preview-controls">
            <button type="button" className="join-preview-btn disabled" title="Камера">
              <Videocam style={{ fontSize: '20px' }} />
            </button>
            <button
              type="button"
              className="join-preview-btn join"
              title="Присоединиться к звонку"
              onClick={handleCallWithoutNotification}
            >
              <Call style={{ fontSize: '20px' }} />
            </button>
          </div>
        </div>
      )}

      {!isLoading && visiblePinnedMessages.length > 0 && (
        <button
          type="button"
          className="chat-pinned-bar"
          onClick={() => { void handlePinnedBarClick(); }}
          title={
            visiblePinnedMessages.length > 1
              ? 'Перейти к закрепу и показать следующий'
              : 'Перейти к закреплённому сообщению'
          }
        >
          <div
            className={`chat-pinned-bar__indicator ${canScrollPinnedIndicator ? 'chat-pinned-bar__indicator--scrollable' : ''}`}
            aria-hidden="true"
          >
            <div className="chat-pinned-bar__indicator-viewport">
              <div
                className="chat-pinned-bar__indicator-track"
                style={{ transform: `translateY(-${pinnedIndicatorOffset}px)` }}
              >
                {visiblePinnedMessages.map((pinned, index) => (
                  <span
                    key={pinned.messageId}
                    className={`chat-pinned-bar__indicator-segment ${index === activePinnedIndex ? 'is-active' : ''}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <span className="chat-pinned-bar__body">
            <span className="chat-pinned-bar__title">
              {visiblePinnedMessages.length > 1
                ? `Закреплённое сообщение #${activePinnedIndex + 1}`
                : 'Закреплённое сообщение'}
            </span>
            <span className="chat-pinned-bar__preview">{activePinnedPreview}</span>
          </span>
        </button>
      )}

      <div
        className="messages"
        ref={messagesContainerRef}
        onScroll={handleMessagesScroll}
      >
        {!isLoading && (isLoadingOlder || hasMoreOlder) && (
          <div className="chat-older-loader">
            {isLoadingOlder ? (
              <>
                <div className="loading-spinner" />
                <span>Загрузка истории…</span>
              </>
            ) : (
              <button
                type="button"
                className="chat-load-older-btn"
                onClick={loadOlderMessages}
              >
                Загрузить ещё 50 сообщений
              </button>
            )}
          </div>
        )}

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

        {!isLoading && messages.map((msg, messageIndex) => {
          const isOwn = msg.senderUsername === username;
          const headerTime = formatDiscordMessageTimestamp(msg.createdAt);
          const isStickerMessage = !msg.forwardedMessage && msg.contentType === 'sticker' && msg.sticker;
          const isPollMessage = !msg.forwardedMessage && msg.contentType === 'poll' && msg.poll;
          const hasTextContent = Boolean(msg.content?.trim()) && !isPollMessage;
          const isForwardedSticker = msg.forwardedMessage?.contentType === 'sticker' && msg.forwardedMessage?.sticker;
          const hasMedia = Boolean(msg.mediaFiles?.length);
          const isMediaOnly = hasMedia && !hasTextContent && !msg.repliedMessage && !msg.forwardedMessage && !isStickerMessage;

          const messageBody = (
            <>
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
                        {isForwardedSticker ? (
                          <div className="forwarded-message-media">
                            <StickerMessage sticker={msg.forwardedMessage.sticker} />
                          </div>
                        ) : (
                          <>
                            {msg.forwardedMessage.content && (
                              <div className="forwarded-message-text">
                                {renderTextWithLinks(msg.forwardedMessage.content, `${msg.messageId}-forwarded-source`)}
                              </div>
                            )}
                            {msg.forwardedMessage.mediaFiles?.length > 0 && (() => {
                              const { visualMedia, voiceMedia, fileMedia } = categorizeMessageMedia(
                                msg.forwardedMessage.mediaFiles
                              );
                              return (
                                <>
                                  {visualMedia.length >= 2 ? (
                                    <div className="forwarded-message-media">
                                      <MessageMediaAlbum
                                        mediaFiles={visualMedia}
                                        showTimeBadge={false}
                                        onVideoClick={(url) => window.open(url, '_blank', 'noopener,noreferrer')}
                                      />
                                    </div>
                                  ) : (
                                    visualMedia.length > 0 && (
                                      <div className="forwarded-message-media">
                                        {visualMedia.map((mediaFile) => (
                                          <img
                                            key={mediaFile.id}
                                            src={buildMediaUrl(mediaFile.filePath)}
                                            alt={mediaFile.originalFileName || mediaFile.fileName || 'Image'}
                                            className="forwarded-message-image"
                                          />
                                        ))}
                                      </div>
                                    )
                                  )}
                                  {[...voiceMedia, ...fileMedia].map((mediaFile) => (
                                    <div key={mediaFile.id} className="forwarded-message-media">
                                      <MediaFile mediaFile={mediaFile} canDelete={false} />
                                    </div>
                                  ))}
                                </>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </div>
                    {hasTextContent && (
                      <div className="message-text">
                        {renderTextWithLinks(msg.content, `${msg.messageId}-forwarded-content`)}
                      </div>
                    )}
                  </>
                )}
                {isStickerMessage && (
                  <div className="message-media message-media--sticker">
                    <StickerMessage sticker={msg.sticker} />
                  </div>
                )}

                {isPollMessage && (
                  <PollMessage
                    poll={msg.poll}
                    onVote={(optionIds) => votePoll(msg.messageId, optionIds)}
                  />
                )}

                {!msg.forwardedMessage && !isStickerMessage && !isPollMessage && !msg.mediaFiles?.length && hasTextContent && (
                  <div className="message-text">
                    {renderTextWithLinks(msg.content, `${msg.messageId}-content`)}
                  </div>
                )}
                
                {!msg.forwardedMessage && !isStickerMessage && !isPollMessage && msg.mediaFiles?.length > 0 && (
                  <MessageMediaContent
                    mediaFiles={msg.mediaFiles}
                    timestamp={formatShortMessageTime(msg.createdAt)}
                    onVideoClick={(url) => window.open(url, '_blank', 'noopener,noreferrer')}
                    renderCaption={
                      hasTextContent
                        ? () => renderTextWithLinks(msg.content, `${msg.messageId}-content`)
                        : null
                    }
                  />
                )}
            </>
          );

          return (
            <div
              key={msg.messageId}
              id={`message-${msg.messageId}`}
              className={`message ${isOwn ? 'my-message' : 'user-message'} ${
                isStickerMessage ? 'message--sticker' : ''
              } ${isPollMessage ? 'message--poll' : ''} ${isMediaOnly ? 'message--media-only' : ''} ${
                msg.isPinned ? 'message--pinned' : ''
              } ${
                highlightedMessageId === msg.messageId ? 'highlighted' : ''
              }`}
              onContextMenu={(e) => handleContextMenuClick(e, msg.messageId)}
            >
              <UserAvatar
                username={msg.senderUsername}
                avatarUrl={msg.avatarUrl}
                avatarColor={msg.avatarColor}
                onClick={(event) => {
                  event.stopPropagation();
                  handleOpenAuthorProfile(msg);
                }}
              />
              <div className="message-content">
                <div className="message-header">
                  <button
                    type="button"
                    className="message-username profile-open-trigger"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleOpenAuthorProfile(msg);
                    }}
                  >
                    {msg.senderUsername}
                  </button>
                  {headerTime && (
                    <span className="message-header-time">{headerTime}</span>
                  )}
                  {msg.isEdited && (
                    <span className="message-edited">ред.</span>
                  )}
                  {isOwn && (
                    <MessageStatusIndicator
                      status={msg.status || MessageStatus.SENT}
                      onLightBubble
                    />
                  )}
                </div>
                {messageBody}
              </div>
            </div>
          );
        })}

        {contextMenu.visible && contextMenu.type === 'message' && (
          <div 
            ref={contextMenuRef}
            className="context-menu"
            style={{
              left: `${contextMenuPosition.x}px`,
              top: `${contextMenuPosition.y}px`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => handleReplyToMessage(messages.find(m => m.messageId === contextMenu.messageId))}
              className="context-menu-button"
            >
              <span className="context-menu-button-icon" aria-hidden="true">
                <ReplyOutlined fontSize="inherit" />
              </span>
              Ответить
            </button>
            <button 
              onClick={() => handleForwardMessage(messages.find(m => m.messageId === contextMenu.messageId))}
              className="context-menu-button"
            >
              <span className="context-menu-button-icon" aria-hidden="true">
                <ForwardOutlined fontSize="inherit" />
              </span>
              Переслать
            </button>
            {canPinMessages && (() => {
              const message = messages.find((m) => m.messageId === contextMenu.messageId);
              const isPinned = Boolean(message?.isPinned);
              return (
                <button
                  onClick={async () => {
                    if (isPinned) {
                      await unpinMessage(contextMenu.messageId);
                    } else {
                      await pinMessage(contextMenu.messageId);
                    }
                    closeContextMenu();
                  }}
                  className="context-menu-button"
                >
                  <span className="context-menu-button-icon" aria-hidden="true">
                    <PushPin fontSize="inherit" />
                  </span>
                  {isPinned ? 'Открепить' : 'Закрепить'}
                </button>
              );
            })()}
            {contextMenu.canEdit && (() => {
              const message = messages.find(m => m.messageId === contextMenu.messageId);
              const isSticker = message?.contentType === 'sticker' && message?.sticker;
              const hasMediaOnly = message?.contentType === 'media' && !message?.content?.trim();
              if (isSticker || hasMediaOnly) return null;
              return (
                <button
                  onClick={() => {
                    handleEditMessage(contextMenu.messageId, message?.content);
                    closeContextMenu();
                  }}
                  className="context-menu-button"
                >
                  <span className="context-menu-button-icon" aria-hidden="true">
                    <EditOutlined fontSize="inherit" />
                  </span>
                  Редактировать
                </button>
              );
            })()}
            {contextMenu.canDelete && (
              <button 
                onClick={() => {
                  handleDeleteMessage(contextMenu.messageId);
                  closeContextMenu();
                }}
                className="context-menu-button danger"
              >
                <span className="context-menu-button-icon" aria-hidden="true">
                  <DeleteOutline fontSize="inherit" />
                </span>
                Удалить
              </button>
            )}
          </div>
        )}

        {/* Индикатор загрузки файла */}
        {uploadingFile && (
          <div className="message my-message uploading-message">
            <UserAvatar 
              username={username}
              avatarUrl={null}
              avatarColor="#5865F2"
            />
            <div className="message-content">
              <strong className="message-username">{username}</strong>
              <div className="uploading-file-container">
                <div className="uploading-file-info">
                  <div className="uploading-file-icon uploading-file-icon-mui">
                    {uploadingFile.type.startsWith('image/') ? <ImageIcon sx={{ fontSize: 32 }} /> : 
                     uploadingFile.type.startsWith('video/') ? <Videocam sx={{ fontSize: 32 }} /> : 
                     /\.(zip|rar|7z|tar|gz)$/i.test(uploadingFile.name) ? <FolderZip sx={{ fontSize: 32 }} /> : <InsertDriveFile sx={{ fontSize: 32 }} />}
                  </div>
                  <div className="uploading-file-details">
                    <div className="uploading-file-name">{uploadingFile.name}</div>
                    <div className="uploading-file-progress">
                      Загрузка... {uploadProgress}%
                    </div>
                  </div>
                </div>
                <div className="upload-progress-bar">
                  <div 
                    className="upload-progress-fill" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {typingLabel && (
          <div className="chat-typing-indicator" aria-live="polite">
            <span className="chat-typing-indicator__dots" aria-hidden="true" />
            <span>{typingLabel}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {(canSend || editingMessageId || !isServerChat) && (
      <form
        className={`input-container ${replyingToMessage ? 'replying' : ''}`}
        onSubmit={handleSendMessage}
      >
        <>
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
                {replyingToMessage.contentType === 'sticker' && replyingToMessage.sticker ? (
                  <StickerMessage sticker={replyingToMessage.sticker} size={48} />
                ) : (
                  replyingToMessage.content
                )}
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
        
        {isRecording || isRecordingVideoNote ? (
          <div className="recording-indicator-input">
            <span className="recording-dot">●</span>
            <span className="recording-time">
              {formatRecordingTime(isRecordingVideoNote ? videoNoteRecordingTime : recordingTime)}
            </span>
            <span className="recording-hint">
              {isRecordingVideoNote ? 'Видеокружок…' : 'Запись... (ESC для отмены)'}
            </span>
            <button 
              type="button"
              onClick={isRecordingVideoNote ? cancelVideoNoteRecording : cancelRecording}
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
              onChange={(e) => {
                const value = e.target.value;
                setNewMessage(value);
                handleComposerTextChange(value);
              }}
              placeholder={
                editingMessageId
                  ? 'Редактируйте сообщение...'
                  : replyingToMessage
                    ? 'Напишите ответ...'
                    : 'Введите сообщение...'
              }
              className="message-input no-focus-outline"
              autoComplete="off"
              spellCheck={true}
            />
            <button type="submit" className="send-button">
              {editingMessageId ? 'Сохранить' : 'Отправить'}
            </button>
          </>
        )}
        
        {!editingMessageId && (
          <>
            {canVoice && (
            <div className="voice-message-wrapper">
              {(isRecording || isRecordingVideoNote) && (
                <button 
                  type="button"
                  onClick={isRecordingVideoNote ? cancelVideoNoteRecording : cancelRecording}
                  className="cancel-recording-button-left"
                  title="Отменить запись"
                >
                  Отменить
                </button>
              )}
              <button
                type="button"
                onClick={handleAudioRecording}
                disabled={isRecordingVideoNote}
                className={`voice-record-button ${isRecording ? 'recording' : ''}`}
                title={isRecording ? "Нажмите для остановки и отправки" : "Нажмите для начала записи"}
              >
                {isRecording ? <Stop /> : <Mic />}
              </button>
            </div>
            )}
            {canAttach && (
              <ChatAttachMenu
                disabled={!canSend}
                onMediaSelect={queueMediaSend}
                onDocumentSelect={queueMediaSend}
                onPollClick={() => setPollModalOpen(true)}
              />
            )}
            <button
              type="button"
              onClick={handleStickerPickerToggle}
              className={`media-button ${isStickerPanelOpen ? 'active' : ''}`}
              title="Стикеры"
              disabled={isSendingSticker}
            >
              <EmojiEmotions />
            </button>
          </>
        )}
        </>
      </form>
      )}
      </div>

      {showMembersSidebar && (
        <MemberListSidebar
          members={sidebarMembers}
          isLoading={isServerChat ? serverMembersLoading : false}
          emptyLabel={isServerChat ? 'Участники сервера не найдены' : 'Участники группы не найдены'}
          groupByRoles={isServerChat}
          serverRoles={isServerChat ? serverRoles : []}
        />
      )}

      <StickerPicker
        open={isStickerPanelOpen}
        width={stickerPanelWidth}
        onResizeStart={handleStickerPanelResizeStart}
        onClose={() => setStickerPickerOpen(false)}
        onStickerSelect={handleSendSticker}
      />
      </div>

      <ForwardMessageModal
        {...modalProps}
        onSend={() => forwardToSelected(forwardMessage)}
      />

      {pendingMediaSend?.files?.length > 0 && (
        <MediaSendOverlay
          files={pendingMediaSend.files}
          isUploading={Boolean(uploadingFile)}
          uploadProgress={uploadProgress}
          onCancel={cancelMediaSend}
          onSend={confirmMediaSend}
        />
      )}

      {showCallTypeSelector && (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowCallTypeSelector(false);
            }
          }}
        >
          <div className="modal-content call-mode-modal">
            <h3>Как начать звонок?</h3>
            <p>{isGroupChat ? 'Выберите режим для группового звонка' : 'Выберите режим для звонка 1-на-1'}</p>
            <div className="call-mode-actions">
              <button
                type="button"
                className="call-mode-button notify"
                onClick={handleCallWithNotification}
              >
                <Call style={{ fontSize: '18px' }} />
                С дозвоном
              </button>
              <button
                type="button"
                className="call-mode-button direct"
                onClick={handleCallWithoutNotification}
              >
                <Call style={{ fontSize: '18px' }} />
                Просто присоединиться
              </button>
            </div>
          </div>
        </div>
      )}

      <ChatInfoModal 
        open={showChatInfo}
        onClose={() => setShowChatInfo(false)}
        chatInfo={{
          chatId: chatId,
          name: groupName || 'Чат',
          type: isPrivateChat ? 'private' : 'group',
          avatar: chatUserProfile?.avatar,
          avatarColor: chatUserProfile?.avatarColor || '#5865F2',
          banner: chatUserProfile?.banner ?? null,
          chatAvatar: chatUserProfile?.avatar,
          chatAvatarColor: chatUserProfile?.avatarColor
        }}
        mediaFiles={chatInfoMediaFiles}
        mediaFilesLoading={chatInfoMediaLoading}
        participants={chatParticipants}
        onParticipantsUpdated={loadChatParticipants}
        connection={connection}
      />

      <AddUserModal
        open={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        chatId={chatId}
        onUserAdded={handleUserAdded}
        connection={connection}
      />

      <CreatePollModal
        isOpen={isPollModalOpen}
        onClose={() => setPollModalOpen(false)}
        onSubmit={handleCreatePoll}
        isSubmitting={isCreatingPoll}
      />
    </div>
  );
};

export default ChatRoom;