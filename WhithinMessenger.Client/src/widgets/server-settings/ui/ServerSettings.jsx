import React, { useState } from 'react';
import { FaImage, FaTrash, FaUpload } from 'react-icons/fa';
import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import tokenManager from '../../../shared/lib/services/tokenManager';
import { Button } from '../../../shared/ui/atoms/Button';
import { FormField } from '../../../shared/ui/atoms/FormField';
import './ServerSettings.css';

// Хелпер для получения заголовков авторизации
const getAuthHeaders = () => {
  const token = tokenManager.getToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const ServerSettings = ({ 
  connection, 
  serverId, 
  userId, 
  server, 
  onServerUpdate,
  userPermissions, 
  isServerOwner 
}) => {
  const [serverName, setServerName] = useState(server?.name || '');
  const [bannerUrl, setBannerUrl] = useState('');
  const [bannerColor, setBannerColor] = useState(server?.bannerColor || '#3f3f3f');
  const [isDefaultColor, setIsDefaultColor] = useState(!server?.bannerColor);
  const [isEditingBanner, setIsEditingBanner] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleServerNameUpdate = async () => {
    if (!serverName.trim()) {
      alert('Название сервера не может быть пустым');
      return;
    }
    
    try {
      setIsSaving(true);
      await connection.invoke("UpdateServerName", serverId, serverName);
      onServerUpdate({ ...server, name: serverName });
      alert('Название сервера успешно обновлено');
    } catch (error) {
      alert(`Ошибка обновления названия сервера: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBannerUpdate = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/server/${serverId}/banner`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          banner: bannerUrl,
          bannerColor: bannerColor
        })
      });

      if (response.ok) {
        const updatedServer = await response.json();
        onServerUpdate(updatedServer);
        setIsEditingBanner(false);
      }
    } catch (error) {
      console.error('Ошибка при обновлении баннера:', error);
    }
  };

  const handleBannerRemove = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/server/${serverId}/banner`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const updatedServer = await response.json();
        onServerUpdate(updatedServer);
      }
    } catch (error) {
      console.error('Ошибка при удалении баннера:', error);
    }
  };

  const handleBannerFileUpload = async (event) => {
    const file = event.target.files[0];
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
        body: formData
      });

      if (!response.ok) {
        throw new Error('Ошибка при загрузке баннера');
      }

      const data = await response.json();
      
      await connection.invoke("GetServerInfo", serverId)
        .then(serverInfo => {
          onServerUpdate(serverInfo);
          setBannerColor(serverInfo.bannerColor || '#3f3f3f');
        });
    } catch (error) {
      console.error('Ошибка при загрузке баннера:', error);
      alert('Не удалось загрузить баннер. Пожалуйста, попробуйте еще раз.');
    }
  };

  const handleBannerColorUpdate = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/server/${serverId}/banner`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          bannerColor: isDefaultColor ? null : bannerColor
        })
      });

      if (!response.ok) {
        throw new Error('Ошибка при обновлении цвета баннера');
      }

      await connection.invoke("GetServerInfo", serverId)
        .then(serverInfo => {
          onServerUpdate(serverInfo);
          setBannerColor(serverInfo.bannerColor || '#3f3f3f');
          setIsDefaultColor(!serverInfo.bannerColor);
        });
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
    const file = event.target.files[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${BASE_URL}/api/server/${serverId}/avatar`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        onServerUpdate({
          ...server,
          avatar: data.avatar
        });
      } else {
        throw new Error('Ошибка при обновлении аватара');
      }
    } catch (error) {
      console.error('Ошибка при загрузке аватара:', error);
      alert(error.message);
    }
  };

  const handleAvatarRemove = async () => {
    if (!window.confirm('Вы уверены, что хотите удалить аватар сервера?')) {
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/api/server/${serverId}/avatar`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        onServerUpdate({
          ...server,
          avatar: null
        });
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
    return (
      <div className="server-settings">
        <div className="no-permission">
          У вас нет прав для управления настройками сервера
        </div>
      </div>
    );
  }

  return (
    <div className="server-settings">
      <div className="settings-content">
        <h1>Профиль сервера</h1>

        <div className="form-section">
          <h3>Имя</h3>
          <div className="server-name-section">
            <input
              type="text"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              className="server-name-input"
              placeholder="Введите название сервера"
            />
            <button 
              className="save-name-button"
              onClick={handleServerNameUpdate}
              disabled={isSaving}
            >
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>

        <div className="form-section">
          <h3>Значок</h3>
          <div className="server-icon-preview">
            <label 
              className="icon-preview-area"
              style={{
                backgroundColor: '#5865f2',
                backgroundImage: server?.avatar ? `url(${BASE_URL}${server.avatar})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                style={{ display: 'none' }}
              />
              {!server?.avatar && (serverName || 'Сервер').charAt(0).toUpperCase()}
            </label>
            <button 
              className="change-icon-button"
              onClick={() => document.querySelector('input[type="file"]').click()}
            >
              Изменить значок сервера
            </button>
            {server?.avatar && (
              <button 
                className="remove-icon-button"
                onClick={handleAvatarRemove}
              >
                <FaTrash />
              </button>
            )}
          </div>
        </div>

         <div className="form-section">
           <h3>Баннер</h3>
           <div className="banner-preview">
             <label 
               className="banner-preview-area"
               style={{
                 backgroundColor: bannerColor || '#3f3f3f',
                 backgroundImage: server?.banner ? `url(${BASE_URL}${server.banner})` : 'none',
                 backgroundSize: 'cover',
                 backgroundPosition: 'center'
               }}
             >
               <input
                 type="file"
                 accept="image/*"
                 onChange={handleBannerFileUpload}
                 style={{ display: 'none' }}
               />
               {!server?.banner && (
                 <div className="banner-placeholder">
                   <FaUpload className="upload-icon" />
                   <span>Загрузить баннер</span>
                 </div>
               )}
               <div className="banner-overlay">
                 <FaUpload className="overlay-icon" />
                 <span>Изменить баннер</span>
               </div>
             </label>
             {server?.banner && (
               <button 
                 className="remove-banner-button"
                 onClick={handleBannerRemove}
               >
                 <FaTrash /> Удалить баннер
               </button>
             )}
           </div>
           
           <div className="banner-color-picker">
             <h4>Цвет фона</h4>
             <div className="color-palette">
                <div 
                  className={`color-option ${bannerColor === '#000000' ? 'selected' : ''}`}
                  style={{ 
                    background: '#000000',
                    border: '1px solid #333333'
                  }}
                  onClick={() => {
                    setBannerColor('#000000');
                    setIsDefaultColor(false);
                  }}
                  title="Черный"
                ></div>
               <div 
                 className={`color-option ${bannerColor === '#ff73b3' ? 'selected' : ''}`}
                 style={{ background: '#ff73b3' }}
                 onClick={() => {
                   setBannerColor('#ff73b3');
                   setIsDefaultColor(false);
                 }}
                 title="Розовый"
               ></div>
                <div 
                  className={`color-option ${bannerColor === '#ff6b35' ? 'selected' : ''}`}
                  style={{ 
                    background: '#ff6b35',
                    border: '1px solid #e55a2b'
                  }}
                  onClick={() => {
                    setBannerColor('#ff6b35');
                    setIsDefaultColor(false);
                  }}
                  title="Оранжевый"
                ></div>
               <div 
                 className={`color-option ${bannerColor === '#ffa500' ? 'selected' : ''}`}
                 style={{ background: '#ffa500' }}
                 onClick={() => {
                   setBannerColor('#ffa500');
                   setIsDefaultColor(false);
                 }}
                 title="Оранжевый"
               ></div>
               <div 
                 className={`color-option ${bannerColor === '#ffff00' ? 'selected' : ''}`}
                 style={{ background: '#ffff00' }}
                 onClick={() => {
                   setBannerColor('#ffff00');
                   setIsDefaultColor(false);
                 }}
                 title="Желтый"
               ></div>
               <div 
                 className={`color-option ${bannerColor === '#9c27b0' ? 'selected' : ''}`}
                 style={{ background: '#9c27b0' }}
                 onClick={() => {
                   setBannerColor('#9c27b0');
                   setIsDefaultColor(false);
                 }}
                 title="Фиолетовый"
               ></div>
               <div 
                 className={`color-option ${bannerColor === '#4caf50' ? 'selected' : ''}`}
                 style={{ background: '#4caf50' }}
                 onClick={() => {
                   setBannerColor('#4caf50');
                   setIsDefaultColor(false);
                 }}
                 title="Зеленый"
               ></div>
               <div 
                 className={`color-option ${bannerColor === '#2196f3' ? 'selected' : ''}`}
                 style={{ background: '#2196f3' }}
                 onClick={() => {
                   setBannerColor('#2196f3');
                   setIsDefaultColor(false);
                 }}
                 title="Синий"
               ></div>
               <div 
                 className={`color-option ${bannerColor === '#f44336' ? 'selected' : ''}`}
                 style={{ background: '#f44336' }}
                 onClick={() => {
                   setBannerColor('#f44336');
                   setIsDefaultColor(false);
                 }}
                 title="Красный"
               ></div>
              </div>
              <div className="color-picker-row">
                <input
                  type="color"
                  value={bannerColor || '#3f3f3f'}
                  onChange={(e) => {
                    setBannerColor(e.target.value);
                    setIsDefaultColor(false);
                  }}
                  className="custom-color-picker"
                />
                <button 
                  className="reset-color-button"
                  onClick={handleResetToDefault}
                  title="Вернуть дефолтный цвет"
                >
                  Дефолт
                </button>
              </div>
           </div>
           
           <div className="banner-actions">
             <button 
               className="save-banner-button"
               onClick={handleBannerColorUpdate}
             >
               Сохранить изменения
             </button>
             {isDefaultColor && (
               <span className="default-color-indicator">
                 Используется дефолтный цвет
               </span>
             )}
           </div>
         </div>
      </div>
    </div>
  );
};

export default ServerSettings;
