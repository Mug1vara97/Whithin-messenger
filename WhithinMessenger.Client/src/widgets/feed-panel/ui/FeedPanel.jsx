import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import DynamicFeedOutlinedIcon from '@mui/icons-material/DynamicFeedOutlined';
import AddIcon from '@mui/icons-material/Add';
import { feedApi } from '../../../entities/feed';
import { useProfileModal } from '../../../shared/lib/contexts/ProfileModalContext';
import { appToast } from '../../../shared/lib/utils/appToast';
import CreateFeedPostModal from './CreateFeedPostModal';
import FeedPostCard from './FeedPostCard';
import FeedPostThread from './FeedPostThread';
import { buildShareUrl, resolvePostTitle } from './feedFormat';
import './FeedPanel.css';

const FeedPanel = ({
  serverId = null,
  channelName = 'Новости',
  canCreate = true,
  embedded = false,
  activePostId: activePostIdProp = null,
  onActivePostIdChange = null,
} = {}) => {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { openProfile } = useProfileModal();
  const isServerNews = Boolean(serverId);

  const routePostId = !isServerNews ? params.postId || null : null;
  const queryPostId = isServerNews ? searchParams.get('post') : null;
  const activePostId =
    activePostIdProp ?? routePostId ?? queryPostId ?? null;

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [reactionBusy, setReactionBusy] = useState({});

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = isServerNews
        ? await feedApi.getServerPosts(serverId)
        : await feedApi.getFeed();
      setPosts(data);
    } catch (err) {
      console.error('FeedPanel: failed to load feed', err);
      setPosts([]);
      setError(
        err?.response?.data?.error ||
          (isServerNews
            ? 'Не удалось загрузить новости сервера'
            : 'Не удалось загрузить ленту'),
      );
    } finally {
      setLoading(false);
    }
  }, [isServerNews, serverId]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  // Deep link: #feed/{id}
  useEffect(() => {
    const consumeHash = () => {
      const match = String(window.location.hash || '').match(/^#feed\/([0-9a-fA-F-]{36})$/);
      if (!match) return;
      const id = match[1];
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}`,
      );
      openPostById(id);
    };
    consumeHash();
    window.addEventListener('hashchange', consumeHash);
    return () => window.removeEventListener('hashchange', consumeHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isServerNews, serverId]);

  const setActivePostId = useCallback(
    (postId) => {
      if (onActivePostIdChange) {
        onActivePostIdChange(postId);
        return;
      }
      if (isServerNews) {
        const next = new URLSearchParams(searchParams);
        if (postId) next.set('post', String(postId));
        else next.delete('post');
        setSearchParams(next, { replace: false });
        return;
      }
      if (postId) navigate(`/channels/@me/feed/${postId}`);
      else navigate('/channels/@me/feed');
    },
    [onActivePostIdChange, isServerNews, searchParams, setSearchParams, navigate],
  );

  const openPostById = useCallback(
    (postId) => {
      if (!postId) return;
      setActivePostId(postId);
    },
    [setActivePostId],
  );

  const openPost = useCallback(
    (post) => {
      if (!post?.id) return;
      setActivePostId(post.id);
    },
    [setActivePostId],
  );

  const closePost = useCallback(() => {
    setActivePostId(null);
  }, [setActivePostId]);

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
    } catch (err) {
      console.error('FeedPanel: failed to share', err);
      appToast.error('Не удалось поделиться');
    }
  };

  if (activePostId) {
    const initial = posts.find((p) => String(p.id) === String(activePostId)) || null;
    return (
      <div className={`feed-panel ${embedded ? 'feed-panel--embedded' : ''}`}>
        <FeedPostThread
          postId={activePostId}
          initialPost={initial}
          isServerNews={isServerNews}
          onBack={closePost}
        />
      </div>
    );
  }

  return (
    <div className={`feed-panel ${embedded ? 'feed-panel--embedded' : ''}`}>
      <div className="feed-panel__header">
        <div className="feed-panel__title">
          <DynamicFeedOutlinedIcon sx={{ fontSize: 20 }} />
          <h2>{isServerNews ? channelName || 'Новости' : 'Лента'}</h2>
        </div>
        {canCreate ? (
          <button
            type="button"
            className="feed-panel__add"
            title="Создать пост"
            onClick={() => setComposerOpen(true)}
          >
            <AddIcon sx={{ fontSize: 22 }} />
          </button>
        ) : null}
      </div>

      <div className="feed-panel__scroll">
        {error ? <div className="feed-panel__empty">{error}</div> : null}

        {loading ? (
          <div className="feed-panel__empty">Загрузка…</div>
        ) : posts.length === 0 ? (
          <div className="feed-panel__empty">
            {isServerNews
              ? canCreate
                ? 'Пока нет новостей. Нажмите «+», чтобы опубликовать первую.'
                : 'Пока нет новостей на этом сервере.'
              : 'Пока нет постов. Нажмите «+», чтобы создать первый — его увидят друзья.'}
          </div>
        ) : (
          <div className="feed-panel__list">
            {posts.map((post) => (
              <FeedPostCard
                key={post.id}
                post={post}
                isServerNews={isServerNews}
                reactionBusy={Boolean(reactionBusy[post.id])}
                onOpen={openPost}
                onReaction={handleReaction}
                onShare={handleShare}
                onOpenProfile={openProfile}
              />
            ))}
          </div>
        )}
      </div>

      <CreateFeedPostModal
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        scope={isServerNews ? 'server' : 'friend'}
        serverId={isServerNews ? serverId : null}
        title={isServerNews ? 'Новость сервера' : 'Новый пост'}
        placeholder={
          isServerNews
            ? 'Текст новости (необязательно).'
            : 'Текст поста (необязательно). Пост увидят только друзья.'
        }
        onCreated={() => {
          void loadPosts();
        }}
      />
    </div>
  );
};

export default FeedPanel;
