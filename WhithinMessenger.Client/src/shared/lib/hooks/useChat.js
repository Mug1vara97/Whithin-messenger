import { useState, useEffect, useRef, useCallback } from 'react';
import { HubConnectionBuilder } from '@microsoft/signalr';
import { BASE_URL } from '../constants/apiEndpoints';
import { MessageStatus } from '../../../entities/message/model/types';
import {
  isOwnMessage,
  normalizeMessageStatus,
  pickHigherMessageStatus,
} from '../utils/messageStatus';

const TYPING_IDLE_MS = 3000;
/** Повторный пинг, чтобы у получателя сбрасывался 5‑секундный таймер. */
const TYPING_HEARTBEAT_MS = 2000;
const TYPING_EXPIRE_MS = 5000;

export const formatTypingLabel = (users) => {
  if (!users?.length) return null;
  if (users.length === 1) return `${users[0].username} печатает…`;
  if (users.length === 2) return `${users[0].username} и ${users[1].username} печатают…`;
  return `${users.length} человек печатают…`;
};

export const useChat = (chatId, username, userId) => {
  const [messages, setMessages] = useState([]);
  const [connection, setConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [error, setError] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [pinnedMessages, setPinnedMessages] = useState([]);

  const connectionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const currentChatIdRef = useRef(null);
  const loadGenerationRef = useRef(0);
  const loadingOlderRef = useRef(false);
  const skipAutoScrollRef = useRef(false);
  const olderScrollSnapshotRef = useRef(null);
  const typingExpiryTimersRef = useRef(new Map());
  const typingIdleTimerRef = useRef(null);
  const typingHeartbeatRef = useRef(null);
  const lastTypingSentRef = useRef(false);

  const clearTypingHeartbeat = useCallback(() => {
    if (typingHeartbeatRef.current) {
      clearInterval(typingHeartbeatRef.current);
      typingHeartbeatRef.current = null;
    }
  }, []);

  const startTypingHeartbeat = useCallback(() => {
    clearTypingHeartbeat();
    typingHeartbeatRef.current = setInterval(() => {
      if (!connectionRef.current || !chatId || !username || !lastTypingSentRef.current) return;
      connectionRef.current.invoke('NotifyTyping', chatId, username).catch((err) => {
        console.warn('NotifyTyping heartbeat failed:', err);
      });
    }, TYPING_HEARTBEAT_MS);
  }, [chatId, username, clearTypingHeartbeat]);

  const clearTypingExpiryTimers = useCallback(() => {
    typingExpiryTimersRef.current.forEach((timer) => clearTimeout(timer));
    typingExpiryTimersRef.current.clear();
  }, []);

  const removeTypingUser = useCallback((typingUserId) => {
    const id = String(typingUserId);
    const timer = typingExpiryTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      typingExpiryTimersRef.current.delete(id);
    }
    setTypingUsers((prev) => prev.filter((user) => user.userId !== id));
  }, []);

  const addTypingUser = useCallback((typingUserId, typingUsername) => {
    const id = String(typingUserId);
    if (!id || id === String(userId)) return;

    setTypingUsers((prev) => {
      const filtered = prev.filter((user) => user.userId !== id);
      return [...filtered, { userId: id, username: typingUsername || 'Пользователь' }];
    });

    const existingTimer = typingExpiryTimersRef.current.get(id);
    if (existingTimer) clearTimeout(existingTimer);

    typingExpiryTimersRef.current.set(
      id,
      setTimeout(() => removeTypingUser(id), TYPING_EXPIRE_MS),
    );
  }, [removeTypingUser, userId]);

  const notifyStopTyping = useCallback(async () => {
    clearTypingHeartbeat();
    if (!connectionRef.current || !chatId || !lastTypingSentRef.current) return;
    try {
      await connectionRef.current.invoke('NotifyStopTyping', chatId);
    } catch (err) {
      console.warn('NotifyStopTyping failed:', err);
    } finally {
      lastTypingSentRef.current = false;
    }
  }, [chatId, clearTypingHeartbeat]);

  const notifyTyping = useCallback(() => {
    if (!connectionRef.current || !chatId || !username) return;

    if (!lastTypingSentRef.current) {
      connectionRef.current.invoke('NotifyTyping', chatId, username).catch((err) => {
        console.warn('NotifyTyping failed:', err);
      });
      lastTypingSentRef.current = true;
      startTypingHeartbeat();
    }

    if (typingIdleTimerRef.current) {
      clearTimeout(typingIdleTimerRef.current);
    }
    typingIdleTimerRef.current = setTimeout(() => {
      notifyStopTyping();
    }, TYPING_IDLE_MS);
  }, [chatId, username, notifyStopTyping, startTypingHeartbeat]);

  const handleComposerTextChange = useCallback((text) => {
    if (!text?.trim()) {
      if (typingIdleTimerRef.current) {
        clearTimeout(typingIdleTimerRef.current);
        typingIdleTimerRef.current = null;
      }
      notifyStopTyping();
      return;
    }
    notifyTyping();
  }, [notifyStopTyping, notifyTyping]);

  const acknowledgedDeliveriesRef = useRef(new Set());
  const pendingOptimisticIdRef = useRef(null);
  const pendingConfirmedMessageRef = useRef(null);

  const replaceOwnOptimisticMessage = useCallback((prev, confirmedMessage) => {
    const pendingId = pendingOptimisticIdRef.current;

    if (pendingId) {
      const pendingIndex = prev.findIndex((msg) => String(msg.messageId) === String(pendingId));
      if (pendingIndex >= 0) {
        pendingOptimisticIdRef.current = null;
        pendingConfirmedMessageRef.current = null;
        return prev.map((msg) => (
          String(msg.messageId) === String(pendingId)
            ? {
                ...confirmedMessage,
                status: pickHigherMessageStatus(MessageStatus.SENT, confirmedMessage.status),
              }
            : msg
        ));
      }
    }

    const optimisticIndex = prev.findIndex((msg) => (
      String(msg.messageId).startsWith('temp-')
      && msg.status === MessageStatus.SENDING
      && isOwnMessage(msg, userId, username)
    ));

    if (optimisticIndex >= 0) {
      pendingOptimisticIdRef.current = null;
      pendingConfirmedMessageRef.current = null;
      return prev.map((msg, index) => (
        index === optimisticIndex
          ? {
              ...confirmedMessage,
              status: pickHigherMessageStatus(MessageStatus.SENT, confirmedMessage.status),
            }
          : msg
      ));
    }

    return null;
  }, [userId, username]);

  const normalizeSticker = useCallback((raw) => {
    if (!raw) return null;
    return {
      id: raw.id ?? raw.Id ?? null,
      stickerPackId: raw.stickerPackId ?? raw.StickerPackId ?? null,
      filePath: raw.filePath ?? raw.FilePath ?? '',
      contentType: raw.contentType ?? raw.ContentType ?? 'image/webp',
      sortOrder: raw.sortOrder ?? raw.SortOrder ?? 0,
    };
  }, []);

  const normalizePoll = useCallback((raw) => {
    if (!raw) return null;
    return {
      id: raw.id ?? raw.Id ?? null,
      question: raw.question ?? raw.Question ?? '',
      allowMultiple: Boolean(raw.allowMultiple ?? raw.AllowMultiple),
      isAnonymous: Boolean(raw.isAnonymous ?? raw.IsAnonymous ?? true),
      totalVotes: raw.totalVotes ?? raw.TotalVotes ?? 0,
      votedOptionIds: (raw.votedOptionIds ?? raw.VotedOptionIds ?? []).map((id) => String(id)),
      options: (raw.options ?? raw.Options ?? []).map((option) => ({
        id: option.id ?? option.Id,
        text: option.text ?? option.Text ?? '',
        sortOrder: option.sortOrder ?? option.SortOrder ?? 0,
        voteCount: option.voteCount ?? option.VoteCount ?? 0,
        voters: (option.voters ?? option.Voters ?? []).map((voter) => ({
          userId: voter.userId ?? voter.UserId,
          username: voter.username ?? voter.Username ?? '',
          avatarUrl: voter.avatarUrl ?? voter.AvatarUrl ?? null,
          avatarColor: voter.avatarColor ?? voter.AvatarColor ?? null,
        })),
      })),
    };
  }, []);

  const normalizeMediaFile = useCallback((raw) => {
    if (!raw) return raw;
    return {
      ...raw,
      id: raw.id ?? raw.Id ?? null,
      filePath: raw.filePath ?? raw.FilePath ?? '',
      fileName: raw.fileName ?? raw.FileName ?? '',
      originalFileName: raw.originalFileName ?? raw.OriginalFileName ?? '',
      contentType: raw.contentType ?? raw.ContentType ?? '',
      fileSize: raw.fileSize ?? raw.FileSize ?? 0,
      thumbnailPath: raw.thumbnailPath ?? raw.ThumbnailPath ?? null,
      isVideoNote: raw.isVideoNote ?? raw.IsVideoNote ?? false,
      duration:
        raw.duration ??
        raw.Duration ??
        raw.durationSeconds ??
        raw.DurationSeconds ??
        null,
    };
  }, []);

  const normalizeForwardedMessage = useCallback((raw) => {
    if (!raw) return null;
    return {
      messageId: raw.messageId ?? raw.MessageId ?? null,
      senderUsername: raw.senderUsername ?? raw.SenderUsername ?? '',
      content: raw.content ?? raw.Content ?? raw.forwardedMessageContent ?? raw.ForwardedMessageContent ?? '',
      originalChatName: raw.originalChatName ?? raw.OriginalChatName ?? '',
      contentType: raw.contentType ?? raw.ContentType ?? null,
      sticker: normalizeSticker(raw.sticker ?? raw.Sticker),
      mediaFiles: (raw.mediaFiles ?? raw.MediaFiles ?? []).map(normalizeMediaFile),
    };
  }, [normalizeMediaFile, normalizeSticker]);

  const normalizeMessage = useCallback((msg, defaultStatus) => {
    if (!msg) return null;
    const senderId = msg.senderId ?? msg.SenderId ?? msg.userId ?? msg.UserId ?? null;
    const rawStatus = msg.status ?? msg.Status ?? defaultStatus;
    const own = isOwnMessage(
      { senderId, senderUsername: msg.senderUsername ?? msg.SenderUsername ?? msg.username ?? msg.UserName },
      userId,
      username,
    );

    return {
      messageId: msg.messageId ?? msg.MessageId ?? msg.id ?? msg.Id,
      senderId,
      senderUsername: msg.senderUsername ?? msg.SenderUsername ?? msg.username ?? msg.UserName ?? '',
      content: msg.content ?? msg.Content ?? '',
      contentType: msg.contentType ?? msg.ContentType ?? null,
      sticker: normalizeSticker(msg.sticker ?? msg.Sticker),
      avatarUrl: msg.avatarUrl ?? msg.AvatarUrl ?? null,
      avatarColor: msg.avatarColor ?? msg.AvatarColor ?? null,
      repliedMessage: msg.repliedMessage ?? msg.RepliedMessage ?? null,
      forwardedMessage: normalizeForwardedMessage(msg.forwardedMessage ?? msg.ForwardedMessage),
      createdAt: msg.createdAt ?? msg.CreatedAt ?? new Date().toISOString(),
      mediaFiles: (msg.mediaFiles ?? msg.MediaFiles ?? []).map(normalizeMediaFile),
      poll: normalizePoll(msg.poll ?? msg.Poll),
      isPinned: Boolean(msg.isPinned ?? msg.IsPinned),
      pinnedAt: msg.pinnedAt ?? msg.PinnedAt ?? null,
      isEdited: msg.isEdited ?? msg.IsEdited ?? false,
      status: own
        ? normalizeMessageStatus(rawStatus ?? MessageStatus.SENT)
        : null,
    };
  }, [normalizeForwardedMessage, normalizeMediaFile, normalizePoll, normalizeSticker, userId, username]);

  const isPersistedMessageId = useCallback((messageId) => (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(messageId ?? ''))
  ), []);

  const acknowledgeIncomingDelivery = useCallback(async (message) => {
    if (!connectionRef.current || !chatId || !message?.messageId) return;
    if (isOwnMessage(message, userId, username)) return;
    if (!isPersistedMessageId(message.messageId)) return;

    const deliveryKey = String(message.messageId);
    if (acknowledgedDeliveriesRef.current.has(deliveryKey)) return;

    acknowledgedDeliveriesRef.current.add(deliveryKey);
    try {
      await connectionRef.current.invoke('AcknowledgeDelivery', deliveryKey, String(chatId));
    } catch (err) {
      acknowledgedDeliveriesRef.current.delete(deliveryKey);
      console.warn('AcknowledgeDelivery failed:', err);
    }
  }, [chatId, isPersistedMessageId, userId, username]);

  const acknowledgeIncomingMessages = useCallback(async (incomingMessages) => {
    if (!Array.isArray(incomingMessages)) return;
    for (const message of incomingMessages) {
      if (!isOwnMessage(message, userId, username)) {
        await acknowledgeIncomingDelivery(message);
      }
    }
  }, [acknowledgeIncomingDelivery, userId, username]);

  const updateMessageStatus = useCallback((messageId, nextStatus) => {
    const id = String(messageId);
    setMessages((prev) => prev.map((msg) => {
      if (String(msg.messageId) !== id) return msg;
      return {
        ...msg,
        status: pickHigherMessageStatus(msg.status, nextStatus),
      };
    }));
  }, []);

  useEffect(() => {
    if (!chatId || !userId) {
      setMessages([]);
      setIsConnected(false);
      setIsLoading(false);
      return undefined;
    }

    const chatIdStr = String(chatId);
    const loadGen = ++loadGenerationRef.current;

    setMessages([]);
    setPinnedMessages([]);
    setIsLoading(true);
    setIsLoadingOlder(false);
    setHasMoreOlder(false);
    setError(null);
    setIsConnected(false);
    setTypingUsers([]);
    loadingOlderRef.current = false;
    skipAutoScrollRef.current = false;
    olderScrollSnapshotRef.current = null;
    clearTypingExpiryTimers();
    clearTypingHeartbeat();
    lastTypingSentRef.current = false;
    acknowledgedDeliveriesRef.current.clear();
    pendingOptimisticIdRef.current = null;
    pendingConfirmedMessageRef.current = null;
    if (typingIdleTimerRef.current) {
      clearTimeout(typingIdleTimerRef.current);
      typingIdleTimerRef.current = null;
    }

    const detachHandlers = (conn) => {
      if (!conn) return;
      conn.off('MessageSent');
      conn.off('MessageEdited');
      conn.off('MessageDeleted');
      conn.off('MessageStatusChanged');
      conn.off('MessageDelivered');
      conn.off('MessageRead');
      conn.off('ReceiveMessages');
      conn.off('ReceiveMessagesMeta');
      conn.off('UserTyping');
      conn.off('UserStoppedTyping');
      conn.off('MessagePinned');
      conn.off('MessageUnpinned');
      conn.off('ReceivePinnedMessages');
      conn.off('PollUpdated');
      conn.off('Error');
    };

    const stopConnection = async (conn, leaveChatId) => {
      if (!conn) return;
      detachHandlers(conn);
      try {
        if (conn.state === 'Connected' && leaveChatId) {
          await conn.invoke('LeaveGroup', leaveChatId);
        }
        if (conn.state !== 'Disconnected') {
          await conn.stop();
        }
      } catch (err) {
        console.warn('stopConnection:', err);
      }
    };

    const connect = async () => {
      if (loadGenerationRef.current !== loadGen) return;

      const previousChatId = currentChatIdRef.current;
      const existingConnection = connectionRef.current;
      if (existingConnection) {
        connectionRef.current = null;
        currentChatIdRef.current = null;
        setConnection(null);
        setIsConnected(false);
        await stopConnection(existingConnection, previousChatId);
      }

      if (loadGenerationRef.current !== loadGen) return;

      const newConnection = new HubConnectionBuilder()
        .withUrl(`${BASE_URL}/groupchathub?userId=${userId}`)
        .withAutomaticReconnect()
        .build();

      try {
        await newConnection.start();
        if (loadGenerationRef.current !== loadGen) {
          await stopConnection(newConnection, null);
          return;
        }

        connectionRef.current = newConnection;
        setConnection(newConnection);
        setIsConnected(true);

        const receiveMessageHandler = async (messageData) => {
          if (loadGenerationRef.current !== loadGen) return;
          const newMessage = normalizeMessage(messageData);
          if (!newMessage) return;
          const own = isOwnMessage(newMessage, userId, username);

          setMessages((prev) => {
            const exists = prev.some((msg) => String(msg.messageId) === String(newMessage.messageId));
            if (exists) {
              return prev.map((msg) => (
                String(msg.messageId) === String(newMessage.messageId)
                  ? { ...msg, ...newMessage, status: pickHigherMessageStatus(msg.status, newMessage.status) }
                  : msg
              ));
            }

            if (own) {
              const replaced = replaceOwnOptimisticMessage(prev, newMessage);
              if (replaced) {
                return replaced;
              }

              if (pendingOptimisticIdRef.current) {
                pendingConfirmedMessageRef.current = newMessage;
                return prev;
              }
            }

            return [...prev, newMessage];
          });

          if (!own) {
            await acknowledgeIncomingDelivery(newMessage);
          }
        };

        const messageEditedHandler = (messageId, newContent) => {
          if (loadGenerationRef.current !== loadGen) return;
          setMessages((prev) => prev.map((msg) => (
            String(msg.messageId) === String(messageId) ? { ...msg, content: newContent } : msg
          )));
        };

        const messageDeletedHandler = (messageId) => {
          if (loadGenerationRef.current !== loadGen) return;
          setMessages((prev) => prev.filter((msg) => String(msg.messageId) !== String(messageId)));
          setPinnedMessages((prev) => prev.filter((msg) => String(msg.messageId) !== String(messageId)));
        };

        const messagePinnedHandler = async (payload) => {
          if (loadGenerationRef.current !== loadGen) return;
          const messageId = payload?.messageId ?? payload?.MessageId;
          const pinnedAt = payload?.pinnedAt ?? payload?.PinnedAt ?? new Date().toISOString();
          if (!messageId) return;

          setMessages((prev) => {
            const updated = prev.map((msg) => (
              String(msg.messageId) === String(messageId)
                ? { ...msg, isPinned: true, pinnedAt }
                : msg
            ));
            const pinnedMessage = updated.find((msg) => String(msg.messageId) === String(messageId));
            if (pinnedMessage) {
              setPinnedMessages((prevPinned) => {
                const rest = prevPinned.filter((msg) => String(msg.messageId) !== String(messageId));
                return [{ ...pinnedMessage, isPinned: true, pinnedAt }, ...rest].sort(
                  (a, b) => new Date(b.pinnedAt || b.createdAt) - new Date(a.pinnedAt || a.createdAt),
                );
              });
            }
            return updated;
          });

          try {
            await newConnection.invoke('GetPinnedMessages', chatId);
          } catch (err) {
            console.warn('GetPinnedMessages after pin failed:', err);
          }
        };

        const messageUnpinnedHandler = async (payload) => {
          if (loadGenerationRef.current !== loadGen) return;
          const messageId = payload?.messageId ?? payload?.MessageId;
          if (!messageId) return;

          setMessages((prev) => prev.map((msg) => (
            String(msg.messageId) === String(messageId)
              ? { ...msg, isPinned: false, pinnedAt: null }
              : msg
          )));
          setPinnedMessages((prev) => prev.filter((msg) => String(msg.messageId) !== String(messageId)));

          try {
            await newConnection.invoke('GetPinnedMessages', chatId);
          } catch (err) {
            console.warn('GetPinnedMessages after unpin failed:', err);
          }
        };

        const receivePinnedMessagesHandler = (items) => {
          if (loadGenerationRef.current !== loadGen) return;
          const processed = (Array.isArray(items) ? items : [])
            .map((msg) => normalizeMessage(msg))
            .filter(Boolean);
          setPinnedMessages(processed);
        };

        const pollUpdatedHandler = (payload) => {
          if (loadGenerationRef.current !== loadGen) return;
          const messageId = payload?.messageId ?? payload?.MessageId;
          const poll = normalizePoll(payload?.poll ?? payload?.Poll);
          const viewerUserId = payload?.viewerUserId ?? payload?.ViewerUserId;
          const viewerVotedOptionIds = payload?.viewerVotedOptionIds ?? payload?.ViewerVotedOptionIds;
          if (!messageId || !poll) return;

          const applyPollUpdate = (msg) => {
            if (String(msg.messageId) !== String(messageId)) return msg;
            const nextPoll = {
              ...poll,
              votedOptionIds:
                viewerUserId && String(viewerUserId) === String(userId) && Array.isArray(viewerVotedOptionIds)
                  ? viewerVotedOptionIds.map(String)
                  : (msg.poll?.votedOptionIds ?? poll.votedOptionIds ?? []),
            };
            return { ...msg, poll: nextPoll };
          };

          setMessages((prev) => prev.map(applyPollUpdate));
          setPinnedMessages((prev) => prev.map(applyPollUpdate));
        };

        const messageStatusChangedHandler = (messageId, status) => {
          if (loadGenerationRef.current !== loadGen) return;
          updateMessageStatus(messageId, status);
        };

        newConnection.on('ReceiveMessagesMeta', (meta) => {
          if (loadGenerationRef.current !== loadGen) return;
          const hasMore = meta?.hasMoreOlder ?? meta?.HasMoreOlder ?? false;
          setHasMoreOlder(Boolean(hasMore));
          setIsLoadingOlder(false);
          loadingOlderRef.current = false;
        });

        newConnection.on('ReceiveMessages', (messages) => {
          if (loadGenerationRef.current !== loadGen) return;
          const source = Array.isArray(messages) ? messages : [];
          const processedMessages = source
            .map((msg) => normalizeMessage(msg))
            .filter(Boolean);

          if (loadingOlderRef.current) {
            skipAutoScrollRef.current = true;
            setMessages((prev) => {
              const incomingIds = new Set(
                processedMessages.map((msg) => String(msg.messageId)),
              );
              const rest = prev.filter((msg) => !incomingIds.has(String(msg.messageId)));
              return [...rest, ...processedMessages].sort(
                (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
              );
            });
          } else {
            setMessages(processedMessages);
            const pinnedFromMessages = processedMessages
              .filter((msg) => msg.isPinned)
              .sort((a, b) => new Date(b.pinnedAt || b.createdAt) - new Date(a.pinnedAt || a.createdAt));
            if (pinnedFromMessages.length > 0) {
              setPinnedMessages(pinnedFromMessages);
            }
          }
          acknowledgeIncomingMessages(processedMessages);
        });

        newConnection.off('MessageSent', receiveMessageHandler);
        newConnection.on('MessageSent', receiveMessageHandler);
        newConnection.off('MessageEdited', messageEditedHandler);
        newConnection.on('MessageEdited', messageEditedHandler);
        newConnection.off('MessageDeleted', messageDeletedHandler);
        newConnection.on('MessageDeleted', messageDeletedHandler);
        newConnection.off('MessageStatusChanged', messageStatusChangedHandler);
        newConnection.on('MessageStatusChanged', messageStatusChangedHandler);
        newConnection.off('MessagePinned', messagePinnedHandler);
        newConnection.on('MessagePinned', messagePinnedHandler);
        newConnection.off('MessageUnpinned', messageUnpinnedHandler);
        newConnection.on('MessageUnpinned', messageUnpinnedHandler);
        newConnection.off('ReceivePinnedMessages', receivePinnedMessagesHandler);
        newConnection.on('ReceivePinnedMessages', receivePinnedMessagesHandler);
        newConnection.off('PollUpdated', pollUpdatedHandler);
        newConnection.on('PollUpdated', pollUpdatedHandler);

        newConnection.on('UserTyping', (eventChatId, typingUserId, typingUsername) => {
          if (String(eventChatId) !== chatIdStr) return;
          addTypingUser(typingUserId, typingUsername);
        });

        newConnection.on('UserStoppedTyping', (eventChatId, typingUserId) => {
          if (String(eventChatId) !== chatIdStr) return;
          removeTypingUser(typingUserId);
        });

        newConnection.on('Error', (errorMessage) => {
          console.error('SignalR Error:', errorMessage);
          setError(errorMessage);
        });

        await newConnection.invoke('JoinGroup', chatId);
        await newConnection.invoke('GetMessages', chatId, 50, '');
        await newConnection.invoke('GetPinnedMessages', chatId);

        if (loadGenerationRef.current !== loadGen) return;

        currentChatIdRef.current = chatIdStr;

        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({
            behavior: 'auto',
            block: 'end',
          });
        }, 100);
      } catch (error) {
        if (loadGenerationRef.current !== loadGen) return;
        console.error('Connection failed: ', error);
        setError('Ошибка подключения к чату: ' + error.message);
      } finally {
        if (loadGenerationRef.current === loadGen) {
          setIsLoading(false);
        }
      }
    };

    connect();

    return () => {
      loadGenerationRef.current += 1;
      const cleanup = async () => {
        if (typingIdleTimerRef.current) {
          clearTimeout(typingIdleTimerRef.current);
          typingIdleTimerRef.current = null;
        }
        clearTypingHeartbeat();
        clearTypingExpiryTimers();
        const shouldStopTyping = lastTypingSentRef.current;
        lastTypingSentRef.current = false;
        setTypingUsers([]);

        const conn = connectionRef.current;
        const activeChatId = currentChatIdRef.current;
        connectionRef.current = null;
        currentChatIdRef.current = null;
        setConnection(null);
        setIsConnected(false);

        if (conn) {
          try {
            if (conn.state === 'Connected' && chatId && shouldStopTyping) {
              await conn.invoke('NotifyStopTyping', chatId);
            }
            await stopConnection(conn, activeChatId || chatId);
          } catch (err) {
            console.error('Cleanup error:', err);
          }
        }
      };

      cleanup();
    };
  }, [chatId, userId, username, addTypingUser, acknowledgeIncomingDelivery, acknowledgeIncomingMessages, clearTypingExpiryTimers, clearTypingHeartbeat, normalizeMessage, removeTypingUser, replaceOwnOptimisticMessage, updateMessageStatus]);

  useEffect(() => {
    if (messages.length === 0) return;

    const container = messagesContainerRef.current;
    const snapshot = olderScrollSnapshotRef.current;

    if (snapshot && container) {
      const heightDelta = container.scrollHeight - snapshot.scrollHeight;
      container.scrollTop = snapshot.scrollTop + heightDelta;
      olderScrollSnapshotRef.current = null;
      skipAutoScrollRef.current = false;
      return;
    }

    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      return;
    }

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'auto',
        block: 'end',
      });
    }, 100);
  }, [messages.length]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: "auto",
        block: "end"
      });
    }
  }, []);

  const loadOlderMessages = useCallback(async () => {
    const conn = connectionRef.current;
    if (!conn || !chatId || !hasMoreOlder || isLoadingOlder || loadingOlderRef.current) {
      return;
    }

    const persisted = messages.filter((msg) => isPersistedMessageId(msg.messageId));
    if (persisted.length === 0) return;

    const oldest = persisted.reduce((min, msg) => {
      const minTime = new Date(min.createdAt).getTime();
      const msgTime = new Date(msg.createdAt).getTime();
      if (msgTime < minTime) return msg;
      if (msgTime > minTime) return min;
      return String(msg.messageId) < String(min.messageId) ? msg : min;
    });

    const container = messagesContainerRef.current;
    if (container) {
      olderScrollSnapshotRef.current = {
        scrollHeight: container.scrollHeight,
        scrollTop: container.scrollTop,
      };
    }

    loadingOlderRef.current = true;
    setIsLoadingOlder(true);
    try {
      await conn.invoke('GetMessages', chatId, 50, String(oldest.messageId));
    } catch (err) {
      console.warn('GetMessages (older) failed:', err);
      loadingOlderRef.current = false;
      setIsLoadingOlder(false);
      olderScrollSnapshotRef.current = null;
    }
  }, [chatId, hasMoreOlder, isLoadingOlder, isPersistedMessageId, messages]);

  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || isLoadingOlder || !hasMoreOlder) return;
    if (container.scrollTop <= 120) {
      loadOlderMessages();
    }
  }, [hasMoreOlder, isLoadingOlder, loadOlderMessages]);

  const sendMessage = useCallback(async (content, repliedMessageId = null, forwardedMessage = null) => {
    if (!content.trim() || !connection) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = normalizeMessage({
      messageId: tempId,
      senderId: userId,
      senderUsername: username,
      content,
      createdAt: new Date().toISOString(),
      status: MessageStatus.SENDING,
    });

    if (optimisticMessage) {
      pendingOptimisticIdRef.current = tempId;
      setMessages((prev) => {
        const confirmed = pendingConfirmedMessageRef.current;
        if (confirmed) {
          pendingConfirmedMessageRef.current = null;
          pendingOptimisticIdRef.current = null;
          const withoutDuplicate = prev.filter(
            (msg) => String(msg.messageId) !== String(confirmed.messageId),
          );
          return [
            ...withoutDuplicate,
            {
              ...confirmed,
              status: pickHigherMessageStatus(MessageStatus.SENT, confirmed.status),
            },
          ];
        }

        return [...prev, optimisticMessage];
      });
    }

    try {
      if (typingIdleTimerRef.current) {
        clearTimeout(typingIdleTimerRef.current);
        typingIdleTimerRef.current = null;
      }
      await notifyStopTyping();
      await connection.invoke('SendMessage', 
        content, 
        username, 
        chatId, 
        repliedMessageId,
        forwardedMessage
      );
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      pendingOptimisticIdRef.current = null;
      pendingConfirmedMessageRef.current = null;
      setMessages((prev) => prev.map((msg) => (
        String(msg.messageId) === tempId
          ? { ...msg, status: MessageStatus.FAILED }
          : msg
      )));
      setError('Ошибка отправки сообщения');
      return false;
    }
  }, [connection, username, chatId, notifyStopTyping, normalizeMessage, userId]);

  const editMessage = useCallback(async (messageId, newContent) => {
    if (!connection) return;

    try {
      console.log('Sending EditMessage:', { messageId, newContent, username });
      await connection.invoke('EditMessage', messageId, newContent, username);
      return true;
    } catch (error) {
      console.error('Error editing message:', error);
      setError('Ошибка редактирования сообщения');
      return false;
    }
  }, [connection, username]);

  const deleteMessage = useCallback(async (messageId) => {
    if (!connection) return;

    try {
      await connection.invoke('DeleteMessage', messageId, username);
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      setError('Ошибка удаления сообщения');
      return false;
    }
  }, [connection, username]);

  const forwardMessage = useCallback(async (messageId, targetChatId, comment = '') => {
    if (!connection) return false;

    try {
      const payload = (comment ?? '').trim() || ' ';
      await connection.invoke(
        'SendMessage',
        payload,
        username,
        String(targetChatId),
        null,
        messageId,
      );
      return true;
    } catch (error) {
      console.error('Error forwarding message:', error);
      setError('Ошибка пересылки сообщения');
      return false;
    }
  }, [connection, username]);

  const pinMessage = useCallback(async (messageId) => {
    if (!connection) return false;
    try {
      await connection.invoke('PinMessage', messageId);
      return true;
    } catch (error) {
      console.error('Error pinning message:', error);
      setError('Ошибка закрепления сообщения');
      return false;
    }
  }, [connection]);

  const unpinMessage = useCallback(async (messageId) => {
    if (!connection) return false;
    try {
      await connection.invoke('UnpinMessage', messageId);
      return true;
    } catch (error) {
      console.error('Error unpinning message:', error);
      setError('Ошибка открепления сообщения');
      return false;
    }
  }, [connection]);

  const createPoll = useCallback(async ({ question, options, allowMultiple, isAnonymous = true }) => {
    if (!connection || !chatId) return false;
    try {
      await connection.invoke(
        'CreatePoll',
        String(chatId),
        question,
        options,
        Boolean(allowMultiple),
        Boolean(isAnonymous),
      );
      return true;
    } catch (error) {
      console.error('Error creating poll:', error);
      setError('Ошибка создания опроса');
      return false;
    }
  }, [connection, chatId]);

  const votePoll = useCallback(async (messageId, optionIds) => {
    if (!connection) return false;
    try {
      await connection.invoke(
        'VotePoll',
        messageId,
        (optionIds ?? []).map((id) => String(id)),
      );
      return true;
    } catch (error) {
      console.error('Error voting in poll:', error);
      setError('Ошибка голосования');
      return false;
    }
  }, [connection]);

  return {
    messages,
    pinnedMessages,
    connection,
    isConnected,
    isLoading,
    isLoadingOlder,
    hasMoreOlder,
    error,
    messagesEndRef,
    messagesContainerRef,
    typingUsers,
    handleComposerTextChange,
    handleMessagesScroll,
    loadOlderMessages,
    notifyStopTyping,
    sendMessage,
    editMessage,
    deleteMessage,
    forwardMessage,
    pinMessage,
    unpinMessage,
    createPoll,
    votePoll,
    scrollToBottom
  };
};
