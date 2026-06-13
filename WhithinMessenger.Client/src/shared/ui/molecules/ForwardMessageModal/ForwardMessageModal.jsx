import React, { useEffect, useMemo, useState } from 'react';
import Close from '@mui/icons-material/Close';
import Search from '@mui/icons-material/Search';
import Forward from '@mui/icons-material/Forward';
import Link from '@mui/icons-material/Link';
import CheckCircle from '@mui/icons-material/CheckCircle';
import UserAvatar from '../../atoms/UserAvatar';
import {
  buildMessageLinkText,
  getMessageForwardPreview,
  resolveServerIconUrl,
} from '../../../lib/utils/forwardTargets';
import './ForwardMessageModal.css';

const ForwardMessageModal = ({
  isOpen,
  message,
  targets,
  loading,
  error,
  comment,
  onCommentChange,
  selectedIds,
  onToggleTarget,
  isSending,
  onSend,
  onClose,
  onCopyLink,
  toastMessage,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredTargets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return targets;
    return targets.filter((item) => item.searchText?.includes(query));
  }, [targets, searchQuery]);

  if (!isOpen || !message) return null;

  const selectedCount = selectedIds.size;
  const sendLabel = selectedCount > 0 ? `Отправить (${selectedCount})` : 'Отправить';

  return (
    <div
      className="forward-message-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forward-message-modal-title"
    >
      <button
        type="button"
        className="forward-message-modal__backdrop"
        onClick={onClose}
        aria-label="Закрыть"
      />

      <div className="forward-message-modal__dialog" onClick={(e) => e.stopPropagation()}>
        <header className="forward-message-modal__header">
          <div className="forward-message-modal__header-main">
            <Forward className="forward-message-modal__header-icon" aria-hidden="true" />
            <h2 id="forward-message-modal-title" className="forward-message-modal__title">
              Переслать
            </h2>
          </div>
          <div className="forward-message-modal__header-actions">
            <button
              type="button"
              className="forward-message-modal__icon-btn"
              onClick={onCopyLink}
              title="Копировать ссылку"
              aria-label="Копировать ссылку"
            >
              <Link fontSize="small" />
            </button>
            <button
              type="button"
              className="forward-message-modal__close"
              onClick={onClose}
              aria-label="Закрыть"
            >
              <Close fontSize="small" />
            </button>
          </div>
        </header>

        <div className="forward-message-modal__preview">
          <span className="forward-message-modal__preview-label">Сообщение</span>
          <span className="forward-message-modal__preview-author">
            {message.senderUsername || 'Пользователь'}
          </span>
          <p className="forward-message-modal__preview-text">
            {getMessageForwardPreview(message)}
          </p>
        </div>

        <div className="forward-message-modal__search">
          <Search className="forward-message-modal__search-icon" aria-hidden="true" />
          <input
            type="text"
            className="forward-message-modal__search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск"
          />
        </div>

        <div className="forward-message-modal__list-wrap">
          {loading && targets.length === 0 ? (
            <div className="forward-message-modal__state">
              <div className="forward-message-modal__spinner" aria-hidden="true" />
              <span>Загрузка чатов…</span>
            </div>
          ) : filteredTargets.length === 0 ? (
            <div className="forward-message-modal__state">
              <span>{searchQuery.trim() ? 'Ничего не найдено' : 'Нет доступных чатов и каналов'}</span>
            </div>
          ) : (
            <ul className="forward-message-modal__list">
              {filteredTargets.map((item) => {
                const isSelected = selectedIds.has(item.chatId);
                const serverIcon = resolveServerIconUrl(item.serverIconUrl);

                return (
                  <li
                    key={item.chatId}
                    className={`forward-message-modal__row${isSelected ? ' forward-message-modal__row--selected' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    aria-label={item.title}
                    onClick={() => onToggleTarget(item.chatId)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onToggleTarget(item.chatId);
                      }
                    }}
                  >
                      <div className="forward-message-modal__avatar-wrap">
                        {item.type === 'channel' ? (
                          <>
                            {serverIcon ? (
                              <img
                                src={serverIcon}
                                alt=""
                                className="forward-message-modal__server-icon"
                              />
                            ) : (
                              <div className="forward-message-modal__server-fallback">
                                {(item.serverName || 'S').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="forward-message-modal__channel-badge">#</span>
                          </>
                        ) : (
                          <UserAvatar
                            username={item.title}
                            avatarUrl={item.avatarUrl}
                            avatarColor={item.avatarColor}
                            size={40}
                          />
                        )}
                      </div>

                      <div className="forward-message-modal__info">
                        <span className="forward-message-modal__name">{item.title}</span>
                        {item.subtitle ? (
                          <span className="forward-message-modal__subtitle">{item.subtitle}</span>
                        ) : null}
                      </div>

                      {isSelected ? (
                        <CheckCircle className="forward-message-modal__check" aria-hidden="true" />
                      ) : (
                        <span className="forward-message-modal__check-placeholder" aria-hidden="true" />
                      )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error ? (
          <div className="forward-message-modal__error" role="alert">
            {error}
          </div>
        ) : null}

        <footer className="forward-message-modal__footer">
          <textarea
            className="forward-message-modal__comment"
            rows={1}
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            placeholder="Добавить сообщение (необязательно)"
            disabled={isSending}
          />
          <button
            type="button"
            className="forward-message-modal__send"
            disabled={isSending || selectedCount === 0}
            onClick={onSend}
          >
            {isSending ? 'Отправка…' : sendLabel}
          </button>
        </footer>

        {toastMessage ? (
          <div className="forward-message-modal__toast" role="status">
            {toastMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ForwardMessageModal;
