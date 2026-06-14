import React from 'react';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import ForwardOutlined from '@mui/icons-material/ForwardOutlined';
import './MessageSelectionBar.css';

const MessageSelectionBar = ({
  selectedCount = 0,
  canForward = false,
  canDelete = false,
  onCancel,
  onForward,
  onDelete,
}) => (
  <div className="message-selection-bar" role="toolbar" aria-label="Действия с выбранными сообщениями">
    <div className="message-selection-bar__actions">
      <button
        type="button"
        className="message-selection-bar__btn"
        onClick={onForward}
        disabled={!canForward}
      >
        <ForwardOutlined fontSize="small" />
        <span>Переслать</span>
      </button>
      <button
        type="button"
        className="message-selection-bar__btn message-selection-bar__btn--danger"
        onClick={onDelete}
        disabled={!canDelete}
      >
        <DeleteOutline fontSize="small" />
        <span>Удалить</span>
      </button>
    </div>

    <span className="message-selection-bar__count">
      {selectedCount > 0 ? `Выбрано: ${selectedCount}` : 'Выберите сообщения'}
    </span>

    <button
      type="button"
      className="message-selection-bar__btn message-selection-bar__btn--cancel"
      onClick={onCancel}
    >
      Отменить
    </button>
  </div>
);

export default MessageSelectionBar;
