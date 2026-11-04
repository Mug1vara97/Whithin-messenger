import React, { useMemo, useState } from 'react';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SendIcon from '@mui/icons-material/Send';
import { buildCommentTree } from '../../../entities/feed';
import { UserAvatar } from '../../../shared/ui';
import { formatRelativeTime, formatScore } from './feedFormat';

const CommentNode = ({
  node,
  depth,
  currentUserId,
  sortMode,
  collapsed,
  onToggleCollapse,
  onReply,
  replyToId,
  replyDraft,
  onReplyDraftChange,
  onSubmitReply,
  replySubmitting,
  onDelete,
  onReaction,
  reactionBusy,
  onOpenProfile,
}) => {
  const isCollapsed = Boolean(collapsed[node.id]);
  const canDelete = currentUserId && String(node.authorId) === currentUserId;
  const liked = node.myReaction === 'like';
  const disliked = node.myReaction === 'dislike';
  const busy = reactionBusy[node.id];
  const children = useMemo(() => {
    const list = [...(node.children || [])];
    if (sortMode === 'best') {
      list.sort(
        (a, b) =>
          Number(b.likesCount || 0) -
          Number(b.dislikesCount || 0) -
          (Number(a.likesCount || 0) - Number(a.dislikesCount || 0)),
      );
    } else {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return list;
  }, [node.children, sortMode]);

  return (
    <div className={`feed-thread__comment depth-${Math.min(depth, 6)}`}>
      <div className="feed-thread__comment-row">
        <button
          type="button"
          className="feed-panel__comment-author"
          onClick={() => onOpenProfile?.(node.authorId, node.authorName)}
        >
          <UserAvatar
            username={node.authorName}
            avatarUrl={node.authorAvatar}
            avatarColor={node.authorAvatarColor}
            size={28}
          />
        </button>
        <div className="feed-panel__comment-body">
          <div className="feed-panel__comment-head">
            <button
              type="button"
              className="feed-panel__comment-name"
              onClick={() => onOpenProfile?.(node.authorId, node.authorName)}
            >
              {node.authorName}
            </button>
            <span className="feed-panel__comment-time">{formatRelativeTime(node.createdAt)}</span>
            {canDelete ? (
              <button
                type="button"
                className="feed-panel__comment-delete"
                title="Удалить"
                onClick={() => onDelete?.(node.id)}
              >
                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
              </button>
            ) : null}
          </div>
          <p className="feed-panel__comment-text">{node.text}</p>
          <div className="feed-thread__comment-actions">
            <div
              className={`feed-panel__vote feed-panel__vote--compact ${liked ? 'is-liked' : ''} ${disliked ? 'is-disliked' : ''}`}
            >
              <button
                type="button"
                className="feed-panel__vote-btn"
                disabled={busy}
                onClick={() => onReaction?.(node, 'like')}
              >
                <KeyboardArrowUpIcon sx={{ fontSize: 20 }} />
              </button>
              <span className="feed-panel__vote-score">
                {formatScore(node.likesCount, node.dislikesCount)}
              </span>
              <button
                type="button"
                className="feed-panel__vote-btn"
                disabled={busy}
                onClick={() => onReaction?.(node, 'dislike')}
              >
                <KeyboardArrowDownIcon sx={{ fontSize: 20 }} />
              </button>
            </div>
            {depth < 5 ? (
              <button
                type="button"
                className="feed-thread__reply-btn"
                onClick={() => onReply?.(node.id)}
              >
                Ответить
              </button>
            ) : null}
            {children.length > 0 ? (
              <button
                type="button"
                className="feed-thread__reply-btn"
                onClick={() => onToggleCollapse?.(node.id)}
              >
                {isCollapsed ? `Показать (${children.length})` : 'Свернуть'}
              </button>
            ) : null}
          </div>

          {replyToId === node.id ? (
            <form
              className="feed-panel__comment-form feed-thread__inline-reply"
              onSubmit={(e) => {
                e.preventDefault();
                void onSubmitReply?.(node.id);
              }}
            >
              <input
                type="text"
                className="feed-panel__comment-input"
                placeholder="Ваш ответ…"
                value={replyDraft || ''}
                maxLength={2000}
                onChange={(e) => onReplyDraftChange?.(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                className="feed-panel__comment-send"
                disabled={!String(replyDraft || '').trim() || replySubmitting}
              >
                <SendIcon sx={{ fontSize: 18 }} />
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {!isCollapsed && children.length > 0 ? (
        <div className="feed-thread__replies">
          {children.map((child) => (
            <CommentNode
              key={child.id}
              node={child}
              depth={depth + 1}
              currentUserId={currentUserId}
              sortMode={sortMode}
              collapsed={collapsed}
              onToggleCollapse={onToggleCollapse}
              onReply={onReply}
              replyToId={replyToId}
              replyDraft={replyDraft}
              onReplyDraftChange={onReplyDraftChange}
              onSubmitReply={onSubmitReply}
              replySubmitting={replySubmitting}
              onDelete={onDelete}
              onReaction={onReaction}
              reactionBusy={reactionBusy}
              onOpenProfile={onOpenProfile}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

const FeedCommentTree = ({
  comments = [],
  currentUserId,
  sortMode = 'new',
  onSortModeChange,
  rootDraft,
  onRootDraftChange,
  onSubmitRoot,
  rootSubmitting,
  replyToId,
  replyDraft,
  onReply,
  onReplyDraftChange,
  onSubmitReply,
  replySubmitting,
  onDelete,
  onReaction,
  reactionBusy = {},
  onOpenProfile,
  loading = false,
}) => {
  const [collapsed, setCollapsed] = useState({});
  const tree = useMemo(() => {
    const roots = buildCommentTree(comments);
    const list = [...roots];
    if (sortMode === 'best') {
      list.sort(
        (a, b) =>
          Number(b.likesCount || 0) -
          Number(b.dislikesCount || 0) -
          (Number(a.likesCount || 0) - Number(a.dislikesCount || 0)),
      );
    } else {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return list;
  }, [comments, sortMode]);

  return (
    <div className="feed-thread__comments">
      <div className="feed-thread__comments-head">
        <span className="feed-thread__comments-count">
          {comments.length}{' '}
          {comments.length === 1 ? 'комментарий' : 'комментариев'}
        </span>
        <div className="feed-thread__sort">
          <button
            type="button"
            className={sortMode === 'new' ? 'is-active' : ''}
            onClick={() => onSortModeChange?.('new')}
          >
            Новые
          </button>
          <button
            type="button"
            className={sortMode === 'best' ? 'is-active' : ''}
            onClick={() => onSortModeChange?.('best')}
          >
            Лучшие
          </button>
        </div>
      </div>

      <form
        className="feed-panel__comment-form"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmitRoot?.();
        }}
      >
        <input
          type="text"
          className="feed-panel__comment-input"
          placeholder="Написать комментарий…"
          value={rootDraft || ''}
          maxLength={2000}
          onChange={(e) => onRootDraftChange?.(e.target.value)}
        />
        <button
          type="submit"
          className="feed-panel__comment-send"
          disabled={!String(rootDraft || '').trim() || rootSubmitting}
        >
          <SendIcon sx={{ fontSize: 18 }} />
        </button>
      </form>

      {loading ? (
        <div className="feed-panel__comments-empty">Загрузка комментариев…</div>
      ) : tree.length === 0 ? (
        <div className="feed-panel__comments-empty">Пока нет комментариев</div>
      ) : (
        <div className="feed-thread__tree">
          {tree.map((node) => (
            <CommentNode
              key={node.id}
              node={node}
              depth={0}
              currentUserId={currentUserId}
              sortMode={sortMode}
              collapsed={collapsed}
              onToggleCollapse={(id) =>
                setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
              }
              onReply={onReply}
              replyToId={replyToId}
              replyDraft={replyDraft}
              onReplyDraftChange={onReplyDraftChange}
              onSubmitReply={onSubmitReply}
              replySubmitting={replySubmitting}
              onDelete={onDelete}
              onReaction={onReaction}
              reactionBusy={reactionBusy}
              onOpenProfile={onOpenProfile}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FeedCommentTree;
