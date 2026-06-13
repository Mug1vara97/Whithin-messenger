import React, { useState, useRef, useEffect } from 'react';
import { PhotoCamera, Upload } from '@mui/icons-material';
import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import tokenManager from '../../../shared/lib/services/tokenManager';
import './ServerSettings.css';

const BANNER_PRESET_COLORS = [
  { value: '#000000', title: 'Чёрный' },
  { value: '#ff73b3', title: 'Розовый' },
  { value: '#ff6b35', title: 'Оранжевый' },
  { value: '#ffa500', title: 'Янтарный' },
  { value: '#ffff00', title: 'Жёлтый' },
  { value: '#9c27b0', title: 'Фиолетовый' },
  { value: '#4caf50', title: 'Зелёный' },
  { value: '#2196f3', title: 'Синий' },
  { value: '#f44336', title: 'Красный' },
];

const MAX_DESCRIPTION_LENGTH = 500;

const getAuthHeaders = () => {
  const token = tokenManager.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const ServerSettings = ({
  connection,
  serverId,
  server,
  onServerUpdate,
  userPermissions,
  isServerOwner,
}) => {
  const [serverName, setServerName] = useState(server?.name || '');
  const [serverDescription, setServerDescription] = useState(server?.description || '');
  const [bannerColor, setBannerColor] = useState(server?.bannerColor || '#3f3f3f');
  const [isDefaultColor, setIsDefaultColor] = useState(!server?.bannerColor);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);
  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  useEffect(() => {
    setServerName(server?.name || '');
    setServerDescription(server?.description || '');
    setBannerColor(server?.bannerColor || '#3f3f3f');
    setIsDefaultColor(!server?.bannerColor);
  }, [server?.name, server?.description, server?.bannerColor, server?.avatar, server?.banner]);

  const displayName = serverName.trim() || 'Сервер';
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const nameChanged = serverName.trim() !== (server?.name || '').trim();
  const descriptionChanged =
    serverDescription.trim() !== (server?.description || '').trim();
  const isPublic = Boolean(server?.isPublic);
  const isPrivate = !isPublic;

  const handleServerNameUpdate = async () => {
    if (!serverName.trim()) {
      alert('Название сервера не может быть пустым');
      return;
    }

    try {
      setIsSaving(true);
      await connection.invoke('UpdateServerName', serverId, serverName);
      onServerUpdate({ ...server, name: serverName });
    } catch (error) {
      alert(`Ошибка обновления названия сервера: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleServerDescriptionUpdate = async () => {
    if (serverDescription.length > MAX_DESCRIPTION_LENGTH) {
      alert(`Описание не должно превышать ${MAX_DESCRIPTION_LENGTH} символов`);
      return;
    }

    try {
      setIsSavingDescription(true);
      const nextDescription = serverDescription.trim();
      await connection.invoke('UpdateServerDescription', serverId, nextDescription || null);
      onServerUpdate({
        ...server,
        description: nextDescription || null,
      });
    } catch (error) {
      alert(`Ошибка обновления описания сервера: ${error.message}`);
    } finally {
      setIsSavingDescription(false);
    }
  };

  const handlePrivacyChange = async (nextIsPrivate) => {
    const nextIsPublic = !nextIsPrivate;
    if (nextIsPublic === isPublic) return;

    try {
      setIsSavingPrivacy(true);
      await connection.invoke('UpdateServerPrivacy', serverId, nextIsPublic);
      onServerUpdate({ ...server, isPublic: nextIsPublic });
    } catch (error) {
      alert(`Ошибка обновления приватности сервера: ${error.message}`);
    } finally {
      setIsSavingPrivacy(false);
    }
  };

  const handleBannerRemove = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/server/${serverId}/banner`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        onServerUpdate(await response.json());
      }
    } catch (error) {
      console.error('Ошибка при удалении баннера:', error);
    }
  };

  const handleBannerFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${BASE_URL}/api/server/${serverId}/banner`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Ошибка при загрузке баннера');
      }

      const serverInfo = await connection.invoke('GetServerInfo', serverId);
      onServerUpdate(serverInfo);
      setBannerColor(serverInfo.bannerColor || '#3f3f3f');
    } catch (error) {
      console.error('Ошибка при загрузке баннера:', error);
      alert('Не удалось загрузить баннер. Пожалуйста, попробуйте еще раз.');
    } finally {
      event.target.value = '';
    }
  };

  const handleBannerColorUpdate = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/server/${serverId}/banner`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          bannerColor: isDefaultColor ? null : bannerColor,
        }),
      });

      if (!response.ok) {
        throw new Error('Ошибка при обновлении цвета баннера');
      }

      const serverInfo = await connection.invoke('GetServerInfo', serverId);
      onServerUpdate(serverInfo);
      setBannerColor(serverInfo.bannerColor || '#3f3f3f');
      setIsDefaultColor(!serverInfo.bannerColor);
    } catch (error) {
      console.error('Ошибка при обновлении цвета баннера:', error);
      alert('Не удалось обновить цвет баннера. Пожалуйста, попробуйте еще раз.');
    }
  };

  const handleResetToDefault = () => {
    setBannerColor('#3f3f3f');
    setIsDefaultColor(true);
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${BASE_URL}/api/server/${serverId}/avatar`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        onServerUpdate({ ...server, avatar: data.avatar });
      } else {
        throw new Error('Ошибка при обновлении аватара');
      }
    } catch (error) {
      console.error('Ошибка при загрузке аватара:', error);
      alert(error.message);
    } finally {
      event.target.value = '';
    }
  };

  const handleAvatarRemove = async () => {
    if (!window.confirm('Вы уверены, что хотите удалить значок сервера?')) {
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/api/server/${serverId}/avatar`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        onServerUpdate({ ...server, avatar: null });
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Ошибка при удалении аватара');
      }
    } catch (error) {
      console.error('Ошибка при удалении аватара:', error);
      alert(error.message);
    }
  };

  if (!isServerOwner && !userPermissions?.manageServer) {
    return null;
  }

  const bannerStyle = {
    backgroundColor: bannerColor || '#3f3f3f',
    backgroundImage: server?.banner ? `url(${BASE_URL}${server.banner})` : 'none',
  };

  const avatarStyle = {
    backgroundColor: 'var(--primary)',
    backgroundImage: server?.avatar ? `url(${BASE_URL}${server.avatar})` : 'none',
  };

  return (
    <div className="server-profile">
      <div className="server-profile-preview">
        <div className="server-profile-preview__banner" style={bannerStyle} />
        <div className="server-profile-preview__body">
          <div className="server-profile-preview__avatar" style={avatarStyle}>
            {!server?.avatar && avatarLetter}
          </div>
          <div className="server-profile-preview__name">{displayName}</div>
          {serverDescription.trim() && (
            <p className="server-profile-preview__desc">{serverDescription.trim()}</p>
          )}
        </div>
      </div>

      <div className="server-profile-card">
        <section className="server-profile-section">
          <div className="server-profile-section__head">
            <span className="server-profile-section__title">Название сервера</span>
            <p className="server-profile-section__desc">
              Отображается в списке серверов, каналах и настройках.
            </p>
          </div>
          <div className="server-profile-name-field">
            <input
              type="text"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="Введите название сервера"
              maxLength={100}
            />
            <button
              type="button"
              className="server-profile-btn server-profile-btn--primary"
              onClick={handleServerNameUpdate}
              disabled={isSaving || !nameChanged || !serverName.trim()}
            >
              {isSaving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </section>

        <section className="server-profile-section">
          <div className="server-profile-section__head">
            <span className="server-profile-section__title">Описание</span>
            <p className="server-profile-section__desc">
              Расскажите, о чём этот сервер. Видно в обзоре и профиле сервера.
            </p>
          </div>
          <div className="server-profile-description-field">
            <textarea
              className="server-profile-description-input"
              value={serverDescription}
              onChange={(e) => setServerDescription(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
              placeholder="Добавьте описание сервера"
              rows={4}
              maxLength={MAX_DESCRIPTION_LENGTH}
            />
            <div className="server-profile-description-footer">
              <span className="server-profile-description-counter">
                {serverDescription.length}/{MAX_DESCRIPTION_LENGTH}
              </span>
              <button
                type="button"
                className="server-profile-btn server-profile-btn--primary"
                onClick={handleServerDescriptionUpdate}
                disabled={isSavingDescription || !descriptionChanged}
              >
                {isSavingDescription ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </section>

        <section className="server-profile-section">
          <div className="server-profile-section__head">
            <span className="server-profile-section__title">Приватность сервера</span>
            <p className="server-profile-section__desc">
              {isPrivate
                ? 'Сервер скрыт из обнаружения. Новые участники могут попасть только по приглашению.'
                : 'Сервер виден в обнаружении — любой пользователь может найти и присоединиться к нему.'}
            </p>
          </div>
          <div className="server-profile-privacy-row">
            <div className="server-profile-privacy-row__info">
              <span className="server-profile-privacy-row__title">Приватный сервер</span>
              <p className="server-profile-privacy-row__hint">
                {isSavingPrivacy ? 'Сохранение…' : isPrivate ? 'Сейчас: приватный' : 'Сейчас: публичный'}
              </p>
            </div>
            <label className="server-profile-switch">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => handlePrivacyChange(e.target.checked)}
                disabled={isSavingPrivacy}
              />
              <span className="server-profile-switch__slider" />
            </label>
          </div>
        </section>

        <section className="server-profile-section">
          <div className="server-profile-section__head">
            <span className="server-profile-section__title">Значок сервера</span>
            <p className="server-profile-section__desc">
              Рекомендуемый размер — 512×512 px. PNG или JPG.
            </p>
          </div>
          <div className="server-profile-icon-row">
            <button
              type="button"
              className="server-profile-icon-preview"
              style={avatarStyle}
              onClick={() => avatarInputRef.current?.click()}
              aria-label="Загрузить значок"
            >
              {!server?.avatar && avatarLetter}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              hidden
            />
            <div className="server-profile-icon-actions">
              <button
                type="button"
                className="server-profile-btn server-profile-btn--primary server-profile-btn--with-icon"
                onClick={() => avatarInputRef.current?.click()}
              >
                <PhotoCamera fontSize="small" />
                Загрузить
              </button>
              {server?.avatar && (
                <button
                  type="button"
                  className="server-profile-btn server-profile-btn--danger"
                  onClick={handleAvatarRemove}
                >
                  Удалить
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="server-profile-section">
          <div className="server-profile-section__head">
            <span className="server-profile-section__title">Баннер</span>
            <p className="server-profile-section__desc">
              Фон профиля сервера. Можно загрузить изображение или выбрать цвет.
            </p>
          </div>

          <label
            className="server-profile-banner-upload"
            style={bannerStyle}
          >
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              onChange={handleBannerFileUpload}
              hidden
            />
            {!server?.banner ? (
              <div className="server-profile-banner-upload__placeholder">
                <Upload sx={{ fontSize: 22 }} />
                <span>Нажмите, чтобы загрузить баннер</span>
              </div>
            ) : (
              <div className="server-profile-banner-upload__overlay" aria-hidden="true">
                <Upload sx={{ fontSize: 18 }} />
                <span>Изменить баннер</span>
              </div>
            )}
          </label>

          {server?.banner && (
            <div className="server-profile-banner-tools">
              <button
                type="button"
                className="server-profile-btn server-profile-btn--danger"
                onClick={handleBannerRemove}
              >
                Удалить баннер
              </button>
            </div>
          )}

          <div className="server-profile-colors">
            {BANNER_PRESET_COLORS.map(({ value, title }) => (
              <button
                key={value}
                type="button"
                className={`server-profile-color ${bannerColor === value && !isDefaultColor ? 'server-profile-color--selected' : ''}`}
                style={{ background: value }}
                title={title}
                onClick={() => {
                  setBannerColor(value);
                  setIsDefaultColor(false);
                }}
              />
            ))}
          </div>

          <div className="server-profile-color-custom">
            <input
              type="color"
              value={bannerColor || '#3f3f3f'}
              onChange={(e) => {
                setBannerColor(e.target.value);
                setIsDefaultColor(false);
              }}
              aria-label="Свой цвет баннера"
            />
            <button
              type="button"
              className="server-profile-btn server-profile-btn--ghost"
              onClick={handleResetToDefault}
            >
              Сбросить цвет
            </button>
          </div>

          <div className="server-profile-banner-footer">
            <button
              type="button"
              className="server-profile-btn server-profile-btn--primary"
              onClick={handleBannerColorUpdate}
            >
              Сохранить цвет
            </button>
            {isDefaultColor && (
              <span className="server-profile-status">Используется цвет по умолчанию</span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ServerSettings;
