import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Close from '@mui/icons-material/Close';
import PollOutlined from '@mui/icons-material/PollOutlined';
import UserAvatar from '../../atoms/UserAvatar';
import {
  formatVotesLabel,
  getPollOptionPercent,
  getPollTotalVotes,
  normalizePoll,
} from '../../../lib/utils/pollMessageUtils';
import './PollResultsModal.css';

const PollResultsModal = ({ isOpen, poll, onClose }) => {
  const normalized = useMemo(() => normalizePoll(poll), [poll]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !normalized) return null;

  const totalVotes = getPollTotalVotes(normalized);
  const sortedOptions = normalized.options.slice().sort((a, b) => a.sortOrder - b.sortOrder);

  return createPortal(
    <div
      className="poll-results-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="poll-results-modal-title"
    >
      <button
        type="button"
        className="poll-results-modal__backdrop"
        onClick={onClose}
        aria-label="Закрыть"
      />

      <div className="poll-results-modal__dialog" onClick={(event) => event.stopPropagation()}>
        <header className="poll-results-modal__header">
          <div className="poll-results-modal__header-main">
            <PollOutlined className="poll-results-modal__header-icon" aria-hidden="true" />
            <h2 id="poll-results-modal-title" className="poll-results-modal__title">
              Результаты
            </h2>
          </div>
          <button
            type="button"
            className="poll-results-modal__close-btn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <Close fontSize="small" />
          </button>
        </header>

        <div className="poll-results-modal__summary">
          <p className="poll-results-modal__question">{normalized.question}</p>
          <p className="poll-results-modal__total">
            Всего {formatVotesLabel(totalVotes)}
            {normalized.allowMultiple ? ' · можно выбрать несколько' : ''}
          </p>
        </div>

        <div className="poll-results-modal__content">
          {sortedOptions.map((option) => {
            const percent = getPollOptionPercent(option.voteCount, totalVotes);

            return (
              <section key={option.id} className="poll-results-modal__option-group">
                <div className="poll-results-modal__option-header">
                  <span className="poll-results-modal__option-text">{option.text}</span>
                  <span className="poll-results-modal__option-stats">
                    <span className="poll-results-modal__option-percent">{percent}%</span>
                    <span className="poll-results-modal__option-count">
                      {formatVotesLabel(option.voteCount)}
                    </span>
                  </span>
                </div>

                {option.voters.length > 0 ? (
                  <ul className="poll-results-modal__voters">
                    {option.voters.map((voter) => (
                      <li key={`${option.id}-${voter.userId}`} className="poll-results-modal__voter">
                        <UserAvatar
                          username={voter.username}
                          avatarUrl={voter.avatarUrl}
                          avatarColor={voter.avatarColor}
                          size={40}
                        />
                        <span className="poll-results-modal__voter-name">{voter.username}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="poll-results-modal__empty-voters">Пока нет голосов</div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default PollResultsModal;
