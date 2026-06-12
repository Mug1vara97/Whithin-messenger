import React, { useState, useEffect, useCallback, useRef } from 'react';
import ContentPasteOutlinedIcon from '@mui/icons-material/ContentPasteOutlined';
import { FaTimes, FaVolumeUp, FaLock, FaHashtag } from 'react-icons/fa';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import { useAuthContext } from '../../../lib/contexts/AuthContext';
import tokenManager from '../../../lib/services/tokenManager';
import './CreateChannelModal.css';

const getAuthHeaders = () => {
  const token = tokenManager.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const CHANNEL_TYPE_OPTIONS = [
  {
    value: 3,
    label: 'Текст',
    description: 'Отправляйте сообщения, изображения, GIF, эмодзи, мнения и файлы',
    placeholder: 'новый-канал',
    renderIcon: () => <FaHashtag aria-hidden />,
    renderPrefix: () => '#',
  },
  {
    value: 4,
    label: 'Голос',
    description: 'Общайтесь голосом вместе с другими участниками в реальном времени',
    placeholder: 'общий-голосовой',
    renderIcon: () => <FaVolumeUp aria-hidden />,
    renderPrefix: () => <FaVolumeUp aria-hidden />,
  },
  {
    value: 5,
    label: 'Доска',
    description: 'Коллективная доска с карточками идей, тегами и связями',
    placeholder: 'идеи-команды',
    renderIcon: () => <ContentPasteOutlinedIcon fontSize="small" aria-hidden />,
    renderPrefix: () => <ContentPasteOutlinedIcon fontSize="small" aria-hidden />,
  },
];

const CreateChannelModal = ({
  isOpen,
  onClose,
  onSubmit,
  categoryId,
  categoryName,
  serverId,
  serverConnection,
}) => {
  const { user } = useAuthContext();
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState(3);
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [serverMembers, setServerMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const membersHandlerRef = useRef(null);

  const fetchServerMembers = useCallback(async () => {
    if (!serverId) return;
    setMembersLoading(true);
    try {
      if (serverConnection?.state === 'Connected') {
        const handler = (loadedMembers) => {
          setServerMembers(Array.isArray(loadedMembers) ? loadedMembers : []);
          setMembersLoading(false);
          serverConnection.off('ServerMembersLoaded', handler);
        };
        membersHandlerRef.current = handler;
        serverConnection.on('ServerMembersLoaded', handler);
        await serverConnection.invoke('GetServerMembers', serverId);
        setTimeout(() => {
          setMembersLoading((prev) => {
            if (prev) serverConnection.off('ServerMembersLoaded', membersHandlerRef.current);
            return false;
          });
        }, 10000);
      } else {
        const res = await fetch(`${BASE_URL}/api/server/${serverId}/members`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data?.members ?? []);
          setServerMembers(Array.isArray(list) ? list : []);
        } else {
          setServerMembers([]);
        }
        setMembersLoading(false);
      }
    } catch {
      setServerMembers([]);
      setMembersLoading(false);
      if (serverConnection && membersHandlerRef.current) {
        serverConnection.off('ServerMembersLoaded', membersHandlerRef.current);
      }
    }
  }, [serverId, serverConnection]);

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
    } else if (!/^[\p{L}\p{N}\s_-]+$/u.test(channelName.trim())) {
      newErrors.name = 'Название может содержать буквы, цифры, пробелы, дефисы и подчеркивания';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const toggleMember = (userId) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
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
        memberIds: isPrivate ? selectedMemberIds : [],
      });
    } catch (error) {
      console.error('Ошибка создания канала:', error);

      const errorMessage =
        error.response?.data?.message || error.message || 'Ошибка создания канала';

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

  const selectedChannelType =
    CHANNEL_TYPE_OPTIONS.find((option) => option.value === channelType) ??
    CHANNEL_TYPE_OPTIONS[0];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="create-channel-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-text">
            <h2>Создать канал</h2>
            <p className="modal-subtitle">в {categoryName || 'Без категории'}</p>
          </div>
          <button type="button" className="close-button" onClick={onClose} aria-label="Закрыть">
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
          <div className="modal-body">
            <fieldset className="channel-type-list">
              <legend className="form-section-label">Тип канала</legend>
              {CHANNEL_TYPE_OPTIONS.map((option) => {
                const isSelected = channelType === option.value;
                return (
                  <label
                    key={option.value}
                    className={`channel-type-option ${isSelected ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="channelType"
                      value={option.value}
                      checked={isSelected}
                      onChange={() => setChannelType(option.value)}
                      className="channel-type-radio-input"
                    />
                    <span className="channel-type-radio" aria-hidden="true" />
                    <span className="channel-type-info">
                      <span className="channel-type-head">
                        <span className="channel-type-icon">{option.renderIcon()}</span>
                        <span className="channel-type-name">{option.label}</span>
                      </span>
                      <span className="channel-type-desc">{option.description}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <div className="channel-name-group">
              <label htmlFor="channelName" className="form-section-label">
                Название канала
              </label>
              <div
                className={`channel-name-field ${errors.name ? 'has-error' : ''}`}
                data-channel-type={channelType}
              >
                <span className="channel-name-prefix" aria-hidden="true">
                  {selectedChannelType.renderPrefix()}
                </span>
                <input
                  id="channelName"
                  type="text"
                  className="channel-name-input"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder={selectedChannelType.placeholder}
                  autoComplete="off"
                />
              </div>
              {errors.name && <div className="error-message">{errors.name}</div>}
            </div>

            <div className="private-channel-row">
              <div className="private-channel-info">
                <div className="private-channel-title">
                  <FaLock className="private-icon" aria-hidden />
                  <span>Приватный канал</span>
                </div>
                <p className="private-channel-desc">
                  Только выбранные участники смогут просматривать этот канал
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                />
                <span className="toggle-slider" aria-hidden="true" />
              </label>
            </div>

            {isPrivate && serverId && (
              <div className="form-group member-picker">
                <label className="form-section-label">Кто имеет доступ</label>
                {membersLoading ? (
                  <div className="members-loading">Загрузка участников...</div>
                ) : (
                  <div className="member-list">
                    {serverMembers
                      .filter((m) => (m.userId ?? m.user_id) !== user?.id)
                      .map((m) => (
                        <label key={m.userId || m.user_id} className="member-option">
                          <input
                            type="checkbox"
                            checked={selectedMemberIds.includes(m.userId ?? m.user_id)}
                            onChange={() => toggleMember(m.userId ?? m.user_id)}
                          />
                          <span className="member-name">
                            {m.username ?? m.userName ?? m.user_name ?? 'Участник'}
                          </span>
                        </label>
                      ))}
                    {serverMembers.length === 0 && !membersLoading && (
                      <div className="no-members">
                        Загрузите участников сервера или добавьте себя позже.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

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
