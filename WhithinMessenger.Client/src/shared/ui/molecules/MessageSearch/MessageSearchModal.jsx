import React, { useEffect } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import MessageSearch from './MessageSearch';
import './MessageSearchModal.css';

const MessageSearchModal = ({
  open,
  onClose,
  searchQuery,
  searchResults,
  isSearching,
  isSearchingHistory,
  onSearch,
  onClearSearch,
  onScrollToMessage,
}) => {
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const handleOverlayMouseDown = (event) => {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  };

  return (
    <div
      className="message-search-modal-overlay"
      onMouseDown={handleOverlayMouseDown}
    >
      <div
        className="message-search-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Поиск сообщений"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="message-search-modal-header">
          <h3>Поиск сообщений</h3>
          <button
            type="button"
            className="message-search-modal-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <CloseIcon fontSize="small" />
          </button>
        </div>
        <div className="message-search-modal-body">
          <MessageSearch
            variant="modal"
            searchQuery={searchQuery}
            searchResults={searchResults}
            isSearching={isSearching}
            isSearchingHistory={isSearchingHistory}
            onSearch={onSearch}
            onClearSearch={onClearSearch}
            onScrollToMessage={onScrollToMessage}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
};

export default MessageSearchModal;
