import React, { useState, useRef, useCallback } from 'react';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import './MediaUpload.css';

const MediaUpload = ({ chatId, onUploadSuccess, onUploadError }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = useCallback(async (files) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Проверяем размер файла (максимум 50MB)
    if (file.size > 50 * 1024 * 1024) {
      onUploadError?.('Файл слишком большой. Максимальный размер: 50MB');
      return;
    }

    // Проверяем тип файла
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/avi', 'video/mov', 'video/wmv',
      'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'
    ];

    if (!allowedTypes.includes(file.type)) {
      onUploadError?.('Неподдерживаемый тип файла');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('chatId', chatId);
      formData.append('file', file);
      formData.append('caption', ''); // Можно добавить поле для подписи

      const response = await fetch(`${BASE_URL}/api/media/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка загрузки файла');
      }

      const result = await response.json();
      onUploadSuccess?.(result);
      
    } catch (error) {
      console.error('Upload error:', error);
      onUploadError?.(error.message || 'Ошибка при загрузке файла');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [chatId, onUploadSuccess, onUploadError]);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [handleFileSelect]);

  const handleFileInputChange = useCallback((e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files);
    }
  }, [handleFileSelect]);

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const getFileTypeIcon = (file) => {
    if (file.type.startsWith('image/')) return '🖼️';
    if (file.type.startsWith('video/')) return '🎥';
    if (file.type.startsWith('audio/')) return '🎵';
    return '📄';
  };

  return (
    <div className="media-upload">
      <div
        className={`media-upload-area ${dragActive ? 'drag-active' : ''} ${isUploading ? 'uploading' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />
        
        {isUploading ? (
          <div className="upload-progress">
            <div className="upload-progress-icon">⏳</div>
            <div className="upload-progress-text">Загрузка файла...</div>
            <div className="upload-progress-bar">
              <div 
                className="upload-progress-fill" 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="upload-content">
            <div className="upload-icon">📎</div>
            <div className="upload-text">
              <div className="upload-title">Загрузить медиафайл</div>
              <div className="upload-subtitle">
                Перетащите файл сюда или нажмите для выбора
              </div>
              <div className="upload-formats">
                Поддерживаемые форматы: JPG, PNG, GIF, MP4, AVI, MP3, WAV
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaUpload;
