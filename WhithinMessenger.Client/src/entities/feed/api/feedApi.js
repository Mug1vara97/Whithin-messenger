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

export const normalizeComment = (comment) => {
  if (!comment) return null;
  const myReactionRaw = comment.myReaction ?? comment.MyReaction ?? null;
  return {
    id: String(comment.id ?? comment.Id ?? ''),
    postId: String(comment.postId ?? comment.PostId ?? ''),
    parentCommentId: (() => {
      const raw = comment.parentCommentId ?? comment.ParentCommentId ?? null;
      return raw ? String(raw) : null;
    })(),
    text: comment.text ?? comment.Text ?? '',
    createdAt: comment.createdAt ?? comment.CreatedAt ?? null,
    authorId: String(comment.authorId ?? comment.AuthorId ?? ''),
    authorName: comment.authorName ?? comment.AuthorName ?? 'Пользователь',
    authorUsername: comment.authorUsername ?? comment.AuthorUsername ?? null,
    authorAvatar: comment.authorAvatar ?? comment.AuthorAvatar ?? null,
    authorAvatarColor: comment.authorAvatarColor ?? comment.AuthorAvatarColor ?? '#5865f2',
    likesCount: Number(comment.likesCount ?? comment.LikesCount ?? 0),
    dislikesCount: Number(comment.dislikesCount ?? comment.DislikesCount ?? 0),
    myReaction: myReactionRaw === 'like' || myReactionRaw === 'dislike' ? myReactionRaw : null,
  };
};

export const normalizePost = (post) => {
  if (!post) return null;
  const attachmentsRaw = post.attachments ?? post.Attachments ?? [];
  const myReactionRaw = post.myReaction ?? post.MyReaction ?? null;
  const text = post.text ?? post.Text ?? '';
  const titleRaw = post.title ?? post.Title ?? '';
  return {
    id: String(post.id ?? post.Id ?? ''),
    scope: post.scope === 'server' || post.Scope === 'server' || post.scope === 1 ? 'server' : 'friend',
    title: String(titleRaw || '').trim() || null,
    authorId: String(post.authorId ?? post.AuthorId ?? ''),
    authorName: post.authorName ?? post.AuthorName ?? 'Пользователь',
    authorUsername: post.authorUsername ?? post.AuthorUsername ?? null,
    authorAvatar: post.authorAvatar ?? post.AuthorAvatar ?? null,
    authorAvatarColor: post.authorAvatarColor ?? post.AuthorAvatarColor ?? '#5865f2',
    text,
    createdAt: post.createdAt ?? post.CreatedAt ?? null,
    serverId: post.serverId ?? post.ServerId ?? null,
    serverName: post.serverName ?? post.ServerName ?? null,
    serverAvatar: post.serverAvatar ?? post.ServerAvatar ?? null,
    attachments: (Array.isArray(attachmentsRaw) ? attachmentsRaw : [])
      .map(normalizeAttachment)
      .filter(Boolean),
    likesCount: Number(post.likesCount ?? post.LikesCount ?? 0),
    dislikesCount: Number(post.dislikesCount ?? post.DislikesCount ?? 0),
    commentsCount: Number(post.commentsCount ?? post.CommentsCount ?? 0),
    myReaction: myReactionRaw === 'like' || myReactionRaw === 'dislike' ? myReactionRaw : null,
    isStub: false,
  };
};

/** Build nested tree from flat comment list. */
export const buildCommentTree = (comments = []) => {
  const byId = new Map();
  const roots = [];
  for (const comment of comments) {
    byId.set(String(comment.id), { ...comment, children: [] });
  }
  for (const comment of comments) {
    const node = byId.get(String(comment.id));
    const parentId = comment.parentCommentId ? String(comment.parentCommentId) : null;
    if (parentId && byId.has(parentId)) {
      byId.get(parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
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

  async getServerPosts(serverId, take = 50) {
    if (!serverId) return [];
    const response = await apiClient.get(`/feed/servers/${serverId}`, { params: { take } });
    return (Array.isArray(response.data) ? response.data : []).map(normalizePost).filter(Boolean);
  },

  async getUserPosts(userId, take = 50) {
    if (!userId) return [];
    const response = await apiClient.get(`/feed/user/${userId}`, { params: { take } });
    return (Array.isArray(response.data) ? response.data : []).map(normalizePost).filter(Boolean);
  },

  async getPost(postId) {
    if (!postId) return null;
    const response = await apiClient.get(`/feed/${postId}`);
    return normalizePost(response.data);
  },

  async createPost({ title = '', text = '', scope = 'friend', serverId = null, files = [] } = {}) {
    const formData = new FormData();
    if (title) formData.append('title', title);
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

  async setReaction(postId, value) {
    const response = await apiClient.put(`/feed/${postId}/reaction`, {
      value: value || null,
    });
    return normalizePost(response.data);
  },

  async getComments(postId, take = 500) {
    const response = await apiClient.get(`/feed/${postId}/comments`, { params: { take } });
    return (Array.isArray(response.data) ? response.data : []).map(normalizeComment).filter(Boolean);
  },

  async addComment(postId, text, parentCommentId = null) {
    const payload = { text };
    if (parentCommentId) payload.parentCommentId = parentCommentId;
    const response = await apiClient.post(`/feed/${postId}/comments`, payload);
    return normalizeComment(response.data);
  },

  async setCommentReaction(commentId, value) {
    const response = await apiClient.put(`/feed/comments/${commentId}/reaction`, {
      value: value || null,
    });
    return normalizeComment(response.data);
  },

  async deleteComment(commentId) {
    await apiClient.delete(`/feed/comments/${commentId}`);
    return true;
  },
};
