import { useState, useCallback, useEffect, useRef } from 'react';

const normalizeSearchText = (value) => (value || '').toLowerCase();

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

/**
 * Client-side search over decrypted messages.
 * With E2E, server-side Content search cannot match ciphertext — history is paged in via SignalR.
 */
export const useMessageSearch = (messages = [], options = {}) => {
  const {
    hasMoreOlder = false,
    loadOlderMessagesAsync,
    ensureMessageLoaded,
  } = options;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchingHistory, setIsSearchingHistory] = useState(false);
  const debounceTimer = useRef(null);
  const messagesRef = useRef(messages);
  const hasMoreOlderRef = useRef(hasMoreOlder);
  const searchGenerationRef = useRef(0);
  const deepSearchTaskRef = useRef(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    hasMoreOlderRef.current = hasMoreOlder;
  }, [hasMoreOlder]);

  const runSearch = useCallback((query) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }

    const results = messagesRef.current
      .filter((message) => messageMatchesQuery(message, trimmed))
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    setSearchResults(results);
  }, []);

  const cancelDeepSearch = useCallback(() => {
    searchGenerationRef.current += 1;
    deepSearchTaskRef.current = null;
    setIsSearchingHistory(false);
  }, []);

  const runDeepSearch = useCallback(async (query, generation) => {
    if (!loadOlderMessagesAsync) {
      setIsSearching(false);
      return;
    }

    setIsSearchingHistory(true);
    try {
      while (
        generation === searchGenerationRef.current
        && hasMoreOlderRef.current
      ) {
        const loaded = await loadOlderMessagesAsync();
        if (!loaded) break;
        await waitForNextFrame();
        runSearch(query);
      }
    } finally {
      if (generation === searchGenerationRef.current) {
        setIsSearchingHistory(false);
        setIsSearching(false);
        deepSearchTaskRef.current = null;
      }
    }
  }, [loadOlderMessagesAsync, runSearch]);

  const searchMessages = useCallback((query) => {
    setSearchQuery(query);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    cancelDeepSearch();

    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceTimer.current = setTimeout(() => {
      const generation = searchGenerationRef.current;
      runSearch(query);

      if (!loadOlderMessagesAsync || !hasMoreOlderRef.current) {
        setIsSearching(false);
        return;
      }

      const task = runDeepSearch(query, generation);
      deepSearchTaskRef.current = task;
    }, 300);
  }, [cancelDeepSearch, runDeepSearch, runSearch, loadOlderMessagesAsync]);

  const clearSearch = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    cancelDeepSearch();
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

      const scrollContainer = messageElement.closest('.messages');
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
      };

      if (scrollContainer && 'onscrollend' in scrollContainer) {
        scrollContainer.addEventListener('scrollend', finish, { once: true });
      }

      setTimeout(finish, 650);
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
