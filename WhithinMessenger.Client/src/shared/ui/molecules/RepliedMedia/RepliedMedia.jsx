import React, { useRef, useEffect } from 'react';
import { BASE_URL } from '../../../lib/constants/apiEndpoints';
import AudioMessage from '../AudioMessage/AudioMessage';
import { chatMediaAudioManager } from '../../../lib/utils/chatMediaAudio';
import './RepliedMedia.css';

const RepliedMedia = ({ content, mediaFiles }) => {
  const videoRef = useRef(null);

  // Подключаем видео к Web Audio API
  useEffect(() => {
    if (videoRef.current) {
      const videoElement = videoRef.current;
      chatMediaAudioManager.connectMediaElement(videoElement);
      console.log('🎥 RepliedMedia: Video element connected to Web Audio API');

      return () => {
        chatMediaAudioManager.disconnectMediaElement(videoElement);
      };
    }
  }, []);
  // Если есть медиафайлы, используем их
  if (mediaFiles && mediaFiles.length > 0) {
    const mediaFile = mediaFiles[0]; // Берем первый медиафайл
    
    if (mediaFile.contentType.startsWith('audio/')) {
      return <AudioMessage mediaFile={mediaFile} />;
    }
    
    if (mediaFile.contentType.startsWith('image/')) {
      return (
        <img 
          src={`${BASE_URL}/${mediaFile.filePath}`} 
          alt="Replied image" 
          className="replied-image"
        />
      );
    }
    
    if (mediaFile.contentType.startsWith('video/')) {
      return (
        <video 
          ref={videoRef}
          src={`${BASE_URL}/${mediaFile.filePath}`} 
          controls 
          className="replied-video"
        />
      );
    }
  }

  // Если нет медиафайлов, но есть контент с путем к файлу
  if (content && typeof content === 'string') {
    console.log('🎵 RepliedMedia - проверяем content:', content);
    const isMediaPath = content.toLowerCase().includes('/uploads/') || 
                       content.toLowerCase().startsWith('uploads/');
    
    if (isMediaPath) {
      console.log('🎵 RepliedMedia - это медиафайл:', content);
      const src = `${BASE_URL}/${content}`;
      const extension = content.split('.').pop().toLowerCase();
      
      switch (extension) {
        case 'mp4':
        case 'mov':
          return <video ref={videoRef} src={src} controls className="replied-video" />;
        case 'webm':
          // WebM может быть как видео, так и аудио - определяем по MIME типу или другим признакам
          // Для простоты считаем webm видео, если нужна поддержка аудио webm, 
          // можно добавить дополнительную проверку
          return <video ref={videoRef} src={src} controls className="replied-video" />;
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'webp':
          return <img src={src} alt="Replied image" className="replied-image" />;
        case 'wav':
        case 'mp3':
        case 'ogg':
        case 'm4a': {
          // Создаем объект mediaFile для AudioMessage
          const audioMediaFile = {
            id: 'replied-audio',
            filePath: content,
            contentType: `audio/${extension}`,
            fileName: content.split('/').pop()
          };
          return <AudioMessage mediaFile={audioMediaFile} />;
        }
        default:
          return <a href={src} target="_blank" rel="noopener noreferrer">Download file</a>;
      }
    }
  }

  // Если это обычный текст
  console.log('🎵 RepliedMedia - отображаем как текст:', content);
  return <span className="replied-text">{content}</span>;
};

export default RepliedMedia;
