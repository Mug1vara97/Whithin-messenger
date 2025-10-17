import { useState, useCallback, useEffect, useRef } from 'react';

export const useMessageSearch = (chatId, connection) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimer = useRef(null);

  useEffect(() => {
    if (!connection) return;

    const handleSearchResults = (results) => {
      setSearchResults(results);
      setIsSearching(false);
    };

    const handleError = (error) => {
      console.error('Search error:', error);
      setIsSearching(false);
    };

    connection.on('SearchMessagesResult', handleSearchResults);
    connection.on('Error', handleError);

    return () => {
      connection.off('SearchMessagesResult', handleSearchResults);
      connection.off('Error', handleError);
    };
  }, [connection]);

  const searchMessages = useCallback(async (query) => {
    setSearchQuery(query);
    
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (!connection) {
      console.error('SignalR connection not established');
      return;
    }

    setIsSearching(true);
    
    debounceTimer.current = setTimeout(async () => {
      try {
        await connection.invoke('SearchMessages', chatId, query);
      } catch (error) {
        console.error('Error searching messages:', error);
        setIsSearching(false);
      }
    }, 300);
  }, [chatId, connection]);

  const clearSearch = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
  }, []);

  const scrollToMessage = useCallback((messageId) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageElement.classList.add('highlighted');
      setTimeout(() => messageElement.classList.remove('highlighted'), 2000);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return {
    searchQuery,
    searchResults,
    isSearching,
    searchMessages,
    clearSearch,
    scrollToMessage
  };
};
