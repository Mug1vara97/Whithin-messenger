import React, { useCallback, useEffect, useState } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import IosShareIcon from '@mui/icons-material/IosShare';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { feedApi } from '../../../entities/feed';
import { useProfileModal } from '../../../shared/lib/contexts/ProfileModalContext';
import { useAuthContext } from '../../../shared/lib/contexts/AuthContext';
import { UserAvatar } from '../../../shared/ui';
import ImagePreview from '../../../shared/ui/molecules/ImagePreview/ImagePreview';
import { buildMediaUrl, downloadMediaFile } from '../../../shared/lib/utils/urlHelpers';
import { appToast } from '../../../shared/lib/utils/appToast';
import FeedCommentTree from './FeedCommentTree';
import {
  buildShareUrl,
  formatFileSize,
  formatRelativeTime,
  formatScore,
  resolvePostTitle,
} from './feedFormat';

const FeedPostThread = ({
  postId,
  initialPost = null,
  isServerNews = false,
  onBack,
}) => {
  const { openProfile } = useProfileModal();
  const { user } = useAuthContext();
  const currentUserId = String(user?.id || user?.userId || user?.Id || '');

  const [post, setPost] = useState(initialPost);
  const [loading, setLoading] = useState(!initialPost);
  const [error, setError] = useState('');
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [sortMode, setSortMode] = useState('new');
  const [rootDraft, setRootDraft] = useState('');
  const [rootSubmitting, setRootSubmitting] = useState(false);
  const [replyToId, setReplyToId] = useState(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [reactionBusy, setReactionBusy] = useState({});
  const [previewMedia, setPreviewMedia] = useState(null);

  const load = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setError('');
    try {
      const data = await feedApi.getPost(postId);
      setPost(data);
    } catch (err) {
      console.error('FeedPostThread: failed to load post', err);
      setError(err?.response?.data?.error || 'Не удалось открыть тред');
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  const loadComments = useCallback(async () => {
    if (!postId) return;
    setCommentsLoading(true);
    try {
      const list = await feedApi.getComments(postId);
      setComments(list);
    } catch (err) {
      console.error('FeedPostThread: failed to load comments', err);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (!initialPost || String(initialPost.id) !== String(postId)) {
      void load();
    } else {
      setPost(initialPost);
      setLoading(false);
    }
    void loadComments();
  }, [postId, initialPost, load, loadComments]);

  const handlePostReaction = async (value) => {
    if (!post?.id || reactionBusy[post.id]) return;
    setReactionBusy((prev) => ({ ...prev, [post.id]: true }));
    try {
      const nextValue = post.myReaction === value ? null : value;
      const updated = await feedApi.setReaction(post.id, nextValue);
      setPost(updated);
    } catch (err) {
      console.error('FeedPostThread: reaction failed', err);
    } finally {
      setReactionBusy((prev) => ({ ...prev, [post.id]: false }));
    }
  };

  const handleCommentReaction = async (comment, value) => {
    if (!comment?.id || reactionBusy[comment.id]) return;
    setReactionBusy((prev) => ({ ...prev, [comment.id]: true }));
    try {
      const nextValue = comment.myReaction === value ? null : value;
      const updated = await feedApi.setCommentReaction(comment.id, nextValue);
      setComments((prev) =>
        prev.map((c) => (String(c.id) === String(updated.id) ? updated : c)),
      );
    } catch (err) {
      console.error('FeedPostThread: comment reaction failed', err);
    } finally {
      setReactionBusy((prev) => ({ ...prev, [comment.id]: false }));
    }
  };

  const handleShare = async () => {
    if (!post) return;
    const title = resolvePostTitle(post);
    const shareUrl = buildShareUrl(post.id);
    try {
      if (navigator.share) {
        await navigator.share({ title, text: title, url: shareUrl });
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(`${title}\n${shareUrl}`);
      appToast.success('Ссылка скопирована');
    } catch {
      appToast.error('Не удалось поделиться');
    }
  };

  const handleSubmitRoot = async () => {
    const text = rootDraft.trim();
    if (!text || rootSubmitting) return;
    setRootSubmitting(true);
    try {
      const comment = await feedApi.addComment(postId, text);
      setComments((prev) => [...prev, comment]);
      setRootDraft('');
      setPost((prev) =>
        prev
          ? { ...prev, commentsCount: Number(prev.commentsCount || 0) + 1 }
          : prev,
      );
    } catch (err) {
      console.error('FeedPostThread: add comment failed', err);
    } finally {
      setRootSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentId) => {
    const text = replyDraft.trim();
    if (!text || replySubmitting) return;
    setReplySubmitting(true);
    try {
      const comment = await feedApi.addComment(postId, text, parentId);
      setComments((prev) => [...prev, comment]);
      setReplyDraft('');
      setReplyToId(null);
      setPost((prev) =>
        prev
          ? { ...prev, commentsCount: Number(prev.commentsCount || 0) + 1 }
          : prev,
      );
    } catch (err) {
      console.error('FeedPostThread: reply failed', err);
      appToast.error(err?.response?.data?.error || 'Не удалось ответить');
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await feedApi.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => String(c.id) !== String(commentId)));
      setPost((prev) =>
        prev
          ? {
              ...prev,
              commentsCount: Math.max(0, Number(prev.commentsCount || 0) - 1),
            }
          : prev,
      );
    } catch (err) {
      console.error('FeedPostThread: delete comment failed', err);
    }
  };

  const renderAttachments = () => {
    const attachments = post?.attachments || [];
    if (!attachments.length) return null;
    const images = attachments.filter((item) => item.contentType?.startsWith('image/'));
    const videos = attachments.filter((item) => item.contentType?.startsWith('video/'));
    const files = attachments.filter(
      (item) =>
        !item.contentType?.startsWith('image/') && !item.contentType?.startsWith('video/'),
    );

    return (
      <div className="feed-panel__attachments">
        {images.length > 0 && (
          <div
            className={`feed-panel__media-grid feed-panel__media-grid--${Math.min(images.length, 4)}`}
          >
            {images.map((item) => (
              <button
                key={item.id}
                type="button"
                className="feed-panel__media-item"
                onClick={() => setPreviewMedia(item)}
              >
                <img src={buildMediaUrl(item.filePath)} alt={item.originalFileName} />
              </button>
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
        {files.map((item) => {
          const displayName =
            item.originalFileName ||
            item.fileName ||
            (typeof item.filePath === 'string' ? item.filePath.split('/').pop() : '') ||
            'file';
          return (
            <button
              key={item.id}
              type="button"
              className="feed-panel__file"
              onClick={() => downloadMediaFile(item.filePath, displayName)}
            >
              <InsertDriveFileOutlinedIcon sx={{ fontSize: 20 }} />
              <span className="feed-panel__file-meta">
                <span className="feed-panel__file-name" title={displayName}>
                  {displayName}
                </span>
                <span className="feed-panel__file-size">{formatFileSize(item.fileSize)}</span>
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return <div className="feed-panel__empty">Загрузка треда…</div>;
  }

  if (error || !post) {
    return (
      <div className="feed-thread">
        <div className="feed-thread__toolbar">
          <button type="button" className="feed-thread__back" onClick={onBack}>
            <ArrowBackIcon sx={{ fontSize: 20 }} />
            <span>Назад</span>
          </button>
        </div>
        <div className="feed-panel__empty">{error || 'Тред не найден'}</div>
      </div>
    );
  }

  const liked = post.myReaction === 'like';
  const disliked = post.myReaction === 'dislike';
  const displayName = isServerNews
    ? post.authorName
    : post.scope === 'server'
      ? post.serverName || post.authorName
      : post.authorName;
  const avatarUrl = isServerNews
    ? post.authorAvatar
    : post.scope === 'server'
      ? post.serverAvatar || post.authorAvatar
      : post.authorAvatar;

  return (
    <div className="feed-thread">
      <div className="feed-thread__toolbar">
        <button type="button" className="feed-thread__back" onClick={onBack}>
          <ArrowBackIcon sx={{ fontSize: 20 }} />
          <span>Назад</span>
        </button>
      </div>

      <div className="feed-thread__scroll">
        <article className="feed-thread__post">
          <button
            type="button"
            className="feed-panel__author"
            onClick={() => {
              if (!isServerNews && post.scope === 'server') return;
              openProfile(post.authorId, post.authorName);
            }}
          >
            <UserAvatar
              username={post.authorName}
              avatarUrl={avatarUrl}
              avatarColor={post.authorAvatarColor}
              size={36}
            />
            <div className="feed-panel__author-line">
              <span className="feed-panel__author-name">{displayName}</span>
              <span className="feed-panel__meta-dot">•</span>
              <span className="feed-panel__author-time">
                {formatRelativeTime(post.createdAt)}
              </span>
            </div>
          </button>

          <h1 className="feed-thread__title">{resolvePostTitle(post)}</h1>
          {post.text ? <p className="feed-thread__body">{post.text}</p> : null}
          {renderAttachments()}

          <div className="feed-panel__actions">
            <div
              className={`feed-panel__vote ${liked ? 'is-liked' : ''} ${disliked ? 'is-disliked' : ''}`}
            >
              <button
                type="button"
                className="feed-panel__vote-btn"
                disabled={reactionBusy[post.id]}
                onClick={() => void handlePostReaction('like')}
              >
                <KeyboardArrowUpIcon sx={{ fontSize: 26 }} />
              </button>
              <span className="feed-panel__vote-score">
                {formatScore(post.likesCount, post.dislikesCount)}
              </span>
              <button
                type="button"
                className="feed-panel__vote-btn"
                disabled={reactionBusy[post.id]}
                onClick={() => void handlePostReaction('dislike')}
              >
                <KeyboardArrowDownIcon sx={{ fontSize: 26 }} />
              </button>
            </div>
            <button
              type="button"
              className="feed-panel__pill feed-panel__pill--share"
              onClick={() => void handleShare()}
            >
              <IosShareIcon sx={{ fontSize: 18 }} />
              <span>Поделиться</span>
            </button>
          </div>
        </article>

        <FeedCommentTree
          comments={comments}
          currentUserId={currentUserId}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          rootDraft={rootDraft}
          onRootDraftChange={setRootDraft}
          onSubmitRoot={handleSubmitRoot}
          rootSubmitting={rootSubmitting}
          replyToId={replyToId}
          replyDraft={replyDraft}
          onReply={(id) => {
            setReplyToId(id);
            setReplyDraft('');
          }}
          onReplyDraftChange={setReplyDraft}
          onSubmitReply={handleSubmitReply}
          replySubmitting={replySubmitting}
          onDelete={handleDeleteComment}
          onReaction={handleCommentReaction}
          reactionBusy={reactionBusy}
          onOpenProfile={openProfile}
          loading={commentsLoading}
        />
      </div>

      <ImagePreview
        mediaFile={previewMedia}
        isOpen={Boolean(previewMedia)}
        onClose={() => setPreviewMedia(null)}
      />
    </div>
  );
};

export default FeedPostThread;
