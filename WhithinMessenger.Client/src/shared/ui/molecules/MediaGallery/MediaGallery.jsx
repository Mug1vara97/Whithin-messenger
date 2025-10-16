import React, { useState, useEffect, useCallback } from 'react';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import MediaFile from '../MediaFile/MediaFile';
import './MediaGallery.css';

const MediaGallery = ({ chatId, onDeleteMedia, canDelete = false }) => {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, image, video, audio
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchMediaFiles = useCallback(async (pageNum = 1, mediaType = 'all') => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        pageSize: '20'
      });

      if (mediaType !== 'all') {
        params.append('mediaType', mediaType);
      }

      const response = await fetch(`${BASE_URL}/api/media/${chatId}?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки медиафайлов');
      }

      const data = await response.json();
      
      if (pageNum === 1) {
        setMediaFiles(data.mediaFiles);
      } else {
        setMediaFiles(prev => [...prev, ...data.mediaFiles]);
      }
      
      setHasMore(data.hasMore);
      setPage(pageNum);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching media files:', err);
    } finally {
      setIsLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    if (chatId) {
      fetchMediaFiles(1, filter);
    }
  }, [chatId, filter, fetchMediaFiles]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchMediaFiles(page + 1, filter);
    }
  }, [fetchMediaFiles, page, filter, isLoading, hasMore]);

  const handleDeleteMedia = useCallback(async (mediaFileId) => {
    try {
      const response = await fetch(`${BASE_URL}/api/media/${mediaFileId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Ошибка удаления файла');
      }

      setMediaFiles(prev => prev.filter(file => file.id !== mediaFileId));
      onDeleteMedia?.(mediaFileId);
    } catch (err) {
      setError(err.message);
      console.error('Error deleting media file:', err);
    }
  }, [onDeleteMedia]);

  const handleFilterChange = useCallback((newFilter) => {
    setFilter(newFilter);
    setPage(1);
    setHasMore(true);
  }, []);

  const getFilterCounts = () => {
    const counts = { all: 0, image: 0, video: 0, audio: 0 };
    
    mediaFiles.forEach(file => {
      counts.all++;
      if (file.contentType.startsWith('image/')) counts.image++;
      else if (file.contentType.startsWith('video/')) counts.video++;
      else if (file.contentType.startsWith('audio/')) counts.audio++;
    });
    
    return counts;
  };

  const counts = getFilterCounts();

  return (
    <div className="media-gallery">
      <div className="media-gallery-header">
        <h3>Медиафайлы</h3>
        <div className="media-filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => handleFilterChange('all')}
          >
            Все ({counts.all})
          </button>
          <button
            className={`filter-btn ${filter === 'image' ? 'active' : ''}`}
            onClick={() => handleFilterChange('image')}
          >
            🖼️ Изображения ({counts.image})
          </button>
          <button
            className={`filter-btn ${filter === 'video' ? 'active' : ''}`}
            onClick={() => handleFilterChange('video')}
          >
            🎥 Видео ({counts.video})
          </button>
          <button
            className={`filter-btn ${filter === 'audio' ? 'active' : ''}`}
            onClick={() => handleFilterChange('audio')}
          >
            🎵 Аудио ({counts.audio})
          </button>
        </div>
      </div>

      {error && (
        <div className="media-gallery-error">
          {error}
        </div>
      )}

      <div className="media-gallery-content">
        {isLoading && mediaFiles.length === 0 ? (
          <div className="media-gallery-loading">
            <div className="loading-spinner"></div>
            <p>Загрузка медиафайлов...</p>
          </div>
        ) : mediaFiles.length === 0 ? (
          <div className="media-gallery-empty">
            <div className="empty-icon">📁</div>
            <p>Медиафайлы не найдены</p>
          </div>
        ) : (
          <div className="media-files-grid">
            {mediaFiles.map((file) => (
              <MediaFile
                key={file.id}
                mediaFile={file}
                onDelete={handleDeleteMedia}
                canDelete={canDelete}
              />
            ))}
          </div>
        )}

        {hasMore && (
          <div className="media-gallery-load-more">
            <button
              onClick={handleLoadMore}
              disabled={isLoading}
              className="load-more-btn"
            >
              {isLoading ? 'Загрузка...' : 'Загрузить еще'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaGallery;
