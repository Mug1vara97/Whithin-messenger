import React, { useState, useEffect } from 'react';
import { FaTimes, FaHashtag, FaVolumeUp } from 'react-icons/fa';
import './CreateChannelModal.css';

const CreateChannelModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  categoryId,
  categoryName 
}) => {
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState(3); // 3 - текстовый, 4 - голосовой
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setChannelName('');
      setChannelType(3);
      setErrors({});
    }
  }, [isOpen]);

  const validateForm = () => {
    const newErrors = {};

    if (!channelName.trim()) {
      newErrors.name = 'Название канала обязательно';
    } else if (channelName.length < 2) {
      newErrors.name = 'Название должно содержать минимум 2 символа';
    } else if (channelName.length > 100) {
      newErrors.name = 'Название не должно превышать 100 символов';
    } else if (!/^[a-z0-9_-]+$/i.test(channelName)) {
      newErrors.name = 'Название может содержать только буквы, цифры, дефисы и подчеркивания';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});
    
    try {
      await onSubmit({
        name: channelName.trim(),
        type: channelType,
        categoryId: categoryId || null
      });
      
    } catch (error) {
      console.error('Ошибка создания канала:', error);
      
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Ошибка создания канала';
      
      setErrors({ submit: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="create-channel-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Создать канал</h2>
          <button className="close-button" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="category">Категория</label>
              <div className="category-display">
                {categoryName || 'Без категории'}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="channelType">Тип канала</label>
              <div className="channel-type-selector">
                <label className={`type-option ${channelType === 3 ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="channelType"
                    value="3"
                    checked={channelType === 3}
                    onChange={(e) => setChannelType(parseInt(e.target.value))}
                  />
                  <div className="type-content">
                    <FaHashtag className="type-icon" />
                    <div>
                      <div className="type-name">Текстовый канал</div>
                      <div className="type-description">Отправляйте сообщения, изображения, GIF, эмодзи, мнения и файлы</div>
                    </div>
                  </div>
                </label>

                <label className={`type-option ${channelType === 4 ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="channelType"
                    value="4"
                    checked={channelType === 4}
                    onChange={(e) => setChannelType(parseInt(e.target.value))}
                  />
                  <div className="type-content">
                    <FaVolumeUp className="type-icon" />
                    <div>
                      <div className="type-name">Голосовой канал</div>
                      <div className="type-description">Говорите вместе с другими участниками в реальном времени</div>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="channelName">Название канала</label>
              <div className="input-container">
                <span className="input-prefix">
                  {channelType === 3 ? '#' : '🔊'}
                </span>
                <input
                  id="channelName"
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder={channelType === 3 ? 'новый-канал' : 'Новый канал'}
                  className={errors.name ? 'error' : ''}
                  autoFocus
                />
              </div>
              {errors.name && <div className="error-message">{errors.name}</div>}
            </div>

            {errors.submit && (
              <div className="error-message submit-error">{errors.submit}</div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="cancel-button" onClick={onClose}>
              Отмена
            </button>
            <button 
              type="submit" 
              className="create-button"
              disabled={isLoading || !channelName.trim()}
            >
              {isLoading ? 'Создание...' : 'Создать канал'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateChannelModal;
