import React, { useState } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { UserAvatar } from '../../atoms';
import './MessageSearch.css';

const MessageSearch = ({
  searchQuery,
  searchResults,
  isSearching,
  onSearch,
  onClearSearch,
  onScrollToMessage,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasResults = searchResults && searchResults.length > 0;
  const showResults = searchQuery && (hasResults || isSearching);

  const handleClear = () => {
    onClearSearch();
  };

  return (
    <div className="message-search">
      <div
        className={`message-search-field${isFocused ? ' is-focused' : ''}${searchQuery ? ' has-value' : ''}`}
      >
        <SearchIcon className="message-search-icon" aria-hidden="true" />
        <input
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
        <div className="message-search-results">
          <div className="message-search-results-header">
            <div className="message-search-results-title">
              {isSearching ? (
                <span>Поиск...</span>
              ) : (
                <span>Найдено: {searchResults.length}</span>
              )}
            </div>
            <button
              type="button"
              className="message-search-results-close"
              onClick={handleClear}
              aria-label="Закрыть результаты"
            >
              <CloseIcon fontSize="small" />
            </button>
          </div>
          <div className="message-search-results-list">
            {isSearching ? (
              <div className="message-search-loading">Поиск...</div>
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
