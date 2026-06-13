import React, { useMemo, useState } from 'react';
import PollOutlined from '@mui/icons-material/PollOutlined';
import PollResultsModal from '../PollResultsModal/PollResultsModal';
import {
  formatVotesLabel,
  getPollOptionPercent,
  getPollTotalVotes,
  normalizePoll,
} from '../../../lib/utils/pollMessageUtils';
import './PollMessage.css';

export function PollMessage({ poll, onVote, disabled = false }) {
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const normalized = useMemo(() => normalizePoll(poll), [poll]);
  if (!normalized) return null;

  const totalVotes = getPollTotalVotes(normalized);

  const handleOptionClick = (optionId) => {
    if (disabled || !onVote) return;

    const optionKey = String(optionId);
    const selected = new Set(normalized.votedOptionIds);

    if (normalized.allowMultiple) {
      if (selected.has(optionKey)) {
        selected.delete(optionKey);
      } else {
        selected.add(optionKey);
      }
      onVote(Array.from(selected));
      return;
    }

    onVote(selected.has(optionKey) ? [] : [optionKey]);
  };

  return (
    <>
      <div className="poll-message">
        <div className="poll-message__header">
          <PollOutlined className="poll-message__icon" aria-hidden="true" />
          <span className="poll-message__badge">Опрос</span>
          <span className="poll-message__type">
            {normalized.isAnonymous ? 'Анонимный' : 'Публичный'}
          </span>
        </div>

        <div className="poll-message__question">{normalized.question}</div>

        <div className="poll-message__options">
          {normalized.options
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((option) => {
              const isSelected = normalized.votedOptionIds.includes(String(option.id));
              const percent = getPollOptionPercent(option.voteCount, totalVotes);

              return (
                <button
                  key={option.id}
                  type="button"
                  className={`poll-message__option${isSelected ? ' is-selected' : ''}`}
                  onClick={() => handleOptionClick(option.id)}
                  disabled={disabled}
                >
                  <span
                    className="poll-message__option-fill"
                    style={{ width: `${percent}%` }}
                    aria-hidden="true"
                  />
                  <span className="poll-message__option-content">
                    <span className="poll-message__option-text">{option.text}</span>
                    <span className="poll-message__option-meta">
                      {percent}% · {option.voteCount}
                    </span>
                  </span>
                </button>
              );
            })}
        </div>

        <div className="poll-message__footer">
          {formatVotesLabel(totalVotes)}
          {normalized.allowMultiple ? ' · можно выбрать несколько' : ''}
          {normalized.isAnonymous ? ' · голоса скрыты' : ''}
        </div>

        {!normalized.isAnonymous && (
          <button
            type="button"
            className="poll-message__results-btn"
            onClick={() => setIsResultsOpen(true)}
          >
            Результаты
          </button>
        )}
      </div>

      <PollResultsModal
        isOpen={isResultsOpen}
        poll={poll}
        onClose={() => setIsResultsOpen(false)}
      />
    </>
  );
}

export default PollMessage;
