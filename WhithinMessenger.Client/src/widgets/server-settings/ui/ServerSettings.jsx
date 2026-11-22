import React, { useState, useRef, useEffect } from 'react';
import { PhotoCamera, Upload } from '@mui/icons-material';
import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import tokenManager from '../../../shared/lib/services/tokenManager';
import './ServerSettings.css';
import { appToast } from '../../../shared/lib/utils/appToast';

const BANNER_PRESET_COLORS = [
  { value: '#000000', title: 'Чёрный' },
  { value: '#2b2d31', title: 'Графит' },
  { value: '#ffffff', title: 'Белый' },
  { value: '#8e9297', title: 'Серый' },
  { value: '#f44336', title: 'Красный' },
  { value: '#e91e63', title: 'Малиновый' },
  { value: '#ff73b3', title: 'Розовый' },
  { value: '#ff6b35', title: 'Оранжевый' },
  { value: '#ffa500', title: 'Янтарный' },
  { value: '#ffff00', title: 'Жёлтый' },
  { value: '#cddc39', title: 'Лайм' },
  { value: '#4caf50', title: 'Зелёный' },
  { value: '#009688', title: 'Бирюзовый' },
  { value: '#00bcd4', title: 'Голубой' },
  { value: '#2196f3', title: 'Синий' },
  { value: '#3f51b5', title: 'Индиго' },
  { value: '#9c27b0', title: 'Фиолетовый' },
  { value: '#673ab7', title: 'Пурпурный' },
  { value: '#795548', title: 'Коричневый' },
  { value: '#5d4037', title: 'Шоколад' },
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
      appToast.alert('Название сервера не может быть пустым');
      return;
    }

    try {
      setIsSaving(true);
      await connection.invoke('UpdateServerName', serverId, serverName);
      onServerUpdate({ ...server, name: serverName });
    } catch (error) {
      appToast.alert(`Ошибка обновления названия сервера: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleServerDescriptionUpdate = async () => {
    if (serverDescription.length > MAX_DESCRIPTION_LENGTH) {
      appToast.alert(`Описание не должно превышать ${MAX_DESCRIPTION_LENGTH} символов`);
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
      appToast.alert(`Ошибка обновления описания сервера: ${error.message}`);
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
      appToast.alert(`Ошибка обновления приватности сервера: ${error.message}`);
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
      appToast.alert('Пожалуйста, выберите изображение');
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
      appToast.alert('Не удалось загрузить баннер. Пожалуйста, попробуйте еще раз.');
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
      appToast.alert('Не удалось обновить цвет баннера. Пожалуйста, попробуйте еще раз.');
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
      appToast.alert(error.message);
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
      appToast.alert(error.message);
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
    <div className="server-studio">
      <section className="server-studio-hero" style={bannerStyle}>
        <div className="server-studio-hero__shade" />
        <div className="server-studio-hero__main">
          <button
            type="button"
            className="server-studio-hero__avatar"
            style={avatarStyle}
            onClick={() => avatarInputRef.current?.click()}
            aria-label="Загрузить значок"
          >
            {!server?.avatar && avatarLetter}
          </button>
          <div className="server-studio-hero__copy">
            <h2>{displayName}</h2>
            <p>{serverDescription.trim() || 'Описание ещё не задано'}</p>
            <span>{isPrivate ? 'Только по приглашению' : 'Открыт в обнаружении'}</span>
          </div>
        </div>
        <div className="server-studio-hero__tools">
          <button type="button" onClick={() => bannerInputRef.current?.click()}>
            <Upload fontSize="small" />
            Баннер
          </button>
          {server?.avatar && (
            <button type="button" onClick={handleAvatarRemove}>Убрать значок</button>
          )}
          {server?.banner && (
            <button type="button" onClick={handleBannerRemove}>Убрать баннер</button>
          )}
        </div>
        <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} hidden />
        <input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerFileUpload} hidden />
      </section>

      <div className="server-studio-grid">
        <article className="server-studio-card">
          <h3>Название</h3>
          <input
            id="server-profile-name"
            type="text"
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            placeholder="Название сервера"
            maxLength={100}
          />
          <button
            type="button"
            className="settings-btn settings-btn--primary"
            onClick={handleServerNameUpdate}
            disabled={isSaving || !nameChanged || !serverName.trim()}
          >
            {isSaving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </article>

        <article className="server-studio-card server-studio-card--switch">
          <div>
            <h3>Приватность</h3>
            <p>{isPrivate ? 'Сервер скрыт из обнаружения' : 'Сервер можно найти и вступить'}</p>
          </div>
          <label className={`settings-switch${isSavingPrivacy ? ' settings-switch--disabled' : ''}`}>
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => handlePrivacyChange(e.target.checked)}
              disabled={isSavingPrivacy}
            />
            <span className="settings-switch__slider" />
          </label>
        </article>

        <article className="server-studio-card server-studio-card--wide">
          <div className="server-studio-card__head">
            <h3>Описание</h3>
            <span>{serverDescription.length}/{MAX_DESCRIPTION_LENGTH}</span>
          </div>
          <textarea
            id="server-profile-description"
            value={serverDescription}
            onChange={(e) => setServerDescription(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
            placeholder="О чём этот сервер"
            rows={4}
            maxLength={MAX_DESCRIPTION_LENGTH}
          />
          <button
            type="button"
            className="settings-btn settings-btn--primary"
            onClick={handleServerDescriptionUpdate}
            disabled={isSavingDescription || !descriptionChanged}
          >
            {isSavingDescription ? 'Сохранение…' : 'Сохранить'}
          </button>
        </article>

        <article className="server-studio-card">
          <h3>Значок</h3>
          <p>512×512, PNG или JPG. Нажмите на значок в баннере, чтобы заменить.</p>
          <button
            type="button"
            className="settings-btn settings-btn--primary"
            onClick={() => avatarInputRef.current?.click()}
          >
            <PhotoCamera fontSize="small" />
            Загрузить значок
          </button>
        </article>

        <article className="server-studio-card server-studio-card--wide">
          <h3>Цвет баннера</h3>
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
          <div className="server-studio-card__row">
            <label className="server-rgb-picker">
              <input
                type="color"
                value={bannerColor || '#3f3f3f'}
                onChange={(e) => {
                  setBannerColor(e.target.value);
                  setIsDefaultColor(false);
                }}
                aria-label="Свой цвет баннера"
              />
              <span className="server-rgb-picker__swatch" style={{ background: bannerColor || '#3f3f3f' }} />
              <span className="server-rgb-picker__label">Свой цвет</span>
            </label>
            <button type="button" className="settings-btn settings-btn--ghost" onClick={handleResetToDefault}>
              Сбросить
            </button>
            <button type="button" className="settings-btn settings-btn--primary" onClick={handleBannerColorUpdate}>
              Сохранить цвет
            </button>
          </div>
          {isDefaultColor && <p>Сейчас цвет по умолчанию</p>}
        </article>
      </div>
    </div>
  );
};

export default ServerSettings;
