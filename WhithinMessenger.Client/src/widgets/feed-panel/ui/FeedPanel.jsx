import React, { useCallback, useEffect, useState } from 'react';
import DynamicFeedOutlinedIcon from '@mui/icons-material/DynamicFeedOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import { feedApi, formatFeedTime } from '../../../entities/feed';
import { useAuthContext } from '../../../shared/lib/contexts/AuthContext';
import { useServerContext } from '../../../shared/lib/contexts/useServerContext';
import { useProfileModal } from '../../../shared/lib/contexts/ProfileModalContext';
import { UserAvatar } from '../../../shared/ui';
import './FeedPanel.css';

const FeedPanel = () => {
  const { user } = useAuthContext();
  const { servers } = useServerContext();
  const { openProfile } = useProfileModal();
  const [tab, setTab] = useState('friends');
  const [draft, setDraft] = useState('');
  const [serverId, setServerId] = useState('');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data =
        tab === 'servers' ? await feedApi.getServerFeed() : await feedApi.getFriendsFeed();
      setPosts(data);
    } catch (err) {
      console.error('FeedPanel: failed to load feed', err);
      setPosts([]);
      setError(err?.response?.data?.error || 'Не удалось загрузить ленту');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (!serverId && servers?.length) {
      const firstId = servers[0]?.serverId ?? servers[0]?.ServerId ?? servers[0]?.id;
      if (firstId) setServerId(String(firstId));
    }
  }, [servers, serverId]);

  const handlePublish = useCallback(async () => {
    if (!draft.trim() || publishing) return;
    if (tab === 'servers' && !serverId) {
      setError('Выберите сервер для поста');
      return;
    }

    setPublishing(true);
    setError('');
    try {
      await feedApi.createPost({
        text: draft,
        scope: tab === 'servers' ? 'server' : 'friend',
        serverId: tab === 'servers' ? serverId : null,
      });
      setDraft('');
      await loadPosts();
    } catch (err) {
      console.error('FeedPanel: failed to publish', err);
      setError(err?.response?.data?.error || 'Не удалось опубликовать пост');
    } finally {
      setPublishing(false);
    }
  }, [draft, publishing, tab, serverId, loadPosts]);

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
      <p className="feed-panel__text">{post.text}</p>
    </article>
  );

  return (
    <div className="feed-panel">
      <div className="feed-panel__header">
        <div className="feed-panel__title">
          <DynamicFeedOutlinedIcon sx={{ fontSize: 20 }} />
          <h2>Лента</h2>
        </div>
        <div className="feed-panel__tabs">
          <button
            type="button"
            className={`feed-panel__tab ${tab === 'friends' ? 'active' : ''}`}
            onClick={() => setTab('friends')}
          >
            Друзья
          </button>
          <button
            type="button"
            className={`feed-panel__tab ${tab === 'servers' ? 'active' : ''}`}
            onClick={() => setTab('servers')}
          >
            Серверы
          </button>
        </div>
      </div>

      <div className="feed-panel__scroll">
        <div className="feed-panel__composer">
          {tab === 'servers' && (
            <select
              className="feed-panel__server-select"
              value={serverId}
              onChange={(event) => setServerId(event.target.value)}
            >
              {(servers || []).length === 0 ? (
                <option value="">Нет серверов</option>
              ) : (
                servers.map((server) => {
                  const id = String(server.serverId ?? server.ServerId ?? server.id ?? '');
                  const name = server.name || server.Name || server.serverName || 'Сервер';
                  return (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  );
                })
              )}
            </select>
          )}
          <textarea
            className="feed-panel__composer-input"
            value={draft}
            maxLength={2000}
            rows={3}
            placeholder={
              tab === 'servers'
                ? 'Анонс для участников сервера…'
                : 'Что нового? Пост увидят только друзья.'
            }
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="feed-panel__composer-footer">
            <span className="feed-panel__composer-hint">
              {tab === 'friends' ? 'Только между друзьями' : 'Видно участникам сервера'}
            </span>
            <button
              type="button"
              className="feed-panel__publish"
              disabled={!draft.trim() || publishing || (tab === 'servers' && !serverId)}
              onClick={handlePublish}
            >
              Опубликовать
            </button>
          </div>
        </div>

        {tab === 'servers' && (
          <div className="feed-panel__banner">
            <GroupsOutlinedIcon sx={{ fontSize: 18 }} />
            <span>Посты серверов, в которых вы состоите.</span>
          </div>
        )}

        {error ? <div className="feed-panel__empty">{error}</div> : null}

        {loading ? (
          <div className="feed-panel__empty">Загрузка…</div>
        ) : posts.length === 0 ? (
          <div className="feed-panel__empty">
            {tab === 'friends'
              ? 'Пока нет постов. Напишите первый — его увидят друзья.'
              : 'Пока нет постов серверов.'}
          </div>
        ) : (
          <div className="feed-panel__list">{posts.map(renderPost)}</div>
        )}
      </div>
    </div>
  );
};

export default FeedPanel;
