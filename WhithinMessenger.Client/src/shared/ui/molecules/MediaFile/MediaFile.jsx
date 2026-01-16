import React, { useState } from 'react';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import ImagePreview from '../ImagePreview/ImagePreview';
import AudioMessage from '../AudioMessage/AudioMessage';
import './MediaFile.css';

const MediaFile = ({ mediaFile }) => {
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(true);

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
      const videoUrl = `${BASE_URL}/${mediaFile.filePath}`;
      const [videoError, setVideoError] = useState(false);
      
      // Если ошибка воспроизведения - показываем fallback с кнопкой скачивания
      if (videoError) {
        return (
          <div className="media-video-container">
            <div className="media-video-error" style={{
              padding: '20px',
              textAlign: 'center',
              backgroundColor: '#2f3136',
              borderRadius: '8px',
              border: '1px solid #40444b'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>🎥</div>
              <p style={{ color: '#dcddde', marginBottom: '8px', fontSize: '14px' }}>
                Видео не может быть воспроизведено в браузере
              </p>
              <p style={{ color: '#72767d', marginBottom: '16px', fontSize: '12px' }}>
                Возможно, используется неподдерживаемый формат (HEVC/H.265)
              </p>
              <a
                href={videoUrl}
                download={mediaFile.originalFileName || 'video.mp4'}
                style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  backgroundColor: '#5865f2',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#4752c4'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#5865f2'}
              >
                📥 Скачать видео
              </a>
            </div>
          </div>
        );
      }
      
      return (
        <div className="media-video-container">
          {videoLoading && (
            <div className="media-skeleton media-skeleton-video">
              <div className="skeleton-shimmer"></div>
              <div className="skeleton-icon">🎥</div>
            </div>
          )}
          <video
            src={videoUrl}
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
              setVideoError(true);
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
