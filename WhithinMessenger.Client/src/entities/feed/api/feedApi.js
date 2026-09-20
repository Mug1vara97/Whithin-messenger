import apiClient from '../../../shared/lib/api/apiClient';
import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import tokenManager from '../../../shared/lib/services/tokenManager';

const normalizeAttachment = (item) => {
  if (!item) return null;
  return {
    id: String(item.id ?? item.Id ?? ''),
    fileName: item.fileName ?? item.FileName ?? '',
    originalFileName: item.originalFileName ?? item.OriginalFileName ?? 'file',
    filePath: item.filePath ?? item.FilePath ?? '',
    contentType: item.contentType ?? item.ContentType ?? 'application/octet-stream',
    fileSize: Number(item.fileSize ?? item.FileSize ?? 0),
    thumbnailPath: item.thumbnailPath ?? item.ThumbnailPath ?? null,
  };
};

const normalizePost = (post) => {
  if (!post) return null;
  const attachmentsRaw = post.attachments ?? post.Attachments ?? [];
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
    attachments: (Array.isArray(attachmentsRaw) ? attachmentsRaw : [])
      .map(normalizeAttachment)
      .filter(Boolean),
    isStub: false,
  };
};

export const feedApi = {
  async getFeed(take = 50) {
    const response = await apiClient.get('/feed', { params: { take } });
    return (Array.isArray(response.data) ? response.data : []).map(normalizePost).filter(Boolean);
  },

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

  async createPost({ text = '', scope = 'friend', serverId = null, files = [] } = {}) {
    const formData = new FormData();
    formData.append('text', text ?? '');
    formData.append('scope', scope || 'friend');
    if (serverId) {
      formData.append('serverId', String(serverId));
    }
    for (const file of files || []) {
      if (file) formData.append('files', file);
    }

    const headers = {};
    const token = tokenManager.getToken();
    if (token && tokenManager.isTokenValid()) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}/api/feed`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers,
    });

    if (!response.ok) {
      let message = 'Не удалось опубликовать пост';
      try {
        const data = await response.json();
        message = data?.error || message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    const data = await response.json();
    return normalizePost(data);
  },

  async deletePost(postId) {
    if (!postId) return false;
    await apiClient.delete(`/feed/${postId}`);
    return true;
  },
};
