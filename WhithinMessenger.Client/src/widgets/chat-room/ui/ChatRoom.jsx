import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../../shared/lib/contexts/AuthContext';
import { useProfileModal } from '../../../shared/lib/contexts/ProfileModalContext';
import { useNotificationContext } from '../../../shared/lib/contexts/NotificationContext';
import { useServerContext } from '../../../shared/lib/contexts/useServerContext';
import { useConnectionContext } from '../../../shared/lib/contexts/ConnectionContext';
import { PROFILE_UPDATED_EVENT } from '../../../shared/lib/contexts/ProfileModalContext';
import {
  patchChatUserProfileWithProfile,
  patchParticipantWithProfile,
} from '../../../shared/lib/utils/profilePatchHelpers';
import { useCallStore } from '../../../shared/lib/stores/callStore';
import { voiceChannelService } from '../../../shared/lib/services/voiceChannelService';
import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import { buildMediaUrl } from '../../../shared/lib/utils/urlHelpers';
import MessageMarkdown from '../../../shared/ui/molecules/MessageMarkdown/MessageMarkdown';
import { fetchAllChatMediaFiles, collectMediaFromMessages } from '../../../shared/lib/utils/fetchChatMedia';
import { formatDiscordMessageTimestamp, formatShortMessageTime, buildMessagesWithDateSeparators } from '../../../shared/lib/utils/messageTime';
import { isCallLogMessage } from '../../../shared/lib/utils/callLogHelpers';
import { 
  useChat, 
  useMessageSearch, 
  useMediaHandlers, 
  useContextMenu,
  useClampedMenuPosition,
  useMessageForward,
  useMessageSelection,
  filterDeletableMessages,
} from '../../../shared/lib/hooks';
import { formatTypingLabel } from '../../../shared/lib/hooks/useChat';
import { resolveMessageAvatarIdentity } from '../../../shared/lib/utils/userDisplayNameHelpers';
import { MessageStatusIndicator } from '../../../shared/ui';
import { MessageStatus } from '../../../entities/message/model/types';
import MessageSearchModal from '../../../shared/ui/molecules/MessageSearch/MessageSearchModal';
import MediaFile from '../../../shared/ui/molecules/MediaFile/MediaFile';
import MessageMediaContent from '../../../shared/ui/molecules/MessageMediaContent/MessageMediaContent';
import MessageMediaAlbum from '../../../shared/ui/molecules/MessageMediaAlbum/MessageMediaAlbum';
import MediaSendOverlay from '../../../shared/ui/molecules/MediaSendOverlay/MediaSendOverlay';
import { categorizeMessageMedia } from '../../../shared/lib/utils/messageMediaHelpers';
import {
  getMessageContextMenuActions,
  copyMessageText,
  copyMediaFileToClipboard,
  saveMessageMediaFiles,
} from '../../../shared/lib/utils/messageClipboardUtils';
import RepliedMedia from '../../../shared/ui/molecules/RepliedMedia/RepliedMedia';
import StickerMessage from '../../../shared/ui/molecules/StickerMessage/StickerMessage';
import StickerPicker from '../../../shared/ui/molecules/StickerPicker/StickerPicker';
import ChatAttachMenu from '../../../shared/ui/molecules/ChatAttachMenu/ChatAttachMenu';
import CreatePollModal from '../../../shared/ui/molecules/CreatePollModal/CreatePollModal';
import PollMessage from '../../../shared/ui/molecules/PollMessage/PollMessage';
import { CallLogMessage } from '../../../shared/ui/molecules/CallLogMessage';
import { stickerApi } from '../../../entities/sticker/api';
import ChatInfoModal from '../../../shared/ui/molecules/ChatInfoModal/ChatInfoModal';
import AddUserModal from '../../../shared/ui/molecules/AddUserModal/AddUserModal';
import { ForwardMessageModal } from '../../../shared/ui/molecules/ForwardMessageModal';
import { MessageSelectionBar } from '../../../shared/ui/molecules/MessageSelectionBar';
import { getPinnedMessagePreview } from '../../../shared/lib/utils/pinnedMessageHelpers';
import { UserAvatar } from '../../../shared/ui';
import { VoiceParticipantStatusIcons } from '../../../shared/ui/atoms/VoiceParticipantStatusIcons';
import { ChatVoiceCall } from '../../../shared/ui/molecules';
import { MemberListSidebar } from '../../../shared/ui/molecules/MemberListSidebar';
import ContextMenu from '../../../shared/ui/molecules/ContextMenu/ContextMenu';
import { ResizableSidebarShell } from '../../../shared/ui/molecules/ResizableSidebarShell';
import { memberListPanelWidthStorage } from '../../../shared/lib/utils/memberListPanelWidthStorage';
import { useMembers } from '../../../entities/member/hooks';
import { useRoles } from '../../../entities/role/hooks';
import { usePresenceOverrides } from '../../../shared/lib/hooks/usePresenceOverrides';
import { useServerHubConnection } from '../../../shared/lib/hooks/useServerHubConnection';
import {
  mapChatParticipantToListItem,
  mapServerMemberToChatParticipant,
  mapServerMemberToListItem,
} from '../../../shared/lib/utils/memberListUtils';
import { filterMembersWithChannelAccess, buildChannelAccessContext } from '../../../shared/lib/utils/channelAccessUtils';
import { serverApi } from '../../../entities/server/api/serverApi';
import {
  Call,
  Search,
  Mic,
  Stop,
  PushPin,
  Image as ImageIcon,
  Videocam,
  FolderZip,
  InsertDriveFile,
  BookmarkBorder,
  ReplyOutlined,
  ForwardOutlined,
  EditOutlined,
  DeleteOutline,
  ContentCopy,
  SaveAlt,
  CheckBoxOutlineBlank,
  CheckBox,
  CheckCircleOutlineTwoTone,
  People,
} from '@mui/icons-material';
import {
  canSendMessages,
  canAttachFiles,
  canSendVoiceMessages,
  canManageMessages,
  canManageRoles,
  canEditServerMemberNickname,
} from '../../../entities/role/lib/serverPermissions';
import ServerMemberNicknameModal from '../../../entities/member/ui/ServerMemberNicknameModal';
import ServerMemberRoleModal from '../../../entities/member/ui/ServerMemberRoleModal/ServerMemberRoleModal';
import { useFriends, useFriendRequests } from '../../../entities/friend';
import { getFriendActionForMember } from '../../../shared/lib/utils/friendActionForMember';
import { buildServerUserContextMenuItems } from '../../../shared/lib/utils/buildServerUserContextMenuItems';
import { buildDmContextMenuItems } from '../../../shared/lib/utils/buildDmContextMenuItems';
import { inviteUserToServer } from '../../../shared/lib/utils/inviteUserToServer';
import { insertTextAtCursor } from '../../../shared/lib/utils/insertTextAtCursor';
import { useUserBlocks } from '../../../shared/lib/contexts/UserBlockContext';
import { muteChat, unmuteChat, isChatMuted } from '../../../shared/lib/utils/chatMuteStore';
import SendIcon from '../../../shared/ui/atoms/SendIcon';
import StickerIcon from '../../../shared/ui/atoms/StickerIcon';
import './ChatRoom.css';

const MESSAGE_COMPOSER_LINE_HEIGHT_PX = 22;
const MESSAGE_COMPOSER_MAX_LINES = 7;
const MESSAGE_COMPOSER_MAX_HEIGHT_PX = MESSAGE_COMPOSER_LINE_HEIGHT_PX * MESSAGE_COMPOSER_MAX_LINES;

function syncComposerInset(container) {
  const main = container?.closest('.chat-room-main');
  if (!main || !container) return;

  const height = `${container.offsetHeight}px`;
  main.style.setProperty('--chat-composer-inset', height);
  if (main.classList.contains('is-replying') || main.classList.contains('is-editing')) {
    main.style.setProperty('--chat-composer-inset-expanded', height);
  }
}

