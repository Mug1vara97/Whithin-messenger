import React from 'react';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import IosShareIcon from '@mui/icons-material/IosShare';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import { UserAvatar } from '../../../shared/ui';
import { buildMediaUrl } from '../../../shared/lib/utils/urlHelpers';
import {
  formatFileSize,
  formatRelativeTime,
  formatScore,
  resolvePostPreview,
  resolvePostTitle,
} from './feedFormat';

const FeedPostCard = ({
  post,
  isServerNews = false,
  reactionBusy = false,
  onOpen,
  onReaction,
  onShare,
  onOpenProfile,
}) => {
  if (!post) return null;

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
  const title = resolvePostTitle(post);
  const preview = resolvePostPreview(post);
  const attachments = post.attachments || [];
  const images = attachments.filter((item) => item.contentType?.startsWith('image/'));
  const thumb = images[0];

  return (
    <article className="feed-panel__card feed-panel__card--thread">
      <button
        type="button"
        className="feed-panel__card-hit"
        onClick={() => onOpen?.(post)}
        aria-label={`Открыть тред: ${title}`}
      />

      <div className="feed-panel__card-body">
        <div className="feed-panel__card-top">
          <button
            type="button"
            className="feed-panel__author"
            onClick={(e) => {
              e.stopPropagation();
              if (!isServerNews && post.scope === 'server') return;
              onOpenProfile?.(post.authorId, post.authorName);
            }}
          >
            <UserAvatar
              username={post.authorName}
              avatarUrl={avatarUrl}
              avatarColor={post.authorAvatarColor}
              size={28}
            />
            <div className="feed-panel__author-line">
              <span className="feed-panel__author-name">{displayName}</span>
              <span className="feed-panel__meta-dot">•</span>
              <span className="feed-panel__author-time">{formatRelativeTime(post.createdAt)}</span>
              {!isServerNews && post.scope === 'server' ? (
                <>
                  <span className="feed-panel__meta-dot">•</span>
                  <span className="feed-panel__author-time">сервер</span>
                </>
              ) : null}
            </div>
          </button>
        </div>

        <h3 className="feed-panel__post-title">{title}</h3>
        {preview ? <p className="feed-panel__post-preview">{preview}</p> : null}

        {thumb ? (
          <div className="feed-panel__card-thumb">
            <img src={buildMediaUrl(thumb.filePath)} alt="" />
          </div>
        ) : attachments.length > 0 ? (
          <div className="feed-panel__card-files-hint">
            <InsertDriveFileOutlinedIcon sx={{ fontSize: 16 }} />
            <span>
              {attachments.length}{' '}
              {attachments.length === 1 ? 'вложение' : 'вложений'}
              {attachments[0]?.fileSize
                ? ` · ${formatFileSize(attachments[0].fileSize)}`
                : ''}
            </span>
          </div>
        ) : null}

        <div className="feed-panel__actions" onClick={(e) => e.stopPropagation()}>
          <div
            className={`feed-panel__vote ${liked ? 'is-liked' : ''} ${disliked ? 'is-disliked' : ''}`}
          >
            <button
              type="button"
              className="feed-panel__vote-btn"
              disabled={reactionBusy}
              onClick={() => onReaction?.(post, 'like')}
              title="Нравится"
            >
              <KeyboardArrowUpIcon sx={{ fontSize: 26 }} />
            </button>
            <span className="feed-panel__vote-score">
              {formatScore(post.likesCount, post.dislikesCount)}
            </span>
            <button
              type="button"
              className="feed-panel__vote-btn"
              disabled={reactionBusy}
              onClick={() => onReaction?.(post, 'dislike')}
              title="Не нравится"
            >
              <KeyboardArrowDownIcon sx={{ fontSize: 26 }} />
            </button>
          </div>

          <button
            type="button"
            className="feed-panel__pill"
            onClick={() => onOpen?.(post)}
            title="Комментарии"
          >
            <ChatBubbleOutlineIcon sx={{ fontSize: 18 }} />
            <span>{post.commentsCount || 0}</span>
          </button>

          <button
            type="button"
            className="feed-panel__pill feed-panel__pill--share"
            onClick={() => onShare?.(post)}
            title="Поделиться"
          >
            <IosShareIcon sx={{ fontSize: 18 }} />
            <span>Поделиться</span>
          </button>
        </div>
      </div>
    </article>
  );
};

export default FeedPostCard;
