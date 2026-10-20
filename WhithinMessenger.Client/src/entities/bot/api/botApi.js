import apiClient from '../../../shared/lib/api/apiClient';
import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import tokenManager from '../../../shared/lib/services/tokenManager';

const botBase = () => {
  // Prefer same-origin /api/bot (nginx → Go). Fall back to API host.
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/bot`;
  }
  return `${BASE_URL || ''}/api/bot`;
};

const authHeaders = () => {
  const token = tokenManager.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const request = async (path, options = {}) => {
  const response = await fetch(`${botBase()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
    credentials: 'include',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `Bot API error ${response.status}`);
  }
  return data;
};

export const botApi = {
  listApplications: () => request('/developer/applications'),
  createApplication: (name) =>
    request('/developer/applications', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  listBots: (appId) => request(`/developer/applications/${appId}/bots`),
  createBot: (appId, { username, displayName }) =>
    request(`/developer/applications/${appId}/bots`, {
      method: 'POST',
      body: JSON.stringify({ username, displayName }),
    }),
  rotateToken: (botId) =>
    request(`/developer/bots/${botId}/token`, { method: 'POST', body: '{}' }),
  installBot: (botId, serverId, permissions = 0) =>
    request(`/developer/bots/${botId}/install`, {
      method: 'POST',
      body: JSON.stringify({ serverId, permissions }),
    }),
  setWebhook: (botId, url) =>
    request(`/developer/bots/${botId}/webhook`, {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),
};

// Kept for potential future axios routing; developer API uses fetch above.
export const botApiClient = apiClient;
