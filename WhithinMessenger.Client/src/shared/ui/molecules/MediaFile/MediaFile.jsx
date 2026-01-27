import React, { useState, useEffect } from 'react';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import ImagePreview from '../ImagePreview/ImagePreview';
import AudioMessage from '../AudioMessage/AudioMessage';
import VideoPlayer from './VideoPlayer';
import ImageIcon from '@mui/icons-material/Image';
import VideocamIcon from '@mui/icons-material/Videocam';
import DownloadIcon from '@mui/icons-material/Download';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import './MediaFile.css';

const MediaFile = ({ mediaFile }) => {
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    if (mediaFile?.contentType?.startsWith('video/')) {
      setVideoError(false);
      setVideoLoading(true);
    }
  }, [mediaFile?.filePath]);

  const renderMediaContent = () => {
    if (mediaFile.contentType.startsWith('image/')) {
      const imageUrl = `${BASE_URL}/${mediaFile.filePath}`;
      
      
      return (
        <div className="media-image-container">
          {imageLoading && (
            <div className="media-skeleton">
              <div className="skeleton-shimmer"></div>
              <div className="skeleton-icon"><ImageIcon sx={{ fontSize: 40 }} /></div>
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

      // Если ошибка воспроизведения — fallback с кнопкой скачивания
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
              <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'center' }}>
                <VideocamIcon sx={{ fontSize: 48, color: '#72767d' }} />
              </div>
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
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 20px',
                  backgroundColor: '#5865f2',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#4752c4'; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#5865f2'; }}
              >
                <DownloadIcon sx={{ fontSize: 18 }} />
                Скачать видео
              </a>
            </div>
          </div>
        );
      }

      return (
        <div className="media-video-container media-video-container--player">
          {videoLoading && (
            <div className="media-skeleton media-skeleton-video">
              <div className="skeleton-shimmer" />
              <div className="skeleton-icon"><VideocamIcon sx={{ fontSize: 40 }} /></div>
            </div>
          )}
          <VideoPlayer
            src={videoUrl}
            onLoad={() => setVideoLoading(false)}
            onError={() => {
              setVideoLoading(false);
              setVideoError(true);
            }}
            className={videoLoading ? 'media-loading' : ''}
          />
        </div>
      );
    }

    if (mediaFile.contentType.startsWith('audio/')) {
      return <AudioMessage mediaFile={mediaFile} />;
    }

    // Для документов, архивов и других файлов — карточка-ссылка в стиле Discord
    const fileUrl = `${BASE_URL}/${mediaFile.filePath}`;
    const isArchive = /\.(zip|rar|7z|tar|gz)$/i.test(mediaFile.originalFileName || '');
    const FileIcon = isArchive ? FolderZipIcon : InsertDriveFileIcon;
    return (
      <a
        href={fileUrl}
        download={mediaFile.originalFileName || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="media-file-card"
      >
        <div className="media-file-card__icon">
          <FileIcon sx={{ fontSize: 40 }} />
        </div>
        <div className="media-file-card__info">
          <span className="media-file-card__name">{mediaFile.originalFileName}</span>
          <span className="media-file-card__size">{formatFileSize(mediaFile.fileSize)}</span>
        </div>
      </a>
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
