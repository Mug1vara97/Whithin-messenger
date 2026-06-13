import React, { useMemo, useState } from 'react';
import { Close, Add, DeleteOutline } from '@mui/icons-material';
import './CreatePollModal.css';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

export function CreatePollModal({ isOpen, onClose, onSubmit, isSubmitting = false }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [error, setError] = useState('');

  const trimmedOptions = useMemo(
    () => options.map((item) => item.trim()).filter(Boolean),
    [options],
  );

  if (!isOpen) {
    return null;
  }

  const handleOptionChange = (index, value) => {
    setOptions((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const handleAddOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((prev) => [...prev, '']);
  };

  const handleRemoveOption = (index) => {
    if (options.length <= MIN_OPTIONS) return;
    setOptions((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      setError('Введите вопрос опроса');
      return;
    }

    if (trimmedOptions.length < MIN_OPTIONS) {
      setError('Добавьте минимум 2 варианта ответа');
      return;
    }

    const success = await onSubmit?.({
      question: trimmedQuestion,
      options: trimmedOptions,
      allowMultiple,
      isAnonymous,
    });

    if (success) {
      setQuestion('');
      setOptions(['', '']);
      setAllowMultiple(false);
      setIsAnonymous(true);
      onClose?.();
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setError('');
    onClose?.();
  };

  return (
    <div className="create-poll-modal" onClick={handleClose}>
      <div className="create-poll-modal__card" onClick={(event) => event.stopPropagation()}>
        <div className="create-poll-modal__header">
          <h3>Создать опрос</h3>
          <button type="button" onClick={handleClose} aria-label="Закрыть">
            <Close fontSize="small" />
          </button>
        </div>

        <form className="create-poll-modal__form" onSubmit={handleSubmit}>
          <label className="create-poll-modal__field">
            <span>Вопрос</span>
            <input
              type="text"
              value={question}
              maxLength={500}
              placeholder="Задайте вопрос"
              onChange={(event) => setQuestion(event.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <div className="create-poll-modal__options">
            <span className="create-poll-modal__options-label">Варианты ответа</span>
            {options.map((option, index) => (
              <div key={`poll-option-${index}`} className="create-poll-modal__option-row">
                <input
                  type="text"
                  value={option}
                  maxLength={200}
                  placeholder={`Вариант ${index + 1}`}
                  onChange={(event) => handleOptionChange(index, event.target.value)}
                  disabled={isSubmitting}
                />
                {options.length > MIN_OPTIONS && (
                  <button
                    type="button"
                    className="create-poll-modal__remove-option"
                    onClick={() => handleRemoveOption(index)}
                    aria-label="Удалить вариант"
                  >
                    <DeleteOutline fontSize="small" />
                  </button>
                )}
              </div>
            ))}
            {options.length < MAX_OPTIONS && (
              <button
                type="button"
                className="create-poll-modal__add-option"
                onClick={handleAddOption}
                disabled={isSubmitting}
              >
                <Add fontSize="small" />
                Добавить вариант
              </button>
            )}
          </div>

          <div className="create-poll-modal__toggles">
            <div className="create-poll-modal__toggle-row">
              <div className="create-poll-modal__toggle-info">
                <span className="create-poll-modal__toggle-title">Несколько вариантов</span>
                <p className="create-poll-modal__toggle-desc">
                  Участники смогут выбрать больше одного ответа
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={allowMultiple}
                  onChange={(event) => setAllowMultiple(event.target.checked)}
                  disabled={isSubmitting}
                />
                <span className="toggle-slider" aria-hidden="true" />
              </label>
            </div>

            <div className="create-poll-modal__toggle-row">
              <div className="create-poll-modal__toggle-info">
                <span className="create-poll-modal__toggle-title">Анонимный опрос</span>
                <p className="create-poll-modal__toggle-desc">
                  {isAnonymous
                    ? 'Голоса участников будут скрыты'
                    : 'Участники увидят, кто за что проголосовал'}
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(event) => setIsAnonymous(event.target.checked)}
                  disabled={isSubmitting}
                />
                <span className="toggle-slider" aria-hidden="true" />
              </label>
            </div>
          </div>

          {error && <div className="create-poll-modal__error">{error}</div>}

          <div className="create-poll-modal__actions">
            <button type="button" className="create-poll-modal__btn create-poll-modal__btn--ghost" onClick={handleClose}>
              Отмена
            </button>
            <button type="submit" className="create-poll-modal__btn create-poll-modal__btn--primary" disabled={isSubmitting}>
              {isSubmitting ? 'Создание…' : 'Создать опрос'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreatePollModal;
