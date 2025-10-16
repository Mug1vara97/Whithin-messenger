import { useState, useCallback } from 'react';
import { BASE_URL } from '../constants/apiEndpoints';

export const useMessageSearch = (chatId) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchMessages = useCallback(async (query) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`${BASE_URL}/api/messages/search/${chatId}?query=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
      } else {
        console.error('Search failed:', response.statusText);
      }
    } catch (error) {
      console.error('Error searching messages:', error);
    }
  }, [chatId]);

  const clearSearch = useCallback(() => {
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

  return {
    searchQuery,
    searchResults,
    isSearching,
    searchMessages,
    clearSearch,
    scrollToMessage
  };
};
























