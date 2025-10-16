import React, { useState, useEffect } from 'react';
import { 
  MdClose, 
  MdDownload, 
  MdZoomIn, 
  MdZoomOut, 
  MdRotateRight,
  MdImage,
  MdRefresh
} from 'react-icons/md';
import './ImagePreview.css';

const ImagePreview = ({ mediaFile, isOpen, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setError(null);
      setImagePosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  const handleDownload = () => {
    if (mediaFile) {
      const link = document.createElement('a');
      link.href = `${import.meta.env.VITE_API_URL || 'http://localhost:5109'}/${mediaFile.filePath}`;
      link.download = mediaFile.originalFileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => {
      const newZoom = Math.min(prev + 0.25, 3);
      // Сбрасываем позицию при изменении зума
      if (newZoom <= 1) {
        setImagePosition({ x: 0, y: 0 });
      }
      return newZoom;
    });
  };

  const handleZoomOut = () => {
    setZoom(prev => {
      const newZoom = Math.max(prev - 0.25, 0.5);
      // Сбрасываем позицию при изменении зума
      if (newZoom <= 1) {
        setImagePosition({ x: 0, y: 0 });
      }
      return newZoom;
    });
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const resetView = () => {
    setZoom(1);
    setRotation(0);
    setImagePosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e) => {
    if (zoom > 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ 
        x: e.clientX - imagePosition.x, 
        y: e.clientY - imagePosition.y 
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && zoom > 1) {
      e.preventDefault();
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      
      // Вычисляем максимальные смещения на основе зума
      const maxOffset = (zoom - 1) * 150; // Увеличиваем диапазон перемещения
      
      setImagePosition({
        x: Math.max(-maxOffset, Math.min(maxOffset, newX)),
        y: Math.max(-maxOffset, Math.min(maxOffset, newY))
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setError('Ошибка загрузки изображения');
  };

  if (!isOpen || !mediaFile) return null;

  const imageUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:5109'}/${mediaFile.filePath}`;

  return (
    <div className="image-preview-overlay">
      <div className="image-preview-backdrop" onClick={onClose} />
      
      <div className="image-preview-container">
        <div className="image-preview-header">
          <div className="image-preview-title">
            <div className="image-preview-title-content">
              <div className="image-preview-icon-container">
                <MdImage className="image-preview-title-icon" />
              </div>
              <div>
                <h3 className="image-preview-filename">
                  {mediaFile.originalFileName}
                </h3>
                <p className="image-preview-info">
                  {mediaFile.contentType} • {formatFileSize(mediaFile.fileSize)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="image-preview-controls">
            <div className="image-preview-zoom-controls">
              <button
                onClick={handleZoomOut}
                className="image-preview-btn"
                title="Уменьшить"
                disabled={zoom <= 0.5}
              >
                <MdZoomOut className="image-preview-icon" />
              </button>
              
              <span className="image-preview-zoom-text">
                {Math.round(zoom * 100)}%
              </span>
              
              <button
                onClick={handleZoomIn}
                className="image-preview-btn"
                title="Увеличить"
                disabled={zoom >= 3}
              >
                <MdZoomIn className="image-preview-icon" />
              </button>
              
              <button
                onClick={handleRotate}
                className="image-preview-btn"
                title="Повернуть"
              >
                <MdRotateRight className="image-preview-icon" />
              </button>
              
              <button
                onClick={resetView}
                className="image-preview-btn"
                title="Сбросить вид"
              >
                <span className="image-preview-reset">1:1</span>
              </button>
            </div>
            
            <button
              onClick={handleDownload}
              className="image-preview-btn"
              title="Скачать"
            >
              <MdDownload className="image-preview-icon" />
            </button>
            
            <button
              onClick={onClose}
              className="image-preview-btn"
              title="Закрыть"
            >
              <MdClose className="image-preview-icon" />
            </button>
          </div>
        </div>

        <div className="image-preview-content">
          {isLoading && (
            <div className="image-preview-loading">
              <div className="image-preview-spinner" />
              <p>Загрузка изображения...</p>
            </div>
          )}
          
          {error && (
            <div className="image-preview-error">
              <p>Ошибка загрузки изображения</p>
              <button onClick={() => window.location.reload()} className="image-preview-retry">
                Попробовать снова
              </button>
            </div>
          )}
          
          {!error && (
            <div className="image-preview-image-container">
              <img
                src={imageUrl}
                alt={mediaFile.originalFileName}
                className="image-preview-image"
                style={{
                  transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: 'center'
                }}
                onLoad={handleImageLoad}
                onError={handleImageError}
                onLoadStart={() => setIsLoading(true)}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                draggable={false}
              />
            </div>
          )}
        </div>
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

export default ImagePreview;
