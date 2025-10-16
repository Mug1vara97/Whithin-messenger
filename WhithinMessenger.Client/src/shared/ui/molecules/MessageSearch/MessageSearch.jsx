import React from 'react';
import { UserAvatar } from '../../atoms';
import './MessageSearch.css';

const MessageSearch = ({ 
  searchQuery, 
  searchResults, 
  isSearching, 
  onSearch, 
  onClearSearch, 
  onScrollToMessage 
}) => {
  if (!isSearching || searchResults.length === 0) {
    return (
      <div className="search-container">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Поиск сообщений..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="search-container">
      <div className="search-bar">
        <input
          type="text"
          placeholder="Поиск сообщений..."
          className="search-input"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <div className="search-results">
        <div className="search-results-header">
          <div className="search-results-title">
            <span>Найдено сообщений: {searchResults.length}</span>
          </div>
          <button 
            className="clear-search"
            onClick={onClearSearch}
          >
            ×
          </button>
        </div>
        <div className="search-results-list">
          {searchResults.map((msg) => (
            <div
              key={msg.messageId}
              className="search-result-item"
              onClick={() => onScrollToMessage(msg.messageId)}
            >
              <div className="search-result-user">
                <UserAvatar 
                  username={msg.senderUsername}
                  avatarUrl={msg.avatarUrl}
                  avatarColor={msg.avatarColor}
                  size={32}
                />
              </div>
              <div className="search-result-main">
                <div className="search-result-header">
                  <strong className="search-result-username">{msg.senderUsername}</strong>
                  <span className="search-result-date">
                    {new Date(msg.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="search-result-content">
                  {msg.content}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MessageSearch;
