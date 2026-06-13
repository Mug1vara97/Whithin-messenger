import React, { useCallback, useEffect, useRef, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import { useAuthContext } from '../../../lib/contexts/AuthContext';
import './CreateServerModal.css';

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

const CreateServerModal = ({ isOpen, onClose, onCreate }) => {
  const { user } = useAuthContext();
  const username = user?.username || user?.Username || user?.userName || 'Пользователь';
  const fileInputRef = useRef(null);
  const previewUrlRef = useRef(null);

  const [serverName, setServerName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const resetForm = useCallback(() => {
    setServerName('');
    setDescription('');
    setIsPrivate(false);
    setAvatarFile(null);
    setError('');
    setIsSubmitting(false);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setAvatarPreview(null);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setServerName(`Сервер ${username}`);
      setError('');
    } else {
      resetForm();
    }
  }, [isOpen, username, resetForm]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isSubmitting, onClose]);

  useEffect(
    () => () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    },
    []
  );

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Выберите изображение');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Изображение не должно быть больше 5 МБ');
      return;
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    const nextUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextUrl;
    setAvatarPreview(nextUrl);
    setAvatarFile(file);
    setError('');
    event.target.value = '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedName = serverName.trim();
    if (!trimmedName || isSubmitting) return;

    setIsSubmitting(true);
    setError('');
    try {
      await onCreate({
        serverName: trimmedName,
        isPublic: !isPrivate,
        description: description.trim(),
        avatarFile,
      });
    } catch (submitError) {
      setError(submitError.message || 'Не удалось создать сервер');
      setIsSubmitting(false);
    }
  };

  const initials = (serverName.trim() || username).charAt(0).toUpperCase();

  if (!isOpen) return null;

  return (
    <div className="create-server-modal" role="dialog" aria-modal="true" aria-label="Создание сервера">
      <button
        type="button"
        className="create-server-modal__backdrop"
        onClick={isSubmitting ? undefined : onClose}
        aria-label="Закрыть"
      />
      <div className="create-server-modal__dialog">
        <button
          type="button"
          className="create-server-modal__close"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Закрыть"
        >
          <CloseIcon fontSize="small" />
        </button>

        <div className="create-server-modal__intro">
          <h2 className="create-server-modal__title">Персонализируйте свой сервер</h2>
          <p className="create-server-modal__subtitle">
            Выберите название и значок сервера. Их можно будет изменить в любой момент в настройках.
          </p>
        </div>

        <form className="create-server-modal__form" onSubmit={handleSubmit}>
          <button
            type="button"
            className="create-server-modal__icon-picker"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting}
            title="Загрузить значок сервера"
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="" className="create-server-modal__icon-image" />
            ) : (
              <span className="create-server-modal__icon-placeholder">{initials}</span>
            )}
            <span className="create-server-modal__icon-badge">
              <PhotoCameraOutlinedIcon sx={{ fontSize: 16 }} />
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleAvatarChange}
          />

          <label className="create-server-modal__field-label" htmlFor="create-server-name">
            Название сервера <span className="create-server-modal__required">*</span>
          </label>
          <input
            id="create-server-name"
            type="text"
            className="create-server-modal__input"
            value={serverName}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setServerName(e.target.value)}
            disabled={isSubmitting}
            autoComplete="off"
          />

          <label className="create-server-modal__field-label" htmlFor="create-server-description">
            Описание
          </label>
          <textarea
            id="create-server-description"
            className="create-server-modal__textarea"
            value={description}
            maxLength={MAX_DESCRIPTION_LENGTH}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Расскажите, о чём ваш сервер"
            rows={3}
            disabled={isSubmitting}
          />

          <div className="create-server-modal__row">
            <div className="create-server-modal__row-info">
              <span className="create-server-modal__row-title">Приватный сервер</span>
              <p className="create-server-modal__row-desc">
                Сервер не будет виден в обнаружении — только по приглашению
              </p>
            </div>
            <label className="create-server-modal__switch">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                disabled={isSubmitting}
              />
              <span className="create-server-modal__switch-slider" />
            </label>
          </div>

          {error && <p className="create-server-modal__error">{error}</p>}

          <div className="create-server-modal__footer">
            <button
              type="button"
              className="create-server-modal__back"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Назад
            </button>
            <button
              type="submit"
              className="create-server-modal__submit"
              disabled={!serverName.trim() || isSubmitting}
            >
              {isSubmitting ? 'Создание…' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateServerModal;