function resizeMessageComposerTextarea(textarea) {
  if (!textarea) return;

  const isExpanded = textarea.value.includes('\n');
  textarea.classList.toggle('message-input--expanded', isExpanded);

  textarea.style.height = 'auto';
  const scrollHeight = textarea.scrollHeight;
  const nextHeight = Math.min(scrollHeight, MESSAGE_COMPOSER_MAX_HEIGHT_PX);
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = scrollHeight > MESSAGE_COMPOSER_MAX_HEIGHT_PX ? 'auto' : 'hidden';
}

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
  serverChannelCategories = null,
  serverChannelFallback = null,
  isSavedMessages = false,
  savedMessagesChatId = null,
  /** When messages load/update; parent debounces the server «mark chat read» call */
  onMessagesActivity,
  isPinned = false,
  pinChat,
  unpinChat,
}) => {
  const { user } = useAuthContext();
  const connectionContext = useConnectionContext();
  const getConnection = connectionContext?.getConnection;
  const navigate = useNavigate();
  const username = user?.username;
  const userDisplayName = user?.displayName ?? user?.DisplayName ?? null;
  const userId = user?.id || user?.userId;
  const { openProfile, openOwnProfile } = useProfileModal();
  const { markChatAsRead } = useNotificationContext();
  const { servers } = useServerContext();
  const isDirectChat = chatTypeId === 1 || (!isGroupChat && !isServerChat);
  const [chatUserProfile, setChatUserProfile] = useState(null);
  const directPeerUserId = useMemo(() => (
    isDirectChat
      ? (chatUserProfile?.otherUserId ?? chatUserProfile?.userId ?? chatUserProfile?.UserId ?? null)
      : null
  ), [isDirectChat, chatUserProfile]);
  const e2eMemberIdsRef = useRef(userId ? [String(userId)] : []);
  const [e2eMembersVersion, setE2eMembersVersion] = useState(0);
  const getE2eMemberUserIds = useCallback(() => e2eMemberIdsRef.current, []);

  const isMessageOwn = useCallback(
    (message) => {
      const senderId = message?.senderId ?? message?.SenderId;
      if (senderId != null && userId != null) {
        return String(senderId) === String(userId);
      }
      return message?.senderUsername === username;
    },
    [userId, username],
  );

  const handleOpenAuthorProfile = useCallback(
    (message) => {
      const authorId = message?.senderId ?? message?.SenderId;
      if (!authorId) return;
      if (String(authorId) === String(userId)) {
        openOwnProfile(message?.senderStatus ?? message?.SenderStatus ?? null);
        return;
      }
      openProfile(
        authorId,
        message?.senderUsername,
        message?.senderStatus ?? message?.SenderStatus ?? null,
      );
    },
    [openProfile, openOwnProfile, userId],
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
    fetchOlderMessagesForSearchAsync,
    ensureMessageLoaded,
  } = useChat(chatId, username, userId, userDisplayName, {
    e2eEnabled: true,
    getMemberUserIds: getE2eMemberUserIds,
    peerUserId: directPeerUserId,
    e2eMembersVersion,
    strictAllMembers: false,
  });

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
  const canCreatePoll = !isSavedMessages && !isDirectChat && (isGroupChat || isServerChat);
  const [isPollModalOpen, setPollModalOpen] = useState(false);
  const [isMessageSearchOpen, setMessageSearchOpen] = useState(false);
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);

  useEffect(() => {
    if (!canCreatePoll) {
      setPollModalOpen(false);
    }
  }, [canCreatePoll, chatId]);

  const messagesTailKey = useMemo(() => {
    if (!messages?.length) return '0:';
    const tail = messages[messages.length - 1];
    const mid = tail?.messageId ?? tail?.MessageId ?? tail?.id ?? tail?.Id ?? '';
    return `${messages.length}:${mid}`;
  }, [messages]);

  const messageTimelineItems = useMemo(
    () => buildMessagesWithDateSeparators(messages),
    [messages],
  );


  useEffect(() => {
    if (!chatId || typeof onMessagesActivity !== 'function') return;
    onMessagesActivity(chatId);
  }, [chatId, messagesTailKey, onMessagesActivity]);

  const {
    searchQuery,
    searchResults,
    isSearching,
    isSearchingHistory,
    searchMessages,
    clearSearch,
    scrollToMessage
  } = useMessageSearch(messages, {
    fetchOlderMessagesForSearchAsync,
    ensureMessageLoaded,
  });

  const handleCloseMessageSearch = useCallback(() => {
    clearSearch();
    setMessageSearchOpen(false);
  }, [clearSearch]);

  const handleSearchResultClick = useCallback(async (messageId) => {
    await scrollToMessage(messageId);
    handleCloseMessageSearch();
  }, [handleCloseMessageSearch, scrollToMessage]);

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
    isUploadProcessing,
    isRecordingVideoNote,
    videoNoteRecordingTime,
    handleVideoNoteRecording,
    cancelVideoNoteRecording
  } = useMediaHandlers(connection, chatId, userId, username);

  const {
    contextMenu,
    handleContextMenu,
    closeContextMenu
  } = useContextMenu();

  const contextMenuRef = useRef(null);
  const contextMenuPosition = useClampedMenuPosition(
    contextMenu.visible && contextMenu.type === 'message',
    { x: contextMenu.x, y: contextMenu.y },
    contextMenuRef,
    { avoidSelector: '.input-container' },
  );

  const {
    forwardModalVisible,
    startForward,
    closeForwardModal,
    forwardToSelected,
    modalProps,
  } = useMessageForward(chatId);

  const {
    isSelectionMode,
    selectedCount,
    enterSelectionMode,
    exitSelectionMode,
    toggleMessage: toggleSelectedMessage,
    isMessageSelected,
    getSelectedMessages,
  } = useMessageSelection();

  const [newMessage, setNewMessage] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const hasComposerText = newMessage.trim().length > 0;
  const showSendAction = hasComposerText || Boolean(editingMessageId);
  const showMicAction = canVoice && !editingMessageId && !hasComposerText;
  const [replyingToMessage, setReplyingToMessage] = useState(null);

  const fileDragDepthRef = useRef(0);
  const [isFileDragOver, setIsFileDragOver] = useState(false);

  const canAcceptFileDrop = Boolean(
    chatId && canAttach && canSend && !editingMessageId && !isSavedMessages && !uploadingFile,
  );

  const isExternalFileDrag = useCallback((dataTransfer) => {
    if (!dataTransfer) return false;
    return Array.from(dataTransfer.types || []).includes('Files');
  }, []);

  const resetFileDragState = useCallback(() => {
    fileDragDepthRef.current = 0;
    setIsFileDragOver(false);
  }, []);

  const handleChatFileDragEnter = useCallback(
    (event) => {
      if (!canAcceptFileDrop || !isExternalFileDrag(event.dataTransfer)) return;
      event.preventDefault();
      fileDragDepthRef.current += 1;
      setIsFileDragOver(true);
    },
    [canAcceptFileDrop, isExternalFileDrag],
  );

  const handleChatFileDragLeave = useCallback((event) => {
    if (fileDragDepthRef.current === 0) return;
    event.preventDefault();
    fileDragDepthRef.current = Math.max(0, fileDragDepthRef.current - 1);
    if (fileDragDepthRef.current === 0) {
      setIsFileDragOver(false);
    }
  }, []);

  const handleChatFileDragOver = useCallback(
    (event) => {
      if (!canAcceptFileDrop || !isExternalFileDrag(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    [canAcceptFileDrop, isExternalFileDrag],
  );

  const handleChatFileDrop = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      resetFileDragState();

      if (!canAcceptFileDrop) return;

      const files = Array.from(event.dataTransfer?.files || []);
      if (files.length > 0) {
        queueMediaSend(files);
      }
    },
    [canAcceptFileDrop, queueMediaSend, resetFileDragState],
  );

  useEffect(() => {
    window.addEventListener('dragend', resetFileDragState);
    return () => window.removeEventListener('dragend', resetFileDragState);
  }, [resetFileDragState]);

  useEffect(() => {
    if (!canAcceptFileDrop) {
      resetFileDragState();
    }
  }, [canAcceptFileDrop, resetFileDragState]);

  const [isPrivateChat, setIsPrivateChat] = useState(false);
  const [otherUserInCall] = useState(false);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [chatInfoMediaFiles, setChatInfoMediaFiles] = useState([]);
  const [chatInfoMediaLoading, setChatInfoMediaLoading] = useState(false);
  const [chatParticipants, setChatParticipants] = useState([]);
  const [existingCallParticipants, setExistingCallParticipants] = useState([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showCallTypeSelector, setShowCallTypeSelector] = useState(false);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [stickerPanelWidth, setStickerPanelWidth] = useState(380);
  const [isSendingSticker, setIsSendingSticker] = useState(false);
  const [showMemberList, setShowMemberList] = useState(true);
  const [nicknameEditorMember, setNicknameEditorMember] = useState(null);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [authorContextMenu, setAuthorContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    authorId: null,
    authorName: '',
    authorStatus: null,
  });
  const [roleModal, setRoleModal] = useState({
    open: false,
    x: 0,
    y: 0,
    member: null,
  });
  const [kickTargetMember, setKickTargetMember] = useState(null);
  const notificationConnectionRef = useRef(null);

  const serverConnection = useServerHubConnection(isServerChat ? serverId : null);
  const {
    members: serverMembers,
    isLoading: serverMembersLoading,
    updateMemberNickname,
    openPrivateChat,
    kickMember,
    fetchMembers,
  } = useMembers(serverConnection, isServerChat ? serverId : null, userId);
  const {
    roles: serverRoles,
    fetchRoles: fetchServerRoles,
    assignRole,
    removeRole,
  } = useRoles(serverConnection, isServerChat ? serverId : null, userId);
  const { friends, fetchFriends, removeFriend } = useFriends();
  const { pendingRequests, sentRequests, sendRequest, acceptRequest } = useFriendRequests();
  const { blockUser, unblockUser, isUserBlocked } = useUserBlocks();
  const [muteRevision, setMuteRevision] = useState(0);
  const { resolveStatus, statusOverrides } = usePresenceOverrides();
  const [fetchedServerCategories, setFetchedServerCategories] = useState(null);
  const [liveChannelCategories, setLiveChannelCategories] = useState(null);

  useEffect(() => {
    setLiveChannelCategories(null);
  }, [serverChannelCategories, serverId, chatId]);

  const refreshServerChannelCategories = useCallback(() => {
    if (!serverId) return;
    serverApi
      .getServerById(serverId)
      .then((data) => {
        setLiveChannelCategories(data?.categories ?? data?.Categories ?? []);
      })
      .catch(() => {});
  }, [serverId]);

  useEffect(() => {
    if (!isServerChat || !serverId || !chatId) {
      setFetchedServerCategories(null);
      return undefined;
    }

    if (Array.isArray(serverChannelCategories) && serverChannelCategories.length > 0) {
      setFetchedServerCategories(null);
      return undefined;
    }

    let cancelled = false;
    serverApi
      .getServerById(serverId)
      .then((data) => {
        if (!cancelled) {
          setFetchedServerCategories(data?.categories ?? data?.Categories ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetchedServerCategories([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isServerChat, serverId, chatId, serverChannelCategories]);

  const channelAccessContext = useMemo(() => {
    if (!isServerChat || !chatId) return null;

    const categories =
      liveChannelCategories
      ?? (Array.isArray(serverChannelCategories) && serverChannelCategories.length > 0
        ? serverChannelCategories
        : fetchedServerCategories);

    return buildChannelAccessContext(
      categories?.length ? { categories } : null,
      chatId,
      serverChannelFallback,
    );
  }, [
    isServerChat,
    chatId,
    liveChannelCategories,
    serverChannelCategories,
    fetchedServerCategories,
    serverChannelFallback,
  ]);

  const isChannelAccessPending = Boolean(
    isServerChat
      && serverId
      && chatId
      && !channelAccessContext
      && (!Array.isArray(serverChannelCategories) || serverChannelCategories.length === 0)
      && fetchedServerCategories === null,
  );

  useEffect(() => {
    if (isServerChat && serverConnection && serverId) {
      fetchServerRoles();
    }
  }, [isServerChat, serverConnection, serverId, fetchServerRoles]);

  useEffect(() => {
    if (!isServerChat || !serverConnection || !serverId || !chatId) {
      return undefined;
    }

    const matchesCurrentChannel = (eventServerId, eventChannelId) =>
      String(eventServerId) === String(serverId) && String(eventChannelId) === String(chatId);

    const handleChannelAccessChanged = (eventServerId, eventChannelId) => {
      if (!matchesCurrentChannel(eventServerId, eventChannelId)) return;
      refreshServerChannelCategories();
      void fetchMembers();
    };

    const handleChatUpdated = (updatedChat) => {
      const updatedChatId = updatedChat?.chatId ?? updatedChat?.ChatId;
      if (String(updatedChatId) !== String(chatId)) return;
      refreshServerChannelCategories();
    };

    serverConnection.on('ChannelMemberAdded', handleChannelAccessChanged);
    serverConnection.on('ChannelMemberRemoved', handleChannelAccessChanged);
    serverConnection.on('ChatUpdated', handleChatUpdated);

    return () => {
      serverConnection.off('ChannelMemberAdded', handleChannelAccessChanged);
      serverConnection.off('ChannelMemberRemoved', handleChannelAccessChanged);
      serverConnection.off('ChatUpdated', handleChatUpdated);
    };
  }, [
    isServerChat,
    serverConnection,
    serverId,
    chatId,
    refreshServerChannelCategories,
    fetchMembers,
  ]);

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

  const handleEmojiSelect = useCallback((emoji) => {
    const textarea = inputRef.current;
    if (!textarea) {
      setNewMessage((prev) => `${prev}${emoji}`);
      return;
    }

    const nextValue = insertTextAtCursor(textarea, emoji);
    if (nextValue != null) {
      setNewMessage(nextValue);
      handleComposerTextChange(nextValue);
      resizeMessageComposerTextarea(textarea);
    }
    textarea.focus();
  }, [handleComposerTextChange]);

  const canEditMemberNickname = useCallback(
    (memberUserId) =>
      canEditServerMemberNickname(userPermissions, isServerOwner, userId, memberUserId),
    [userPermissions, isServerOwner, userId],
  );

  const resolveNicknameEditorMember = useCallback(
    (sidebarMember) => {
      const memberUserId = sidebarMember?.userId;
      if (memberUserId == null) return null;
      return (
        serverMembers.find((member) => String(member.userId) === String(memberUserId)) || {
          userId: memberUserId,
          username: sidebarMember.username,
          login: sidebarMember.login,
          nickname: sidebarMember.nickname,
        }
      );
    },
    [serverMembers],
  );

  const handleOpenNicknameEditor = useCallback(
    (sidebarMember) => {
      const member = resolveNicknameEditorMember(sidebarMember);
      if (!member || !canEditMemberNickname(member.userId)) return;
      setNicknameEditorMember(member);
      setNicknameDraft(member.nickname || '');
    },
    [resolveNicknameEditorMember, canEditMemberNickname],
  );

  const handleCloseNicknameEditor = useCallback(() => {
    setNicknameEditorMember(null);
    setNicknameDraft('');
  }, []);

  const closeAuthorContextMenu = useCallback(() => {
    setAuthorContextMenu({
      visible: false,
      x: 0,
      y: 0,
      authorId: null,
      authorName: '',
      authorStatus: null,
    });
  }, []);

  const closeRoleModal = useCallback(() => {
    setRoleModal({ open: false, x: 0, y: 0, member: null });
  }, []);

  const handleOpenPrivateChat = useCallback(
    async (targetUserId) => {
      try {
        const chatData = await openPrivateChat(targetUserId);
        const newChatId = chatData?.chatId ?? chatData?.ChatId;
        if (!newChatId) {
          throw new Error('Сервер не вернул идентификатор чата');
        }
        navigate(`/channels/@me/${newChatId}`);
      } catch (error) {
        alert(error?.message || 'Не удалось открыть личный чат');
      }
    },
    [openPrivateChat, navigate],
  );

  const handleAddFriend = useCallback(
    async (targetUserId) => {
      try {
        await sendRequest(targetUserId);
        await fetchFriends();
      } catch (error) {
        alert(error?.message || 'Не удалось отправить запрос в друзья');
      }
    },
    [sendRequest, fetchFriends],
  );

  const handleAcceptFriend = useCallback(
    async (friendshipId) => {
      try {
        await acceptRequest(friendshipId);
        await fetchFriends();
      } catch (error) {
        alert(error?.message || 'Не удалось принять запрос');
      }
    },
    [acceptRequest, fetchFriends],
  );

  const handleRemoveFriend = useCallback(
    async (targetUserId) => {
      try {
        await removeFriend(targetUserId);
        await fetchFriends();
      } catch (error) {
        alert(error?.message || 'Не удалось удалить из друзей');
      }
    },
    [removeFriend, fetchFriends],
  );

  const handleCopyUserId = useCallback(async (targetUserId) => {
    try {
      await navigator.clipboard.writeText(String(targetUserId));
    } catch {
      alert('Не удалось скопировать ID');
    }
  }, []);

  useEffect(() => {
    const onMuteChanged = () => setMuteRevision((value) => value + 1);
    window.addEventListener('chatMuteChanged', onMuteChanged);
    return () => window.removeEventListener('chatMuteChanged', onMuteChanged);
  }, []);

  const handleBlockUser = useCallback(async (targetUserId, targetUsername) => {
    if (!targetUserId) return;
    const displayName = targetUsername || 'пользователя';
    if (!window.confirm(`Заблокировать ${displayName}? Вы не сможете отправлять сообщения друг другу.`)) {
      return;
    }

    try {
      await blockUser(targetUserId);
    } catch (error) {
      alert(error?.message || 'Не удалось заблокировать пользователя');
    }
  }, [blockUser]);

  const handleUnblockUser = useCallback(async (targetUserId) => {
    if (!targetUserId) return;

    try {
      await unblockUser(targetUserId);
    } catch (error) {
      alert(error?.message || 'Не удалось разблокировать пользователя');
    }
  }, [unblockUser]);

  const openRoleModal = useCallback((member, x, y) => {
    setRoleModal({
      open: true,
      x: Math.max(8, x - 230),
      y,
      member,
    });
  }, []);

  const handleRoleToggle = useCallback(
    async (roleId, checked) => {
      if (!roleModal.member) return;
      try {
        if (checked) {
          await assignRole(roleModal.member.userId, roleId);
        } else {
          await removeRole(roleModal.member.userId, roleId);
        }
      } catch (error) {
        alert(error?.message || 'Не удалось обновить роль');
      }
    },
    [roleModal.member, assignRole, removeRole],
  );

  const handleConfirmKick = useCallback(async () => {
    if (!kickTargetMember) return;
    try {
      await kickMember(kickTargetMember.userId);
      setKickTargetMember(null);
    } catch (error) {
      alert(error?.message || 'Не удалось удалить участника с сервера');
    }
  }, [kickMember, kickTargetMember]);

  useEffect(() => {
    if (!roleModal.member) return;
    const updatedMember = serverMembers.find(
      (member) => String(member.userId) === String(roleModal.member.userId),
    );
    if (updatedMember) {
      setRoleModal((prev) => ({ ...prev, member: updatedMember }));
    }
  }, [serverMembers, roleModal.member?.userId]);

  const resolveMemberFromAuthor = useCallback(
    (authorId, authorName, authorStatus) => {
      if (authorId == null) return null;
      const serverMember = serverMembers.find(
        (member) => String(member.userId) === String(authorId),
      );
      return (
        serverMember || {
          userId: authorId,
          username: authorName,
          login: null,
          nickname: null,
          status: authorStatus,
        }
      );
    },
    [serverMembers],
  );

  const buildDmMenuItems = useCallback(
    (targetUserId, targetUsername, targetStatus = null) => {
      if (targetUserId == null) return [];

      const friendAction = getFriendActionForMember(targetUserId, {
        userId,
        friends,
        pendingRequests,
        sentRequests,
      });

      return buildDmContextMenuItems({
        chatId,
        targetUserId,
        targetUsername: targetUsername || groupName || 'пользователя',
        hasUnread: false,
        isPinned,
        isBlocked: isUserBlocked(targetUserId),
        isMuted: isChatMuted(chatId),
        friendAction,
        servers: servers || [],
        handlers: {
          onMarkAsRead: () => markChatAsRead(chatId),
          onPin: typeof pinChat === 'function' ? () => { void pinChat(chatId); } : undefined,
          onUnpin: typeof unpinChat === 'function' ? () => { void unpinChat(chatId); } : undefined,
          onProfile: () => openProfile(targetUserId, targetUsername, targetStatus),
          onStartCall: () => setShowCallTypeSelector(true),
          onInviteToServer: (serverId) => {
            void inviteUserToServer(serverId, targetUserId)
              .then(() => alert('Пользователь приглашён на сервер'))
              .catch((error) => alert(error?.message || 'Не удалось пригласить на сервер'));
          },
          onRemoveFriend:
            friendAction?.kind === 'friend'
              ? () => {
                  void handleRemoveFriend(targetUserId);
                }
              : undefined,
          onBlock: () => { void handleBlockUser(targetUserId, targetUsername); },
          onUnblock: () => { void handleUnblockUser(targetUserId); },
          onMute: (duration) => muteChat(chatId, duration),
          onUnmute: () => unmuteChat(chatId),
          onCopyUserId: () => handleCopyUserId(targetUserId),
          onCopyChannelId: () => handleCopyUserId(chatId),
        },
      });
    },
    [
      chatId,
      groupName,
      isPinned,
      pinChat,
      unpinChat,
      userId,
      friends,
      pendingRequests,
      sentRequests,
      servers,
      markChatAsRead,
      openProfile,
      handleRemoveFriend,
      handleCopyUserId,
      isUserBlocked,
      handleBlockUser,
      handleUnblockUser,
      muteRevision,
    ],
  );

  const buildUserContextMenuItems = useCallback(
    (targetMember, menuPosition = null) => {
      const memberUserId = targetMember?.userId;
      if (memberUserId == null) return [];

      const friendAction = getFriendActionForMember(memberUserId, {
        userId,
        friends,
        pendingRequests,
        sentRequests,
      });
      const canEditNick = isServerChat && canEditMemberNickname(memberUserId);
      const canManageMemberRoles =
        isServerChat && (isServerOwner || canManageRoles(userPermissions, isServerOwner));
      const canKick =
        isServerChat &&
        (isServerOwner || userPermissions?.kickMembers) &&
        String(memberUserId) !== String(userId);
      const resolvedMember = resolveNicknameEditorMember(targetMember);

      return buildServerUserContextMenuItems({
        targetUserId: memberUserId,
        currentUserId: userId,
        friendAction,
        isServerContext: isServerChat,
        canEditNickname: canEditNick,
        canManageRoles: canManageMemberRoles,
        canKick,
        handlers: {
          onProfile: () =>
            openProfile(memberUserId, targetMember.username, targetMember.status),
          onMessage: () => handleOpenPrivateChat(memberUserId),
          onAddFriend: () => handleAddFriend(memberUserId),
          onAcceptFriend: handleAcceptFriend,
          onRemoveFriend: () => handleRemoveFriend(memberUserId),
          onEditNickname: () => {
            if (resolvedMember) {
              handleOpenNicknameEditor(resolvedMember);
            }
          },
          onManageRoles: () => {
            if (resolvedMember && menuPosition) {
              openRoleModal(resolvedMember, menuPosition.x, menuPosition.y);
            }
          },
          onKick: () => {
            if (resolvedMember) {
              setKickTargetMember(resolvedMember);
            }
          },
          onCopyId: () => handleCopyUserId(memberUserId),
        },
      });
    },
    [
      userId,
      friends,
      pendingRequests,
      sentRequests,
      isServerChat,
      canEditMemberNickname,
      isServerOwner,
      userPermissions,
      resolveNicknameEditorMember,
      openProfile,
      handleOpenPrivateChat,
      handleAddFriend,
      handleAcceptFriend,
      handleRemoveFriend,
      handleOpenNicknameEditor,
      openRoleModal,
      handleCopyUserId,
    ],
  );

  const getUserContextMenuItems = useCallback(
    (member, menuPosition) => buildUserContextMenuItems(member, menuPosition),
    [buildUserContextMenuItems],
  );

  const handleAuthorContextMenu = useCallback(
    (event, message) => {
      if (isSelectionMode || isSavedMessages) return;

      const authorId = message?.senderId ?? message?.SenderId;
      if (!authorId) return;

      const isSelf = String(authorId) === String(userId);
      if (isSelf && !isServerChat) return;

      event.preventDefault();
      event.stopPropagation();
      closeContextMenu();

      setAuthorContextMenu({
        visible: true,
        x: event.clientX,
        y: event.clientY,
        authorId,
        authorName: message?.senderUsername || message?.SenderUsername || '',
        authorStatus: message?.senderStatus ?? message?.SenderStatus ?? null,
      });
    },
    [isSelectionMode, isSavedMessages, userId, isServerChat, closeContextMenu],
  );

  const handlePrivateChatHeaderContextMenu = useCallback(
    (event) => {
      if (!isPrivateChat || isServerChat || isSavedMessages) return;

      const otherUserId =
        chatUserProfile?.otherUserId ??
        chatUserProfile?.userId ??
        chatUserProfile?.UserId;
      if (!otherUserId || String(otherUserId) === String(userId)) return;

      event.preventDefault();
      event.stopPropagation();
      closeContextMenu();

      setAuthorContextMenu({
        visible: true,
        x: event.clientX,
        y: event.clientY,
        authorId: otherUserId,
        authorName: groupName || chatUserProfile?.username || '',
        authorStatus: chatUserProfile?.status ?? null,
      });
    },
    [
      isPrivateChat,
      isServerChat,
      isSavedMessages,
      chatUserProfile,
      userId,
      groupName,
      closeContextMenu,
    ],
  );

  const authorContextMenuItems = useMemo(() => {
    if (!authorContextMenu.authorId) return [];

    if (isPrivateChat && !isServerChat) {
      return buildDmMenuItems(
        authorContextMenu.authorId,
        authorContextMenu.authorName,
        authorContextMenu.authorStatus,
      );
    }

    const member = resolveMemberFromAuthor(
      authorContextMenu.authorId,
      authorContextMenu.authorName,
      authorContextMenu.authorStatus,
    );
    if (!member) return [];
    return buildUserContextMenuItems(member, {
      x: authorContextMenu.x,
      y: authorContextMenu.y,
    });
  }, [authorContextMenu, isPrivateChat, isServerChat, buildDmMenuItems, resolveMemberFromAuthor, buildUserContextMenuItems]);

  const handleSaveServerNickname = useCallback(async () => {
    if (!nicknameEditorMember || !canEditMemberNickname(nicknameEditorMember.userId)) {
      alert('Недостаточно прав для изменения ника');
      return;
    }

    setNicknameSaving(true);
    try {
      const trimmed = nicknameDraft.trim();
      await updateMemberNickname(
        nicknameEditorMember.userId,
        trimmed.length > 0 ? trimmed : null,
      );
      handleCloseNicknameEditor();
    } catch (error) {
      alert(error?.message || 'Не удалось обновить серверный ник');
    } finally {
      setNicknameSaving(false);
    }
  }, [
    nicknameEditorMember,
    nicknameDraft,
    canEditMemberNickname,
    updateMemberNickname,
    handleCloseNicknameEditor,
  ]);

  const sidebarMembers = useMemo(() => {
    if (isServerChat) {
      if (isChannelAccessPending) {
        return [];
      }

      const accessibleMembers = filterMembersWithChannelAccess(
        serverMembers || [],
        channelAccessContext?.channel ?? null,
        serverOwnerId,
        channelAccessContext?.category ?? null,
      );
      return accessibleMembers.map((member) =>
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
    channelAccessContext,
    isChannelAccessPending,
    chatParticipants,
    serverOwnerId,
    resolveStatus,
    statusOverrides,
    serverRoles,
  ]);

  const chatInfoParticipants = useMemo(() => {
    if (isPrivateChat) return [];

    if (isServerChat) {
      if (chatParticipants?.length > 0) {
        return chatParticipants;
      }
      return (serverMembers || []).map((member) =>
        mapServerMemberToChatParticipant(member, { resolveStatus })
      );
    }

    return chatParticipants || [];
  }, [isPrivateChat, isServerChat, chatParticipants, serverMembers, resolveStatus]);

  useEffect(() => {
    const ids = new Set();
    const add = (id) => {
      if (id != null && String(id).trim()) {
        ids.add(String(id));
      }
    };

    add(userId);

    if (isServerChat) {
      (chatParticipants || []).forEach((participant) => add(participant.userId ?? participant.UserId));
    } else if (isGroupChat) {
      (chatParticipants || []).forEach((participant) => add(participant.userId ?? participant.UserId));
    } else {
      add(directPeerUserId);
    }

    e2eMemberIdsRef.current = Array.from(ids);
    setE2eMembersVersion((value) => value + 1);
  }, [userId, directPeerUserId, chatParticipants, isServerChat, isGroupChat]);

  useEffect(() => {
    exitSelectionMode();
  }, [chatId, exitSelectionMode]);

  const inputRef = useRef(null);
  const inputContainerRef = useRef(null);

  const resizeMessageComposer = useCallback(() => {
    resizeMessageComposerTextarea(inputRef.current);
    syncComposerInset(inputContainerRef.current);
  }, []);

  useLayoutEffect(() => {
    resizeMessageComposer();
  }, [newMessage, replyingToMessage, editingMessageId, resizeMessageComposer]);

  useEffect(() => {
    const container = inputContainerRef.current;
    if (!container) return undefined;

    const observer = new ResizeObserver(() => {
      syncComposerInset(container);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [chatId]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key !== 'Escape') return;

      if (contextMenu.visible) {
        closeContextMenu();
        e.stopImmediatePropagation();
        return;
      }
      if (authorContextMenu.visible) {
        closeAuthorContextMenu();
        e.stopImmediatePropagation();
        return;
      }
      if (roleModal.open) {
        closeRoleModal();
        e.stopImmediatePropagation();
        return;
      }
      if (kickTargetMember) {
        setKickTargetMember(null);
        e.stopImmediatePropagation();
        return;
      }
      if (isSelectionMode) {
        exitSelectionMode();
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
    authorContextMenu.visible,
    closeAuthorContextMenu,
    roleModal.open,
    closeRoleModal,
    kickTargetMember,
    forwardModalVisible,
    closeForwardModal,
    showChatInfo,
    showAddUserModal,
    showCallTypeSelector,
    pendingMediaSend,
    stickerPickerOpen,
    editingMessageId,
    replyingToMessage,
    isSelectionMode,
    exitSelectionMode,
  ]);

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
            userId: chatInfo.otherUserId ?? chatInfo.OtherUserId ?? null,
            otherUserId: chatInfo.otherUserId ?? chatInfo.OtherUserId ?? null,
            username: chatInfo.name ?? chatInfo.Name ?? null,
            avatar: chatInfo.type === 'group' ? chatInfo.chatAvatar : chatInfo.avatar,
            avatarColor: chatInfo.type === 'group' ? chatInfo.chatAvatarColor : chatInfo.avatarColor,
            avatarDecoration: chatInfo.avatarDecoration ?? chatInfo.AvatarDecoration ?? null,
            status: chatInfo.userStatus ?? chatInfo.UserStatus ?? null,
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

    const handleGroupUpdated = (action) => {
      if (!showMemberList && !showChatInfo) return;
      if ((action === 'user_added' || action === 'user_removed') && connection && chatId) {
        connection.invoke('GetChatParticipants', chatId).catch((error) => {
          console.error('ChatRoom - Error reloading participants:', error);
        });
      }
    };

    const handleChatInfoReceived = (chatInfo) => {
      console.log('ChatRoom - Chat info received:', chatInfo);
      setChatUserProfile({
        userId: chatInfo.otherUserId ?? chatInfo.OtherUserId ?? null,
        otherUserId: chatInfo.otherUserId ?? chatInfo.OtherUserId ?? null,
        username: chatInfo.name ?? chatInfo.Name ?? null,
        avatar: chatInfo.type === 'group' ? chatInfo.chatAvatar : chatInfo.avatar,
        avatarColor: chatInfo.type === 'group' ? chatInfo.chatAvatarColor : chatInfo.avatarColor,
        avatarDecoration: chatInfo.avatarDecoration ?? chatInfo.AvatarDecoration ?? null,
        status: chatInfo.userStatus ?? chatInfo.UserStatus ?? null,
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
    const shouldLoadParticipants = isGroupChat || isServerChat;
    if (!shouldLoadParticipants || isPrivateChat || !connection || !chatId) return;
    if (!showMemberList && !showChatInfo) return;

    console.log('ChatRoom - Loading participants via SignalR for chatId:', chatId);
    connection.invoke('GetChatParticipants', chatId).catch((error) => {
      console.error('ChatRoom - Error loading participants via SignalR:', error);
      if (!isServerChat) {
        setChatParticipants([]);
      }
    });
  }, [isGroupChat, isServerChat, isPrivateChat, chatId, connection, showMemberList, showChatInfo]);

  useEffect(() => {
    if (showChatInfo && connection && chatId) {
      console.log('ChatRoom - Loading chat info via SignalR for chatId:', chatId);
      connection.invoke("GetChatInfo", chatId).catch(error => {
        console.error('Error invoking GetChatInfo:', error);
      });

      if (!isPrivateChat && (isGroupChat || isServerChat)) {
        connection.invoke('GetChatParticipants', chatId).catch((error) => {
          console.error('ChatRoom - Error loading participants for chat info:', error);
        });
      }
    }
  }, [showChatInfo, chatId, connection, isPrivateChat, isGroupChat, isServerChat]);

  useEffect(() => {
    if (!isPrivateChat || isServerChat || !connection || !chatId) return;
    loadChatInfo();
  }, [isPrivateChat, isServerChat, connection, chatId, loadChatInfo]);

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
    const handleProfileUpdated = (event) => {
      const patch = event.detail;
      if (!patch?.userId) {
        return;
      }

      setChatUserProfile((prev) => patchChatUserProfileWithProfile(prev, patch));
      setChatParticipants((prev) =>
        prev.map((participant) => patchParticipantWithProfile(participant, patch)),
      );
    };

    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
  }, []);

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

  const callPreviewParticipants = existingCallParticipants;
  const usersAlreadyInCall = callPreviewParticipants.filter((participant) => {
    const participantId = participant.odUserId || participant.userId;
    return String(participantId) !== String(userId);
  });
  const hasJoinableCallInThisChat = !isCallActiveInThisChat && callPreviewParticipants.length > 0;
  const primaryJoinParticipant = usersAlreadyInCall[0] || callPreviewParticipants[0] || null;

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

    const content = newMessage.trim();
    const replySnapshot = replyingToMessage;

    if (editingMessageId) {
      const success = await editMessage(editingMessageId, content);
      if (success) {
        setEditingMessageId(null);
        setNewMessage('');
      }
      return;
    }

    setReplyingToMessage(null);
    setNewMessage('');

    const sent = sendMessage(content, replySnapshot?.messageId || null, null);
    if (!sent) {
      setNewMessage(content);
      setReplyingToMessage(replySnapshot);
    }
  }, [newMessage, replyingToMessage, editingMessageId, editMessage, sendMessage]);

  const handleComposerKeyDown = useCallback((event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;

    event.preventDefault();
    if (newMessage.trim()) {
      void handleSendMessage(event);
    }
  }, [newMessage, handleSendMessage]);

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

    const isOwn = isMessageOwn(message);
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

  const handleStartMessageSelection = useCallback((message) => {
    enterSelectionMode(message?.messageId);
    closeContextMenu();
  }, [enterSelectionMode, closeContextMenu]);

  const selectedMessages = useMemo(
    () => getSelectedMessages(messages),
    [getSelectedMessages, messages],
  );

  const deletableSelectedMessages = useMemo(
    () => filterDeletableMessages(selectedMessages, username, canModerateMessages),
    [selectedMessages, username, canModerateMessages],
  );

  const handleBatchForward = useCallback(() => {
    if (!selectedMessages.length) return;
    startForward(selectedMessages);
    exitSelectionMode();
  }, [selectedMessages, startForward, exitSelectionMode]);

  const handleBatchDelete = useCallback(async () => {
    if (!deletableSelectedMessages.length) return;

    const count = deletableSelectedMessages.length;
    const confirmed = window.confirm(
      count === 1 ? 'Удалить выбранное сообщение?' : `Удалить ${count} сообщений?`,
    );
    if (!confirmed) return;

    for (const message of deletableSelectedMessages) {
      await deleteMessage(message.messageId);
      if (editingMessageId === message.messageId) {
        setEditingMessageId(null);
        setNewMessage('');
      }
    }

    exitSelectionMode();
  }, [
    deletableSelectedMessages,
    deleteMessage,
    editingMessageId,
    exitSelectionMode,
  ]);

  const handleMessageSelectToggle = useCallback((event, messageId) => {
    if (!isSelectionMode) return;
    event.preventDefault();
    event.stopPropagation();
    toggleSelectedMessage(messageId);
  }, [isSelectionMode, toggleSelectedMessage]);

  const handleSaveToSaved = useCallback(async (message) => {
    if (!message?.messageId || !savedMessagesChatId) return;
    if (String(savedMessagesChatId) === String(chatId)) return;

    await forwardMessage(message.messageId, savedMessagesChatId);
    closeContextMenu();
  }, [savedMessagesChatId, chatId, forwardMessage, closeContextMenu]);

  const handleCopyMessageText = useCallback(async (message) => {
    try {
      await copyMessageText(message);
      closeContextMenu();
    } catch (error) {
      console.error('Failed to copy message text:', error);
      alert('Не удалось скопировать сообщение');
    }
  }, [closeContextMenu]);

  const handleCopyMessageImage = useCallback(async (message) => {
    const { images } = getMessageContextMenuActions(message);
    if (!images.length) return;

    try {
      await copyMediaFileToClipboard(images[0]);
      closeContextMenu();
    } catch (error) {
      console.error('Failed to copy image:', error);
      alert('Не удалось скопировать изображение');
    }
  }, [closeContextMenu]);

  const handleCopyMessageVideo = useCallback(async (message) => {
    const { videos } = getMessageContextMenuActions(message);
    if (!videos.length) return;

    try {
      await copyMediaFileToClipboard(videos[0]);
      closeContextMenu();
    } catch (error) {
      console.error('Failed to copy video:', error);
      alert('Не удалось скопировать видео');
    }
  }, [closeContextMenu]);

  const handleSaveMessageMedia = useCallback(async (message) => {
    const { savableMedia } = getMessageContextMenuActions(message);
    if (!savableMedia.length) return;

    closeContextMenu();

    try {
      await saveMessageMediaFiles(savableMedia);
    } catch (error) {
      console.error('Failed to save media:', error);
      alert('Не удалось сохранить файл');
    }
  }, [closeContextMenu]);

  const handleCreatePoll = async ({ question, options, allowMultiple, isAnonymous }) => {
    if (!canCreatePoll) return false;

    setIsCreatingPoll(true);
    try {
      return await createPoll({ question, options, allowMultiple, isAnonymous });
    } finally {
      setIsCreatingPoll(false);
    }
  };

  const handleContextMenuClick = (e, messageId) => {
    if (isSelectionMode) {
      e.preventDefault();
      return;
    }

    const message = messages.find(m => m.messageId === messageId);
    const isOwnMessage = isMessageOwn(message);
    const canDelete = isOwnMessage || canModerateMessages;
    const canEdit = isOwnMessage || canModerateMessages;

    handleContextMenu(e, messageId, isOwnMessage, canDelete, 'message', canEdit);
  };

  const startChatCall = useCallback((options = {}) => {
    const callData = {
      roomId: chatId.toString(),
      roomName: `Звонок с ${groupName}`,
      userName: username,
      userId: userId,
      isPrivateCall: true,
      chatId: chatId,
      withRinging: Boolean(options.withRinging),
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

    startChatCall({ withRinging: true });
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
      className={`group-chat-container ${isStickerPanelOpen ? 'has-sticker-panel' : ''}${isFileDragOver ? ' group-chat-container--file-drag-over' : ''}`}
      tabIndex={0}
      style={{ outline: 'none' }}
      onDragEnter={handleChatFileDragEnter}
      onDragLeave={handleChatFileDragLeave}
      onDragOver={handleChatFileDragOver}
      onDrop={handleChatFileDrop}
    >
      <div className="chat-header">
        <div className="header-left">
          <div
            className="user-info"
            onClick={() => setShowChatInfo(true)}
            onContextMenu={handlePrivateChatHeaderContextMenu}
          >
            <h2 className="username clickable-chat-title">{groupName}</h2>
          </div>
        </div>
        <div className="header-actions">
          {!isServerChat && !isSavedMessages && (isPrivateChat || isGroupChat) && !isCallActiveInThisChat && !hasJoinableCallInThisChat && (
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
          
          <button
            type="button"
            className="voice-call-button message-search-open-button"
            onClick={() => setMessageSearchOpen(true)}
            title="Поиск сообщений"
            aria-label="Поиск сообщений"
          >
            <Search style={{ fontSize: '20px' }} />
          </button>
        </div>
      </div>

      <div className="chat-room-body">
      <div className={`chat-room-main${replyingToMessage ? ' is-replying' : ''}${editingMessageId ? ' is-editing' : ''}`}>

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
            <div className={`join-preview-users-grid ${callPreviewParticipants.length === 1 ? 'single-user' : ''}`}>
              {callPreviewParticipants.slice(0, 8).map((participant) => {
                const participantMuted = !!participant?.isMuted;
                const participantDeafened = !!(
                  participant?.isGlobalAudioMuted ||
                  participant?.isAudioDisabled ||
                  participant?.isDeafened
                );
                const participantId = participant?.odUserId || participant?.userId;
                const isCurrentUserInPreview = String(participantId) === String(userId);

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
                        avatarDecoration={participant.avatarDecoration}
                        size={74}
                      />
                    </div>
                    <div className="join-preview-user-name">
                      {isCurrentUserInPreview ? 'Вы' : (participant.userName || 'User')}
                    </div>
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
              {callPreviewParticipants.length > 8 && (
                <div className="join-preview-user-more">+{callPreviewParticipants.length - 8}</div>
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

      <div className="chat-messages-panel">
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
        className={`messages${isSelectionMode ? ' messages--selection-mode' : ''}`}
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

        {!isLoading && messageTimelineItems.map((item) => {
          if (item.type === 'date') {
            return (
              <div key={item.key} className="message-date-separator" role="separator">
                <span className="message-date-separator__chip">{item.label}</span>
              </div>
            );
          }

          const msg = item.message;
          const isOwn = isMessageOwn(msg);
          const avatarIdentity = resolveMessageAvatarIdentity(msg, serverMembers);
          const isCallLog = isCallLogMessage(msg);

          if (isCallLog) {
            return (
              <div
                key={msg.messageId}
                id={`message-${msg.messageId}`}
                className="message message--call-log"
              >
                <CallLogMessage message={msg} currentUserId={userId} />
              </div>
            );
          }

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
                                <MessageMarkdown content={msg.forwardedMessage.content} />
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
                        <MessageMarkdown content={msg.content} />
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
                    <MessageMarkdown content={msg.content} />
                  </div>
                )}
                
                {!msg.forwardedMessage && !isStickerMessage && !isPollMessage && msg.mediaFiles?.length > 0 && (
                  <MessageMediaContent
                    mediaFiles={msg.mediaFiles}
                    timestamp={formatShortMessageTime(msg.createdAt)}
                    onVideoClick={(url) => window.open(url, '_blank', 'noopener,noreferrer')}
                    renderCaption={
                      hasTextContent
                        ? () => <MessageMarkdown content={msg.content} />
                        : null
                    }
                  />
                )}
            </>
          );

          const isSelected = isMessageSelected(msg.messageId);

          return (
            <div
              key={msg.messageId}
              id={`message-${msg.messageId}`}
              className={`message ${isOwn ? 'my-message' : 'user-message'} ${
                isStickerMessage ? 'message--sticker' : ''
              } ${isPollMessage ? 'message--poll' : ''} ${isMediaOnly ? 'message--media-only' : ''} ${
                msg.isPinned ? 'message--pinned' : ''
              } ${isSelectionMode ? 'message--selectable' : ''} ${
                isSelected ? 'message--selected' : ''
              }`}
              onContextMenu={(e) => handleContextMenuClick(e, msg.messageId)}
              onClick={(e) => handleMessageSelectToggle(e, msg.messageId)}
            >
              <div
                className="message-avatar-wrap"
                onContextMenu={(event) => handleAuthorContextMenu(event, msg)}
              >
                <UserAvatar
                  displayName={avatarIdentity.displayName}
                  login={avatarIdentity.login}
                  avatarUrl={msg.avatarUrl}
                  avatarColor={msg.avatarColor}
                  avatarDecoration={msg.avatarDecoration}
                  size={40}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (isSelectionMode) {
                      handleMessageSelectToggle(event, msg.messageId);
                      return;
                    }
                    handleOpenAuthorProfile(msg);
                  }}
                />
              </div>
              <div className="message-content">
                <div className="message-header">
                  <button
                    type="button"
                    className="message-username profile-open-trigger"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (isSelectionMode) {
                        handleMessageSelectToggle(event, msg.messageId);
                        return;
                      }
                      handleOpenAuthorProfile(msg);
                    }}
                    onContextMenu={(event) => handleAuthorContextMenu(event, msg)}
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
              {isSelectionMode && (
                <span className="message-select-toggle" aria-hidden="true">
                  {isSelected ? (
                    <CheckBox fontSize="small" />
                  ) : (
                    <CheckBoxOutlineBlank fontSize="small" />
                  )}
                </span>
              )}
            </div>
          );
        })}

        {/* Индикатор загрузки файла */}
        {uploadingFile && (
          <div className="message my-message uploading-message">
            <UserAvatar 
              displayName={userDisplayName}
              login={username}
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
                      {isUploadProcessing
                        ? `Обработка на сервере… ${uploadProgress}%`
                        : `Загрузка… ${uploadProgress}%`}
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
      </div>

      {contextMenu.visible && contextMenu.type === 'message' && createPortal(
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{
            position: 'fixed',
            left: `${contextMenuPosition.x}px`,
            top: `${contextMenuPosition.y}px`,
            zIndex: 10000,
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
            onClick={() => handleStartMessageSelection(
              messages.find((m) => m.messageId === contextMenu.messageId),
            )}
            className="context-menu-button"
          >
            <span className="context-menu-button-icon" aria-hidden="true">
              <CheckCircleOutlineTwoTone fontSize="inherit" />
            </span>
            Выбрать
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
          {(() => {
            const message = messages.find((m) => m.messageId === contextMenu.messageId);
            const {
              canCopyText,
              canCopyImage,
              canCopyVideo,
              canSaveAs,
            } = getMessageContextMenuActions(message);

            return (
              <>
                {canCopyText && (
                  <button
                    onClick={() => void handleCopyMessageText(message)}
                    className="context-menu-button"
                  >
                    <span className="context-menu-button-icon" aria-hidden="true">
                      <ContentCopy fontSize="inherit" />
                    </span>
                    Скопировать
                  </button>
                )}
                {canCopyImage && (
                  <button
                    onClick={() => void handleCopyMessageImage(message)}
                    className="context-menu-button"
                  >
                    <span className="context-menu-button-icon" aria-hidden="true">
                      <ContentCopy fontSize="inherit" />
                    </span>
                    Скопировать изображение
                  </button>
                )}
                {canCopyVideo && (
                  <button
                    onClick={() => void handleCopyMessageVideo(message)}
                    className="context-menu-button"
                  >
                    <span className="context-menu-button-icon" aria-hidden="true">
                      <ContentCopy fontSize="inherit" />
                    </span>
                    Скопировать видео
                  </button>
                )}
                {canSaveAs && (
                  <button
                    onClick={() => void handleSaveMessageMedia(message)}
                    className="context-menu-button"
                  >
                    <span className="context-menu-button-icon" aria-hidden="true">
                      <SaveAlt fontSize="inherit" />
                    </span>
                    Сохранить как
                  </button>
                )}
              </>
            );
          })()}
          {savedMessagesChatId && String(savedMessagesChatId) !== String(chatId) && (
            <button
              onClick={() => {
                void handleSaveToSaved(messages.find((m) => m.messageId === contextMenu.messageId));
              }}
              className="context-menu-button"
            >
              <span className="context-menu-button-icon" aria-hidden="true">
                <BookmarkBorder fontSize="inherit" />
              </span>
              Сохранить в избранное
            </button>
          )}
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
        </div>,
        document.body,
      )}

      {isSelectionMode ? (
        <MessageSelectionBar
          selectedCount={selectedCount}
          canForward={selectedMessages.length > 0}
          canDelete={deletableSelectedMessages.length > 0}
          onCancel={exitSelectionMode}
          onForward={handleBatchForward}
          onDelete={() => void handleBatchDelete()}
        />
      ) : (canSend || editingMessageId || !isServerChat) && (
      <form
        ref={inputContainerRef}
        className={`input-container${replyingToMessage ? ' replying' : ''}${editingMessageId ? ' editing' : ''}`}
        onSubmit={handleSendMessage}
      >
        <>
        {editingMessageId && (
          <div className="editing-notice">
            <span className='editing-text'>Редактирование сообщения</span>
            <button 
              type="button"
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
              type="button"
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
          <div className="chat-composer">
            {!editingMessageId && canAttach && (
              <ChatAttachMenu
                disabled={!canSend}
                usePlusIcon
                triggerClassName="chat-composer__action-btn chat-composer__action-btn--attach"
                onMediaSelect={queueMediaSend}
                onDocumentSelect={queueMediaSend}
                canCreatePoll={canCreatePoll}
                onPollClick={() => setPollModalOpen(true)}
              />
            )}

            <textarea
              ref={inputRef}
              rows={1}
              value={newMessage}
              onChange={(e) => {
                const value = e.target.value;
                setNewMessage(value);
                handleComposerTextChange(value);
              }}
              onKeyDown={handleComposerKeyDown}
              placeholder={
                editingMessageId
                  ? 'Редактируйте сообщение...'
                  : replyingToMessage
                    ? 'Напишите ответ...'
                    : groupName
                      ? `Написать #${groupName}`
                      : 'Написать сообщение...'
              }
              className="message-input no-focus-outline"
              autoComplete="off"
              spellCheck={true}
            />

            <div className="chat-composer__actions">
              {showSendAction ? (
                <button
                  type="submit"
                  className="chat-composer__action-btn chat-composer__action-btn--send"
                  title={editingMessageId ? 'Сохранить' : 'Отправить'}
                  disabled={!newMessage.trim()}
                >
                  <SendIcon className="chat-composer__send-icon" />
                </button>
              ) : showMicAction ? (
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
                    className={`chat-composer__action-btn chat-composer__action-btn--mic ${isRecording ? 'chat-composer__action-btn--recording' : ''}`}
                    title={isRecording ? 'Нажмите для остановки и отправки' : 'Записать голосовое сообщение'}
                  >
                    {isRecording ? <Stop fontSize="small" /> : <Mic fontSize="small" />}
                  </button>
                </div>
              ) : null}

              {!editingMessageId && (
                <button
                  type="button"
                  onClick={handleStickerPickerToggle}
                  className={`chat-composer__action-btn chat-composer__action-btn--sticker ${isStickerPanelOpen ? 'chat-composer__action-btn--active' : ''}`}
                  title="Эмодзи и стикеры"
                  disabled={isSendingSticker}
                >
                  <StickerIcon className="chat-composer__sticker-icon" />
                </button>
              )}
            </div>
          </div>
          </>
        )}
        </>
      </form>
      )}
      </div>

      {showMembersSidebar && (
        <ResizableSidebarShell
          widthStorage={memberListPanelWidthStorage}
          handleEdge="left"
        >
          <MemberListSidebar
            members={sidebarMembers}
            isLoading={isServerChat ? (serverMembersLoading || isChannelAccessPending) : false}
            emptyLabel={isServerChat ? 'Нет участников с доступом к каналу' : 'Участники группы не найдены'}
            groupByRoles={isServerChat}
            serverRoles={isServerChat ? serverRoles : []}
            getUserContextMenuItems={getUserContextMenuItems}
          />
        </ResizableSidebarShell>
      )}

      <StickerPicker
        open={isStickerPanelOpen}
        width={stickerPanelWidth}
        onResizeStart={handleStickerPanelResizeStart}
        onClose={() => setStickerPickerOpen(false)}
        onStickerSelect={handleSendSticker}
        onEmojiSelect={handleEmojiSelect}
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
          isUploadProcessing={isUploadProcessing}
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

      <MessageSearchModal
        open={isMessageSearchOpen}
        onClose={handleCloseMessageSearch}
        searchQuery={searchQuery}
        searchResults={searchResults}
        isSearching={isSearching}
        isSearchingHistory={isSearchingHistory}
        onSearch={searchMessages}
        onClearSearch={clearSearch}
        onScrollToMessage={handleSearchResultClick}
      />

      <ChatInfoModal 
        open={showChatInfo}
        onClose={() => setShowChatInfo(false)}
        chatInfo={{
          chatId: chatId,
          name: groupName || 'Чат',
          type: isPrivateChat ? 'private' : 'group',
          avatar: chatUserProfile?.avatar,
          avatarColor: chatUserProfile?.avatarColor,
          avatarDecoration: chatUserProfile?.avatarDecoration,
          status: chatUserProfile?.status,
          banner: chatUserProfile?.banner ?? null,
          chatAvatar: chatUserProfile?.avatar,
          chatAvatarColor: chatUserProfile?.avatarColor
        }}
        mediaFiles={chatInfoMediaFiles}
        mediaFilesLoading={chatInfoMediaLoading}
        participants={chatInfoParticipants}
        participantsLoading={isServerChat ? serverMembersLoading : false}
        canAddParticipants={isGroupChat && !isServerChat}
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

      {canCreatePoll && (
        <CreatePollModal
          isOpen={isPollModalOpen}
          onClose={() => setPollModalOpen(false)}
          onSubmit={handleCreatePoll}
          isSubmitting={isCreatingPoll}
        />
      )}

      <ServerMemberNicknameModal
        open={Boolean(nicknameEditorMember)}
        member={nicknameEditorMember}
        currentUserId={userId}
        nicknameDraft={nicknameDraft}
        saving={nicknameSaving}
        onDraftChange={setNicknameDraft}
        onSave={handleSaveServerNickname}
        onClose={handleCloseNicknameEditor}
      />

      <ServerMemberRoleModal
        open={roleModal.open}
        position={{ x: roleModal.x, y: roleModal.y }}
        member={roleModal.member}
        roles={serverRoles}
        onClose={closeRoleModal}
        onToggleRole={handleRoleToggle}
      />

      {kickTargetMember && (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setKickTargetMember(null);
            }
          }}
        >
          <div className="modal-content call-mode-modal">
            <h3>Удалить с сервера</h3>
            <p>
              Вы уверены, что хотите удалить {kickTargetMember.username} с сервера?
            </p>
            <div className="call-mode-actions">
              <button
                type="button"
                className="call-mode-button direct"
                onClick={() => setKickTargetMember(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="call-mode-button notify"
                onClick={() => void handleConfirmKick()}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      <ContextMenu
        isOpen={authorContextMenu.visible}
        position={{ x: authorContextMenu.x, y: authorContextMenu.y }}
        onClose={closeAuthorContextMenu}
        items={authorContextMenuItems}
      />

      {isFileDragOver && (
        <div className="chat-file-drop-overlay" aria-hidden="true">
          <div className="chat-file-drop-overlay__content">
            <span className="chat-file-drop-overlay__title">Отпустите, чтобы прикрепить файлы</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatRoom;