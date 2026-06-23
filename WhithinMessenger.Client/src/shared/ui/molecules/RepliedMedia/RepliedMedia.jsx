import React, { useRef, useCallback } from 'react';
import { buildMediaUrl, openExternalUrl } from '../../../lib/utils/urlHelpers';
import MessageMarkdown from '../MessageMarkdown/MessageMarkdown';
import AudioMessage from '../AudioMessage/AudioMessage';
import './RepliedMedia.css';

/** Видеокружок в превью ответа: по клику — с начала, со звуком (без автозапуска). */
const RepliedVideoNote = ({ src }) => {
  const ref = useRef(null);
  const onPlay = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const v = ref.current;
    if (!v) return;
    v.muted = false;
    v.currentTime = 0;
    v.play().catch(() => {});
  }, []);
  return (
    <span
      className="replied-video-note-wrap"
      onClick={onPlay}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPlay(e);
        }
      }}
      role="button"
      tabIndex={0}
      title="Нажмите — воспроизвести с начала со звуком"
    >
      <video
        ref={ref}
        src={src}
        playsInline
        loop
        preload="metadata"
        className="replied-video replied-video--note"
      />
    </span>
  );
};

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
      const isNote = !!mediaFile.isVideoNote;
      const url = buildMediaUrl(mediaFile.filePath);
      if (isNote) {
        return <RepliedVideoNote src={url} />;
      }
      return (
        <video 
          src={url}
          controls 
          playsInline
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

  return (
    <MessageMarkdown
      content={content}
      className="replied-text"
      linkClassName="replied-link"
      compact
    />
  );
};

export default RepliedMedia;
