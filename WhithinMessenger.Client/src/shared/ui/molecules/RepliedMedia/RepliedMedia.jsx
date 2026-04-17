import React from 'react';
import { buildMediaUrl, openExternalUrl, splitTextWithLinks } from '../../../lib/utils/urlHelpers';
import AudioMessage from '../AudioMessage/AudioMessage';
import './RepliedMedia.css';

const RepliedMedia = ({ content, mediaFiles }) => {
  // Если есть медиафайлы, используем их
  if (mediaFiles && mediaFiles.length > 0) {
    const mediaFile = mediaFiles[0]; // Берем первый медиафайл
    
    if (mediaFile.contentType.startsWith('audio/')) {
      return <AudioMessage mediaFile={mediaFile} />;
    }
    
    if (mediaFile.contentType.startsWith('image/')) {
      return (
        <img 
          src={buildMediaUrl(mediaFile.filePath)}
          alt="Replied image" 
          className="replied-image"
        />
      );
    }
    
    if (mediaFile.contentType.startsWith('video/')) {
      return (
        <video 
          src={buildMediaUrl(mediaFile.filePath)}
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
      const src = buildMediaUrl(content);
      const extension = content.split('.').pop().toLowerCase();
      
      switch (extension) {
        case 'mp4':
        case 'mov':
          return <video src={src} controls className="replied-video" />;
        case 'webm':
          // WebM может быть как видео, так и аудио - определяем по MIME типу или другим признакам
          // Для простоты считаем webm видео, если нужна поддержка аудио webm, 
          // можно добавить дополнительную проверку
          return <video src={src} controls className="replied-video" />;
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'webp':
          return <img src={src} alt="Replied image" className="replied-image" />;
        case 'wav':
        case 'mp3':
        case 'ogg':
        case 'm4a':
          // Создаем объект mediaFile для AudioMessage
          const audioMediaFile = {
            id: 'replied-audio',
            filePath: content,
            contentType: `audio/${extension}`,
            fileName: content.split('/').pop()
          };
          return <AudioMessage mediaFile={audioMediaFile} />;
        default:
          return (
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="replied-link"
              onClick={(e) => {
                e.preventDefault();
                openExternalUrl(src);
              }}
            >
              Download file
            </a>
          );
      }
    }
  }

  // Если это обычный текст
  console.log('🎵 RepliedMedia - отображаем как текст:', content);
  const textParts = splitTextWithLinks(content);

  return (
    <span className="replied-text">
      {textParts.length > 0 ? textParts.map((part, index) => {
        if (part.type === 'link') {
          return (
            <a
              key={`reply-link-${index}`}
              href={part.href}
              className="replied-link"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openExternalUrl(part.href);
              }}
            >
              {part.value}
            </a>
          );
        }

        return <React.Fragment key={`reply-text-${index}`}>{part.value}</React.Fragment>;
      }) : content}
    </span>
  );
};

export default RepliedMedia;
