import React, { useState, useEffect, useRef } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { UserAvatar } from '../../atoms';
import './MessageSearch.css';

const MessageSearch = ({
  variant = 'inline',
  searchQuery,
  searchResults,
  isSearching,
  isSearchingHistory = false,
  onSearch,
  onClearSearch,
  onScrollToMessage,
  onClose,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);
  const isModal = variant === 'modal';
  const hasResults = searchResults && searchResults.length > 0;
  const showResults = isModal
    ? Boolean(searchQuery)
    : searchQuery && (hasResults || isSearching || isSearchingHistory);
  const statusLabel = isSearchingHistory
    ? 'Поиск по истории…'
    : isSearching
      ? 'Поиск…'
      : `Найдено: ${searchResults.length}`;

  useEffect(() => {
    if (!isModal) return undefined;
    const timeoutId = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timeoutId);
  }, [isModal]);

  const handleClear = () => {
    onClearSearch();
    if (isModal) {
      inputRef.current?.focus();
    }
  };

  return (
    <div className={`message-search${isModal ? ' message-search--modal' : ''}`}>
      <div
        className={`message-search-field${isFocused ? ' is-focused' : ''}${searchQuery ? ' has-value' : ''}${isModal ? ' message-search-field--modal' : ''}`}
      >
        <SearchIcon className="message-search-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Поиск сообщений"
          className="message-search-input"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          aria-label="Поиск сообщений"
        />
        {searchQuery && (
          <button
            type="button"
            className="message-search-clear"
            onClick={handleClear}
            aria-label="Очистить поиск"
          >
            <CloseIcon fontSize="small" />
          </button>
        )}
      </div>
      {showResults && (
        <div className={`message-search-results${isModal ? ' message-search-results--modal' : ''}`}>
          <div className="message-search-results-header">
            <div className="message-search-results-title">
              <span>{statusLabel}</span>
            </div>
            {!isModal && (
              <button
                type="button"
                className="message-search-results-close"
                onClick={onClose || handleClear}
                aria-label="Закрыть результаты"
              >
                <CloseIcon fontSize="small" />
              </button>
            )}
          </div>
          <div className="message-search-results-list">
            {isSearching && !hasResults ? (
              <div className="message-search-loading">{statusLabel}</div>
            ) : hasResults ? (
              searchResults.map((msg) => (
                <div
                  key={msg.messageId}
                  className="message-search-result-item"
                  onClick={() => onScrollToMessage(msg.messageId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onScrollToMessage(msg.messageId);
                    }
                  }}
                >
                  <div className="message-search-result-user">
                    <UserAvatar
                      displayName={msg.senderDisplayName}
                      login={msg.senderLogin}
                      username={msg.senderUsername}
                      avatarUrl={msg.avatarUrl}
                      avatarColor={msg.avatarColor}
                      size={32}
                    />
                  </div>
                  <div className="message-search-result-main">
                    <div className="message-search-result-header">
                      <strong className="message-search-result-username">
                        {msg.senderUsername}
                      </strong>
                      <span className="message-search-result-date">
                        {new Date(msg.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="message-search-result-content">{msg.content}</div>
                  </div>
                </div>
              ))
            ) : isSearchingHistory ? (
              <div className="message-search-loading">{statusLabel}</div>
            ) : (
              <div className="message-search-empty">Ничего не найдено</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageSearch;
