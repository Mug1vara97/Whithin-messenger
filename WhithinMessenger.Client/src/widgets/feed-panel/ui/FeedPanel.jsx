import React, { useCallback, useEffect, useState } from 'react';
import DynamicFeedOutlinedIcon from '@mui/icons-material/DynamicFeedOutlined';
import AddIcon from '@mui/icons-material/Add';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { feedApi, formatFeedTime } from '../../../entities/feed';
import { buildMediaUrl, downloadMediaFile } from '../../../shared/lib/utils/urlHelpers';
import { useProfileModal } from '../../../shared/lib/contexts/ProfileModalContext';
import { UserAvatar } from '../../../shared/ui';
import CreateFeedPostModal from './CreateFeedPostModal';
import './FeedPanel.css';

const formatFileSize = (bytes) => {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
};

const FeedPanel = () => {
  const { openProfile } = useProfileModal();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await feedApi.getFeed();
      setPosts(data);
    } catch (err) {
      console.error('FeedPanel: failed to load feed', err);
      setPosts([]);
      setError(err?.response?.data?.error || 'Не удалось загрузить ленту');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const renderAttachments = (post) => {
    const attachments = post.attachments || [];
    if (!attachments.length) return null;

    const images = attachments.filter((item) => item.contentType?.startsWith('image/'));
    const videos = attachments.filter((item) => item.contentType?.startsWith('video/'));
    const files = attachments.filter(
      (item) => !item.contentType?.startsWith('image/') && !item.contentType?.startsWith('video/'),
    );

    return (
      <div className="feed-panel__attachments">
        {images.length > 0 && (
          <div className={`feed-panel__media-grid feed-panel__media-grid--${Math.min(images.length, 4)}`}>
            {images.map((item) => (
              <a
                key={item.id}
                href={buildMediaUrl(item.filePath)}
                target="_blank"
                rel="noreferrer"
                className="feed-panel__media-item"
              >
                <img src={buildMediaUrl(item.filePath)} alt={item.originalFileName} />
              </a>
            ))}
          </div>
        )}

        {videos.map((item) => (
          <video
            key={item.id}
            className="feed-panel__video"
            src={buildMediaUrl(item.filePath)}
            controls
            preload="metadata"
          />
        ))}

        {files.map((item) => (
          <button
            key={item.id}
            type="button"
            className="feed-panel__file"
            onClick={() => downloadMediaFile(item.filePath, item.originalFileName)}
          >
            <InsertDriveFileOutlinedIcon sx={{ fontSize: 20 }} />
            <span className="feed-panel__file-meta">
              <span className="feed-panel__file-name">{item.originalFileName}</span>
              <span className="feed-panel__file-size">{formatFileSize(item.fileSize)}</span>
            </span>
          </button>
        ))}
      </div>
    );
  };

  const renderPost = (post) => (
    <article key={post.id} className="feed-panel__card">
      <button
        type="button"
        className="feed-panel__author"
        onClick={() => {
          if (post.scope === 'server') return;
          openProfile(post.authorId, post.authorName);
        }}
      >
        <UserAvatar
          username={post.authorName}
          avatarUrl={post.scope === 'server' ? post.serverAvatar || post.authorAvatar : post.authorAvatar}
          avatarColor={post.authorAvatarColor}
          size={40}
        />
        <div className="feed-panel__author-meta">
          <span className="feed-panel__author-name">
            {post.scope === 'server' ? post.serverName || post.authorName : post.authorName}
          </span>
          <span className="feed-panel__author-time">
            {formatFeedTime(post.createdAt)}
            {post.scope === 'server' ? ' · сервер' : ''}
            {post.scope === 'server' && post.authorName ? ` · ${post.authorName}` : ''}
          </span>
        </div>
      </button>
      {post.text ? <p className="feed-panel__text">{post.text}</p> : null}
      {renderAttachments(post)}
    </article>
  );

  return (
    <div className="feed-panel">
      <div className="feed-panel__header">
        <div className="feed-panel__title">
          <DynamicFeedOutlinedIcon sx={{ fontSize: 20 }} />
          <h2>Лента</h2>
        </div>
        <button
          type="button"
          className="feed-panel__add"
          title="Создать пост"
          onClick={() => setComposerOpen(true)}
        >
          <AddIcon sx={{ fontSize: 22 }} />
        </button>
      </div>

      <div className="feed-panel__scroll">
        {error ? <div className="feed-panel__empty">{error}</div> : null}

        {loading ? (
          <div className="feed-panel__empty">Загрузка…</div>
        ) : posts.length === 0 ? (
          <div className="feed-panel__empty">
            Пока нет постов. Нажмите «+», чтобы создать первый — его увидят друзья.
          </div>
        ) : (
          <div className="feed-panel__list">{posts.map(renderPost)}</div>
        )}
      </div>

      <CreateFeedPostModal
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreated={() => {
          void loadPosts();
        }}
      />
    </div>
  );
};

export default FeedPanel;
