import React, { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import './ChannelSettingsModal.css';

const ChannelSettingsModal = ({
  isOpen,
  onClose,
  channel,
  onUpdateChannel,
  onDeleteChannel
}) => {
  const [channelName, setChannelName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && channel) {
      setChannelName(channel.name || channel.groupName || '');
      setError(null);
    }
  }, [isOpen, channel]);

  const handleUpdate = async () => {
    if (!channelName.trim()) {
      setError('Название канала не может быть пустым');
      return;
    }

    if (channelName.trim() === (channel?.name || channel?.groupName)) {
      onClose();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onUpdateChannel(channel.chatId, channelName.trim());
      onClose();
    } catch (err) {
      setError(err.message || 'Ошибка при обновлении канала');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Вы уверены, что хотите удалить этот канал?')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onDeleteChannel(channel.chatId);
      onClose();
    } catch (err) {
      setError(err.message || 'Ошибка при удалении канала');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleUpdate();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen || !channel) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Настройки канала</h2>
          <button className="close-button" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="channelName">Название канала</label>
            <input
              id="channelName"
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Введите название канала"
              className={error ? 'error' : ''}
              autoFocus
              disabled={isLoading}
            />
            {error && <div className="error-message">{error}</div>}
          </div>

          <div className="channel-info">
            <div className="info-item">
              <span className="info-label">Тип канала:</span>
              <span className="info-value">
                {channel.chatType === 4 || channel.typeId === 4 ? 'Голосовой' : 'Текстовый'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">ID канала:</span>
              <span className="info-value">{channel.chatId}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="delete-button"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? 'Удаление...' : 'Удалить канал'}
          </button>
          <div className="footer-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={onClose}
              disabled={isLoading}
            >
              Отмена
            </button>
            <button
              type="button"
              className="save-button"
              onClick={handleUpdate}
              disabled={isLoading}
            >
              {isLoading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChannelSettingsModal;
