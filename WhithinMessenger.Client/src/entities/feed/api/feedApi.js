import apiClient from '../../../shared/lib/api/apiClient';

const normalizePost = (post) => {
  if (!post) return null;
  return {
    id: String(post.id ?? post.Id ?? ''),
    scope: post.scope === 'server' || post.Scope === 'server' || post.scope === 1 ? 'server' : 'friend',
    authorId: String(post.authorId ?? post.AuthorId ?? ''),
    authorName: post.authorName ?? post.AuthorName ?? 'Пользователь',
    authorUsername: post.authorUsername ?? post.AuthorUsername ?? null,
    authorAvatar: post.authorAvatar ?? post.AuthorAvatar ?? null,
    authorAvatarColor: post.authorAvatarColor ?? post.AuthorAvatarColor ?? '#5865f2',
    text: post.text ?? post.Text ?? '',
    createdAt: post.createdAt ?? post.CreatedAt ?? null,
    serverId: post.serverId ?? post.ServerId ?? null,
    serverName: post.serverName ?? post.ServerName ?? null,
    serverAvatar: post.serverAvatar ?? post.ServerAvatar ?? null,
    isStub: false,
  };
};

export const feedApi = {
  async getFriendsFeed(take = 50) {
    const response = await apiClient.get('/feed/friends', { params: { take } });
    return (Array.isArray(response.data) ? response.data : []).map(normalizePost).filter(Boolean);
  },

  async getServerFeed(take = 50) {
    const response = await apiClient.get('/feed/servers', { params: { take } });
    return (Array.isArray(response.data) ? response.data : []).map(normalizePost).filter(Boolean);
  },

  async getUserPosts(userId, take = 50) {
    if (!userId) return [];
    const response = await apiClient.get(`/feed/user/${userId}`, { params: { take } });
    return (Array.isArray(response.data) ? response.data : []).map(normalizePost).filter(Boolean);
  },

  async createPost({ text, scope = 'friend', serverId = null }) {
    const response = await apiClient.post('/feed', {
      text,
      scope,
      serverId,
    });
    return normalizePost(response.data);
  },

  async deletePost(postId) {
    if (!postId) return false;
    await apiClient.delete(`/feed/${postId}`);
    return true;
  },
};
