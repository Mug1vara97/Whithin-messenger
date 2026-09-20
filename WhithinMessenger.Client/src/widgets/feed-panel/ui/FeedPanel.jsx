import React, { useCallback, useEffect, useState } from 'react';
import DynamicFeedOutlinedIcon from '@mui/icons-material/DynamicFeedOutlined';
import AddIcon from '@mui/icons-material/Add';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import IosShareIcon from '@mui/icons-material/IosShare';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import SendIcon from '@mui/icons-material/Send';
import { feedApi, formatFeedTime } from '../../../entities/feed';
import { buildMediaUrl, downloadMediaFile } from '../../../shared/lib/utils/urlHelpers';
import { useProfileModal } from '../../../shared/lib/contexts/ProfileModalContext';
import { useAuthContext } from '../../../shared/lib/contexts/AuthContext';
import { UserAvatar } from '../../../shared/ui';
import CreateFeedPostModal from './CreateFeedPostModal';
import './FeedPanel.css';

const formatFileSize = (bytes) => {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
};

const formatScore = (likes, dislikes) => {
  const score = Number(likes || 0) - Number(dislikes || 0);
  const abs = Math.abs(score);
  if (abs >= 1000) {
    const compact = (abs / 1000).toFixed(abs >= 10000 ? 0 : 1).replace(/\.0$/, '');
    return `${score < 0 ? '-' : ''}${compact} тыс.`;
  }
  return String(score);
};

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return formatFeedTime(timestamp);

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин. назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} дн. назад`;
  return formatFeedTime(timestamp);
};

const FeedPanel = () => {
  const { openProfile } = useProfileModal();
  const { user } = useAuthContext();
  const currentUserId = String(user?.id || user?.userId || user?.Id || '');

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [expandedComments, setExpandedComments] = useState({});
  const [commentsByPost, setCommentsByPost] = useState({});
  const [commentsLoading, setCommentsLoading] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentSubmitting, setCommentSubmitting] = useState({});
  const [reactionBusy, setReactionBusy] = useState({});
  const [shareToast, setShareToast] = useState('');

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

  useEffect(() => {
    if (!shareToast) return undefined;
    const timer = setTimeout(() => setShareToast(''), 1800);
    return () => clearTimeout(timer);
  }, [shareToast]);

  const patchPost = useCallback((postId, updater) => {
    setPosts((prev) =>
      prev.map((post) => {
        if (String(post.id) !== String(postId)) return post;
        return typeof updater === 'function' ? updater(post) : { ...post, ...updater };
      }),
    );
  }, []);

  const handleReaction = async (post, value) => {
    if (!post?.id || reactionBusy[post.id]) return;
    const nextValue = post.myReaction === value ? null : value;
    setReactionBusy((prev) => ({ ...prev, [post.id]: true }));
    try {
      const updated = await feedApi.setReaction(post.id, nextValue);
      patchPost(post.id, updated);
    } catch (err) {
      console.error('FeedPanel: failed to set reaction', err);
    } finally {
      setReactionBusy((prev) => ({ ...prev, [post.id]: false }));
    }
  };

  const handleShare = async (post) => {
    const author =
      post.scope === 'server' ? post.serverName || post.authorName : post.authorName;
    const text = (post.text || '').trim();
    const shareText = text
      ? `${author}: ${text}`
      : `Пост от ${author} в Whithin`;
    const shareUrl = `${window.location.origin}${window.location.pathname}#feed/${post.id}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: author, text: shareText, url: shareUrl });
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }

    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setShareToast('Ссылка скопирована');
    } catch (err) {
      console.error('FeedPanel: failed to share', err);
      setShareToast('Не удалось поделиться');
    }
  };

  const loadComments = async (postId) => {
    if (!postId) return;
    setCommentsLoading((prev) => ({ ...prev, [postId]: true }));
    try {
      const comments = await feedApi.getComments(postId);
      setCommentsByPost((prev) => ({ ...prev, [postId]: comments }));
    } catch (err) {
      console.error('FeedPanel: failed to load comments', err);
      setCommentsByPost((prev) => ({ ...prev, [postId]: [] }));
    } finally {
      setCommentsLoading((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const toggleComments = (postId) => {
    setExpandedComments((prev) => {
      const nextOpen = !prev[postId];
      if (nextOpen && !commentsByPost[postId]) {
        void loadComments(postId);
      }
      return { ...prev, [postId]: nextOpen };
    });
  };

  const handleSubmitComment = async (postId) => {
    const text = (commentDrafts[postId] || '').trim();
    if (!text || commentSubmitting[postId]) return;

    setCommentSubmitting((prev) => ({ ...prev, [postId]: true }));
    try {
      const comment = await feedApi.addComment(postId, text);
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), comment],
      }));
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
      patchPost(postId, (post) => ({
        ...post,
        commentsCount: Number(post.commentsCount || 0) + 1,
      }));
      setExpandedComments((prev) => ({ ...prev, [postId]: true }));
    } catch (err) {
      console.error('FeedPanel: failed to add comment', err);
    } finally {
      setCommentSubmitting((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const handleDeleteComment = async (postId, commentId) => {
    if (!commentId) return;
    try {
      await feedApi.deleteComment(commentId);
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((c) => String(c.id) !== String(commentId)),
      }));
      patchPost(postId, (post) => ({
        ...post,
        commentsCount: Math.max(0, Number(post.commentsCount || 0) - 1),
      }));
    } catch (err) {
      console.error('FeedPanel: failed to delete comment', err);
    }
  };

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

  const renderComments = (post) => {
    if (!expandedComments[post.id]) return null;
    const comments = commentsByPost[post.id] || [];
    const isLoading = commentsLoading[post.id];
    const draft = commentDrafts[post.id] || '';
    const submitting = commentSubmitting[post.id];

    return (
      <div className="feed-panel__comments">
        {isLoading ? (
          <div className="feed-panel__comments-empty">Загрузка комментариев…</div>
        ) : comments.length === 0 ? (
          <div className="feed-panel__comments-empty">Пока нет комментариев</div>
        ) : (
          <div className="feed-panel__comments-list">
            {comments.map((comment) => {
              const canDelete = currentUserId && String(comment.authorId) === currentUserId;
              return (
                <div key={comment.id} className="feed-panel__comment">
                  <button
                    type="button"
                    className="feed-panel__comment-author"
                    onClick={() => openProfile(comment.authorId, comment.authorName)}
                  >
                    <UserAvatar
                      username={comment.authorName}
                      avatarUrl={comment.authorAvatar}
                      avatarColor={comment.authorAvatarColor}
                      size={28}
                    />
                  </button>
                  <div className="feed-panel__comment-body">
                    <div className="feed-panel__comment-head">
                      <button
                        type="button"
                        className="feed-panel__comment-name"
                        onClick={() => openProfile(comment.authorId, comment.authorName)}
                      >
                        {comment.authorName}
                      </button>
                      <span className="feed-panel__comment-time">
                        {formatRelativeTime(comment.createdAt)}
                      </span>
                      {canDelete ? (
                        <button
                          type="button"
                          className="feed-panel__comment-delete"
                          title="Удалить"
                          onClick={() => void handleDeleteComment(post.id, comment.id)}
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                        </button>
                      ) : null}
                    </div>
                    <p className="feed-panel__comment-text">{comment.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <form
          className="feed-panel__comment-form"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmitComment(post.id);
          }}
        >
          <input
            type="text"
            className="feed-panel__comment-input"
            placeholder="Написать комментарий…"
            value={draft}
            maxLength={2000}
            onChange={(e) =>
              setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
            }
          />
          <button
            type="submit"
            className="feed-panel__comment-send"
            disabled={!draft.trim() || submitting}
            title="Отправить"
          >
            <SendIcon sx={{ fontSize: 18 }} />
          </button>
        </form>
      </div>
    );
  };

  const renderPost = (post) => {
    const liked = post.myReaction === 'like';
    const disliked = post.myReaction === 'dislike';
    const busy = reactionBusy[post.id];
    const displayName =
      post.scope === 'server' ? post.serverName || post.authorName : post.authorName;
    const score = formatScore(post.likesCount, post.dislikesCount);

    return (
      <article key={post.id} className="feed-panel__card">
        <div className="feed-panel__card-top">
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
              avatarUrl={
                post.scope === 'server' ? post.serverAvatar || post.authorAvatar : post.authorAvatar
              }
              avatarColor={post.authorAvatarColor}
              size={32}
            />
            <div className="feed-panel__author-line">
              <span className="feed-panel__author-name">{displayName}</span>
              <span className="feed-panel__meta-dot">•</span>
              <span className="feed-panel__author-time">{formatRelativeTime(post.createdAt)}</span>
              {post.scope === 'server' ? (
                <>
                  <span className="feed-panel__meta-dot">•</span>
                  <span className="feed-panel__author-time">сервер</span>
                  {post.authorName ? (
                    <>
                      <span className="feed-panel__meta-dot">•</span>
                      <span className="feed-panel__author-time">{post.authorName}</span>
                    </>
                  ) : null}
                </>
              ) : null}
            </div>
          </button>
          <button type="button" className="feed-panel__more" title="Ещё" aria-label="Ещё">
            <MoreHorizIcon sx={{ fontSize: 22 }} />
          </button>
        </div>

        {post.text ? <p className="feed-panel__text">{post.text}</p> : null}
        {renderAttachments(post)}

        <div className="feed-panel__actions">
          <div
            className={`feed-panel__vote ${liked ? 'is-liked' : ''} ${disliked ? 'is-disliked' : ''}`}
          >
            <button
              type="button"
              className="feed-panel__vote-btn"
              disabled={busy}
              onClick={() => void handleReaction(post, 'like')}
              title="Нравится"
              aria-label="Нравится"
            >
              <KeyboardArrowUpIcon sx={{ fontSize: 26 }} />
            </button>
            <span className="feed-panel__vote-score">{score}</span>
            <button
              type="button"
              className="feed-panel__vote-btn"
              disabled={busy}
              onClick={() => void handleReaction(post, 'dislike')}
              title="Не нравится"
              aria-label="Не нравится"
            >
              <KeyboardArrowDownIcon sx={{ fontSize: 26 }} />
            </button>
          </div>

          <button
            type="button"
            className={`feed-panel__pill ${expandedComments[post.id] ? 'is-active' : ''}`}
            onClick={() => toggleComments(post.id)}
            title="Комментарии"
          >
            <ChatBubbleOutlineIcon sx={{ fontSize: 18 }} />
            <span>{post.commentsCount || 0}</span>
          </button>

          <button
            type="button"
            className="feed-panel__pill feed-panel__pill--share"
            onClick={() => void handleShare(post)}
            title="Поделиться"
          >
            <IosShareIcon sx={{ fontSize: 18 }} />
            <span>Поделиться</span>
          </button>
        </div>

        {renderComments(post)}
      </article>
    );
  };

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

      {shareToast ? <div className="feed-panel__toast">{shareToast}</div> : null}

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
