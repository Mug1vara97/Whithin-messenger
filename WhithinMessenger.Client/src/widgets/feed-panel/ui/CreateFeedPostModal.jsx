import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { feedApi } from '../../../entities/feed';
import './CreateFeedPostModal.css';

const MAX_FILES = 10;
const MAX_FILE_BYTES = 50 * 1024 * 1024;

const CreateFeedPostModal = ({
  isOpen,
  onClose,
  onCreated,
  scope = 'friend',
  serverId = null,
  title = 'Новый пост',
  placeholder = 'Что нового? Пост увидят только друзья.',
}) => {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setText('');
      setFiles([]);
      setError('');
      setPublishing(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const previews = useMemo(
    () =>
      files.map((file, index) => ({
        key: `${file.name}-${file.size}-${index}`,
        file,
        url: file.type?.startsWith('image/') ? URL.createObjectURL(file) : null,
        isImage: Boolean(file.type?.startsWith('image/')),
        isVideo: Boolean(file.type?.startsWith('video/')),
      })),
    [files],
  );

  useEffect(() => {
    return () => {
      previews.forEach((item) => {
        if (item.url) URL.revokeObjectURL(item.url);
      });
    };
  }, [previews]);

  const addFiles = useCallback((list) => {
    const incoming = Array.from(list || []);
    if (!incoming.length) return;

    setError('');
    setFiles((prev) => {
      const next = [...prev];
      for (const file of incoming) {
        if (next.length >= MAX_FILES) {
          setError(`Можно прикрепить не больше ${MAX_FILES} файлов`);
          break;
        }
        if (file.size > MAX_FILE_BYTES) {
          setError(`«${file.name}» слишком большой (макс. 50 МБ)`);
          continue;
        }
        next.push(file);
      }
      return next;
    });
  }, []);

  const removeFile = useCallback((index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handlePublish = useCallback(async () => {
    if (publishing) return;
    if (!text.trim() && files.length === 0) {
      setError('Добавьте текст или вложение');
      return;
    }

    setPublishing(true);
    setError('');
    try {
      const created = await feedApi.createPost({
        text,
        scope: scope === 'server' ? 'server' : 'friend',
        serverId: scope === 'server' ? serverId : null,
        files,
      });
      onCreated?.(created);
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Не удалось опубликовать пост');
    } finally {
      setPublishing(false);
    }
  }, [publishing, text, files, onCreated, onClose, scope, serverId]);

  if (!isOpen) return null;

  return (
    <div className="create-feed-post-modal" role="dialog" aria-modal="true" aria-label="Создать пост">
      <button
        type="button"
        className="create-feed-post-modal__backdrop"
        onClick={onClose}
        aria-label="Закрыть"
      />
      <div className="create-feed-post-modal__dialog">
        <div className="create-feed-post-modal__header">
          <h2>{title}</h2>
          <button type="button" className="create-feed-post-modal__close" onClick={onClose} aria-label="Закрыть">
            <CloseIcon fontSize="small" />
          </button>
        </div>

        <div className="create-feed-post-modal__body">
          <textarea
            className="create-feed-post-modal__textarea"
            value={text}
            maxLength={2000}
            rows={5}
            placeholder={placeholder}
            onChange={(event) => setText(event.target.value)}
            autoFocus
          />

          {previews.length > 0 && (
            <div className="create-feed-post-modal__attachments">
              {previews.map((item, index) => (
                <div key={item.key} className="create-feed-post-modal__attachment">
                  {item.isImage && item.url ? (
                    <img src={item.url} alt="" className="create-feed-post-modal__thumb" />
                  ) : (
                    <div className="create-feed-post-modal__file-chip">
                      {item.isVideo ? <VideocamOutlinedIcon sx={{ fontSize: 18 }} /> : <InsertDriveFileOutlinedIcon sx={{ fontSize: 18 }} />}
                      <span title={item.file.name}>{item.file.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="create-feed-post-modal__remove"
                    onClick={() => removeFile(index)}
                    aria-label="Убрать файл"
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error ? <p className="create-feed-post-modal__error">{error}</p> : null}
        </div>

        <div className="create-feed-post-modal__footer">
          <div className="create-feed-post-modal__attach-actions">
            <button
              type="button"
              className="create-feed-post-modal__attach-btn"
              title="Фото"
              onClick={() => photoInputRef.current?.click()}
            >
              <ImageOutlinedIcon sx={{ fontSize: 20 }} />
            </button>
            <button
              type="button"
              className="create-feed-post-modal__attach-btn"
              title="Видео"
              onClick={() => videoInputRef.current?.click()}
            >
              <VideocamOutlinedIcon sx={{ fontSize: 20 }} />
            </button>
            <button
              type="button"
              className="create-feed-post-modal__attach-btn"
              title="Файл"
              onClick={() => fileInputRef.current?.click()}
            >
              <AttachFileIcon sx={{ fontSize: 20 }} />
            </button>
            <span className="create-feed-post-modal__hint">Только между друзьями</span>
          </div>

          <button
            type="button"
            className="create-feed-post-modal__publish"
            disabled={publishing || (!text.trim() && files.length === 0)}
            onClick={handlePublish}
          >
            {publishing ? 'Публикация…' : 'Опубликовать'}
          </button>
        </div>

        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          multiple
          hidden
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>
    </div>
  );
};

export default CreateFeedPostModal;
