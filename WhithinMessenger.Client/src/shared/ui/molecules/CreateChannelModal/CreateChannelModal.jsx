import React, { useState, useEffect, useCallback } from 'react';
import { FaTimes, FaHashtag, FaVolumeUp, FaLock } from 'react-icons/fa';
import { BASE_URL } from '../../../../lib/constants/apiEndpoints';
import { useAuthContext } from '../../../../lib/contexts/AuthContext';
import './CreateChannelModal.css';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const CreateChannelModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  categoryId,
  categoryName,
  serverId 
}) => {
  const { user } = useAuthContext();
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState(3); // 3 - текстовый, 4 - голосовой
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [serverMembers, setServerMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const fetchServerMembers = useCallback(async () => {
    if (!serverId) return;
    setMembersLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/server/${serverId}/members`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
      });
      if (res.ok) {
        const data = await res.json();
        setServerMembers(Array.isArray(data) ? data : []);
      } else {
        setServerMembers([]);
      }
    } catch {
      setServerMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    if (isOpen) {
      setChannelName('');
      setChannelType(3);
      setIsPrivate(false);
      setSelectedMemberIds([]);
      setErrors({});
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && isPrivate && serverId) {
      fetchServerMembers();
    } else if (!isPrivate) {
      setServerMembers([]);
      setSelectedMemberIds([]);
    }
  }, [isOpen, isPrivate, serverId, fetchServerMembers]);

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

  const toggleMember = (userId) => {
    setSelectedMemberIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
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
        categoryId: categoryId || null,
        isPrivate: isPrivate,
        memberIds: isPrivate ? selectedMemberIds : []
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
              <label className="private-channel-label">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                />
                <FaLock className="private-icon" />
                Приватный канал — видят только добавленные участники
              </label>
            </div>

            {isPrivate && serverId && (
              <div className="form-group member-picker">
                <label>Кто имеет доступ</label>
                {membersLoading ? (
                  <div className="members-loading">Загрузка участников...</div>
                ) : (
                  <div className="member-list">
                    {serverMembers
                      .filter(m => (m.userId ?? m.user_id) !== user?.id)
                      .map(m => (
                        <label key={m.userId || m.user_id} className="member-option">
                          <input
                            type="checkbox"
                            checked={selectedMemberIds.includes(m.userId ?? m.user_id)}
                            onChange={() => toggleMember(m.userId ?? m.user_id)}
                          />
                          <span className="member-name">{m.username ?? m.userName ?? m.user_name ?? 'Участник'}</span>
                        </label>
                      ))}
                    {serverMembers.length === 0 && !membersLoading && (
                      <div className="no-members">Загрузите участников сервера или добавьте себя позже.</div>
                    )}
                  </div>
                )}
              </div>
            )}

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
