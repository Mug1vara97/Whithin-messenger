import React, { useState, useRef, useEffect } from 'react';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import ImagePreview from '../ImagePreview/ImagePreview';
import AudioMessage from '../AudioMessage/AudioMessage';
import { chatMediaAudioManager } from '../../../lib/utils/chatMediaAudio';
import './MediaFile.css';

const MediaFile = ({ mediaFile }) => {
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(true);
  const videoRef = useRef(null);

  // Подключаем видео к Web Audio API для обхода suppressLocalAudioPlayback
  useEffect(() => {
    if (videoRef.current && mediaFile.contentType.startsWith('video/')) {
      const videoElement = videoRef.current;
      // Подключаем видео элемент к Web Audio API
      chatMediaAudioManager.connectMediaElement(videoElement);
      console.log('🎥 MediaFile: Video element connected to Web Audio API');

      return () => {
        // Отключаем при размонтировании
        chatMediaAudioManager.disconnectMediaElement(videoElement);
        console.log('🎥 MediaFile: Video element disconnected from Web Audio API');
      };
    }
  }, [mediaFile.contentType]);

  const renderMediaContent = () => {
    if (mediaFile.contentType.startsWith('image/')) {
      const imageUrl = `${BASE_URL}/${mediaFile.filePath}`;
      
      
      return (
        <div className="media-image-container">
          {imageLoading && (
            <div className="media-skeleton">
              <div className="skeleton-shimmer"></div>
              <div className="skeleton-icon">🖼️</div>
            </div>
          )}
          <img
            src={imageUrl}
            alt={mediaFile.originalFileName}
            className={`media-image ${imageLoading ? 'media-loading' : ''}`}
            onClick={() => !imageLoading && setShowPreview(true)}
            onLoad={() => {
              console.log('✅ MediaFile - изображение загружено:', imageUrl);
              setImageLoading(false);
            }}
            onError={(e) => {
              console.error('❌ MediaFile - ошибка загрузки изображения:', imageUrl, e);
              setImageLoading(false);
              setError('Ошибка загрузки изображения');
            }}
            loading="lazy"
          />
        </div>
      );
    }

    if (mediaFile.contentType.startsWith('video/')) {
      return (
        <div className="media-video-container">
          {videoLoading && (
            <div className="media-skeleton media-skeleton-video">
              <div className="skeleton-shimmer"></div>
              <div className="skeleton-icon">🎥</div>
            </div>
          )}
          <video
            ref={videoRef}
            src={`${BASE_URL}/${mediaFile.filePath}`}
            controls
            className={`media-video ${videoLoading ? 'media-loading' : ''}`}
            preload="metadata"
            onLoadedData={() => {
              console.log('✅ MediaFile - видео загружено');
              setVideoLoading(false);
            }}
            onError={(e) => {
              console.error('❌ MediaFile - ошибка загрузки видео:', e);
              setVideoLoading(false);
              setError('Ошибка загрузки видео');
            }}
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
