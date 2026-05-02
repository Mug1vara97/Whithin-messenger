import React, { useState, useRef } from 'react';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import tokenManager from '../../../lib/services/tokenManager';
import './ChatAvatarUpload.css';

const getAuthHeaders = () => {
  const token = tokenManager.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const ChatAvatarUpload = ({ chatId, currentAvatar, currentAvatarColor, onAvatarUpdated, connection }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (file) => {
    if (!file) return;

    // Проверяем тип файла
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Неподдерживаемый тип файла. Разрешены: JPEG, PNG, GIF, WebP');
      return;
    }

    // Проверяем размер файла (максимум 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Размер файла не должен превышать 5MB');
      return;
    }

    // Создаем превью
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    handleFileSelect(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!fileInputRef.current?.files[0]) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', fileInputRef.current.files[0]);

      const response = await fetch(`${BASE_URL}/api/chat/${chatId}/avatar`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Chat avatar uploaded:', result.avatarUrl);
        
        // Уведомляем родительский компонент
        if (onAvatarUpdated) {
          onAvatarUpdated(result.avatarUrl);
        }
        
        // Сбрасываем превью
        setPreview(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        let message = 'Неизвестная ошибка';
        try {
          const error = await response.json();
          message = error.error || error.message || message;
        } catch {
          if (response.status === 401) message = 'Требуется авторизация (войдите снова)';
        }
        alert(`Ошибка загрузки: ${message}`);
      }
    } catch (error) {
      console.error('❌ Error uploading chat avatar:', error);
      alert('Ошибка при загрузке аватара');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="chat-avatar-upload">
      <div className="chat-avatar-upload-header">
        <h3>Аватар чата</h3>
        <p>Загрузите изображение для группового чата</p>
      </div>

      <div className="chat-avatar-upload-content">
        {/* Текущий аватар */}
        <div className="chat-avatar-current">
          <div 
            className="chat-avatar-preview"
            style={{
              backgroundColor: currentAvatar ? 'transparent' : (currentAvatarColor || '#5865F2'),
              backgroundImage: currentAvatar?.startsWith('/uploads/') 
                ? `url(${BASE_URL}${currentAvatar})` 
                : (currentAvatar?.startsWith('http') ? `url(${currentAvatar})` : 'none'),
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {!currentAvatar && 'G'}
          </div>
          <span className="chat-avatar-label">Текущий аватар</span>
        </div>

        {/* Область загрузки */}
        <div 
          className={`chat-avatar-dropzone ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />
          
          {preview ? (
            <div className="chat-avatar-preview-new">
              <img src={preview} alt="Preview" />
              <div className="chat-avatar-preview-overlay">
                <span>Новый аватар</span>
              </div>
            </div>
          ) : (
            <div className="chat-avatar-dropzone-content">
              <div className="chat-avatar-dropzone-icon">📷</div>
              <p>Перетащите изображение сюда или нажмите для выбора</p>
              <p className="chat-avatar-dropzone-hint">
                Поддерживаются: JPEG, PNG, GIF, WebP (до 5MB)
              </p>
            </div>
          )}
        </div>

        {/* Кнопки действий */}
        {preview && (
          <div className="chat-avatar-actions">
            <button 
              className="chat-avatar-btn chat-avatar-btn-cancel"
              onClick={handleCancel}
              disabled={isUploading}
            >
              Отмена
            </button>
            <button 
              className="chat-avatar-btn chat-avatar-btn-upload"
              onClick={handleUpload}
              disabled={isUploading}
            >
              {isUploading ? 'Загрузка...' : 'Загрузить'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatAvatarUpload;









