import React, { useState } from 'react';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import ImagePreview from '../ImagePreview/ImagePreview';
import AudioMessage from '../AudioMessage/AudioMessage';
import './MediaFile.css';

const MediaFile = ({ mediaFile, onDelete, canDelete = false }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);


  const handleDelete = async () => {
    if (!canDelete || !onDelete) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await onDelete(mediaFile.id);
    } catch (err) {
      setError('Ошибка при удалении файла');
      console.error('Error deleting media file:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    const downloadUrl = `${BASE_URL}/${mediaFile.filePath}`;
    window.open(downloadUrl, '_blank');
  };

  const renderMediaContent = () => {
    if (mediaFile.contentType.startsWith('image/')) {
      const imageUrl = `${BASE_URL}/${mediaFile.filePath}`;
      const thumbnailUrl = mediaFile.thumbnailPath ? `${BASE_URL}/${mediaFile.thumbnailPath}` : null;
      
      
      return (
        <div className="media-image-container">
          <img
            src={imageUrl}
            alt={mediaFile.originalFileName}
            className="media-image"
            onClick={() => setShowPreview(true)}
            onError={(e) => {
              console.error('❌ MediaFile - ошибка загрузки изображения:', imageUrl, e);
              setError('Ошибка загрузки изображения');
            }}
          />
        </div>
      );
    }

    if (mediaFile.contentType.startsWith('video/')) {
      return (
        <div className="media-video-container">
          <video
            src={`${BASE_URL}/${mediaFile.filePath}`}
            controls
            className="media-video"
            preload="metadata"
          >
            Ваш браузер не поддерживает видео.
          </video>
        </div>
      );
    }

    if (mediaFile.contentType.startsWith('audio/')) {
      return <AudioMessage mediaFile={mediaFile} />;
    }

    // Для других типов файлов
    return (
      <div className="media-file-container">
        <div className="media-file-icon">
          📄
        </div>
        <div className="media-file-info">
          <div className="media-file-name">{mediaFile.originalFileName}</div>
          <div className="media-file-size">{formatFileSize(mediaFile.fileSize)}</div>
        </div>
      </div>
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = () => {
    if (mediaFile.contentType.startsWith('image/')) return '🖼️';
    if (mediaFile.contentType.startsWith('video/')) return '🎥';
    if (mediaFile.contentType.startsWith('audio/')) return '🎵';
    return '📄';
  };

  return (
    <>
      <div className="media-file">
        {error && (
          <div className="media-error">
            {error}
          </div>
        )}
        
        <div className="media-content">
          {renderMediaContent()}
        </div>
      </div>
      
      {/* Компонент предварительного просмотра */}
      {mediaFile.contentType.startsWith('image/') && (
        <ImagePreview
          mediaFile={mediaFile}
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
};

export default MediaFile;
