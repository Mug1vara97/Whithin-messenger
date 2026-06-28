import { useState, useCallback, useEffect, useRef } from 'react';

const normalizeSearchText = (value) => (value || '').toLowerCase();

const isPersistedMessageId = (messageId) => {
  const id = String(messageId ?? '');
  return Boolean(id) && !id.startsWith('temp-');
};

const messageMatchesQuery = (message, query) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return false;

  const content = normalizeSearchText(message.content);
  const sender = normalizeSearchText(
    message.senderUsername
      || message.senderDisplayName
      || message.senderLogin
      || message.username,
  );

  return content.includes(normalizedQuery) || sender.includes(normalizedQuery);
};

const waitForNextFrame = () => new Promise((resolve) => {
  requestAnimationFrame(() => resolve());
});

const getOldestPersistedMessage = (items) => {
  const persisted = (items || []).filter((message) => isPersistedMessageId(message.messageId));
  if (!persisted.length) return null;

  return persisted.reduce((oldest, message) => {
    const oldestTime = new Date(oldest.createdAt).getTime();
    const messageTime = new Date(message.createdAt).getTime();
    if (messageTime < oldestTime) return message;
    if (messageTime > oldestTime) return oldest;
    return String(message.messageId) < String(oldest.messageId) ? message : oldest;
  });
};

const mergeMessagesIntoPool = (poolRef, incoming) => {
  const existingIds = new Set(poolRef.current.map((message) => String(message.messageId)));
  const merged = [...poolRef.current];

  (incoming || []).forEach((message) => {
    const messageId = String(message.messageId);
    if (!existingIds.has(messageId)) {
      merged.push(message);
      existingIds.add(messageId);
    }
  });

  poolRef.current = merged.sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );
};

const syncLiveMessagesIntoPool = (poolRef, liveMessages) => {
  if (!poolRef.current.length) {
    poolRef.current = (liveMessages || []).slice();
    return;
  }

  mergeMessagesIntoPool(poolRef, liveMessages);
};

/**
 * Client-side search over decrypted messages in an isolated pool.
 * History paging for search does not mutate the visible chat timeline.
 */
export const useMessageSearch = (messages = [], options = {}) => {
  const {
    fetchOlderMessagesForSearchAsync,
    ensureMessageLoaded,
  } = options;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchingHistory, setIsSearchingHistory] = useState(false);
  const debounceTimer = useRef(null);
  const messagesRef = useRef(messages);
  const searchPoolRef = useRef([]);
  const searchGenerationRef = useRef(0);
  const deepSearchTaskRef = useRef(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const runSearch = useCallback((query) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }

    const results = searchPoolRef.current
      .filter((message) => messageMatchesQuery(message, trimmed))
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    setSearchResults(results);
  }, []);

  const resetSearchPool = useCallback(() => {
    searchPoolRef.current = messagesRef.current.slice();
  }, []);

  const cancelDeepSearch = useCallback(() => {
    searchGenerationRef.current += 1;
    deepSearchTaskRef.current = null;
    setIsSearchingHistory(false);
  }, []);

  const runDeepSearch = useCallback(async (query, generation) => {
    if (!fetchOlderMessagesForSearchAsync) {
      setIsSearching(false);
      return;
    }

    setIsSearchingHistory(true);
    let hasMoreOlder = true;

    try {
      while (generation === searchGenerationRef.current && hasMoreOlder) {
        const oldest = getOldestPersistedMessage(searchPoolRef.current);
        if (!oldest) break;

        const batch = await fetchOlderMessagesForSearchAsync(oldest.messageId);
        if (generation !== searchGenerationRef.current || !batch?.messages?.length) {
          break;
        }

        mergeMessagesIntoPool(searchPoolRef, batch.messages);
        hasMoreOlder = Boolean(batch.hasMoreOlder);
        runSearch(query);
        await waitForNextFrame();
      }
    } finally {
      if (generation === searchGenerationRef.current) {
        setIsSearchingHistory(false);
        setIsSearching(false);
        deepSearchTaskRef.current = null;
      }
    }
  }, [fetchOlderMessagesForSearchAsync, runSearch]);

  const searchMessages = useCallback((query) => {
    setSearchQuery(query);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    cancelDeepSearch();

    if (!query.trim()) {
      searchPoolRef.current = [];
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    resetSearchPool();
    setIsSearching(true);

    debounceTimer.current = setTimeout(() => {
      const generation = searchGenerationRef.current;
      runSearch(query);

      if (!fetchOlderMessagesForSearchAsync) {
        setIsSearching(false);
        return;
      }

      const task = runDeepSearch(query, generation);
      deepSearchTaskRef.current = task;
    }, 300);
  }, [
    cancelDeepSearch,
    fetchOlderMessagesForSearchAsync,
    resetSearchPool,
    runDeepSearch,
    runSearch,
  ]);

  const clearSearch = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    cancelDeepSearch();
    searchPoolRef.current = [];
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
  }, [cancelDeepSearch]);

  const scrollToMessage = useCallback(async (messageId) => {
    const normalizedId = String(messageId);

    const scrollToElement = () => {
      const messageElement = document.getElementById(`message-${normalizedId}`);
      if (!messageElement) return false;

      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageElement.classList.add('highlighted');
      setTimeout(() => messageElement.classList.remove('highlighted'), 2000);
      return true;
    };

    if (scrollToElement()) {
      return true;
    }

    if (ensureMessageLoaded) {
      const loaded = await ensureMessageLoaded(normalizedId);
      await waitForNextFrame();
      if (loaded && scrollToElement()) {
        return true;
      }
    }

    return false;
  }, [ensureMessageLoaded]);

  useEffect(() => {
    if (!searchQuery.trim()) return undefined;

    syncLiveMessagesIntoPool(searchPoolRef, messagesRef.current);
    runSearch(searchQuery);
    return undefined;
  }, [messages, searchQuery, runSearch]);

  useEffect(() => () => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    cancelDeepSearch();
  }, [cancelDeepSearch]);

  return {
    searchQuery,
    searchResults,
    isSearching,
    isSearchingHistory,
    searchMessages,
    clearSearch,
    scrollToMessage,
  };
};
