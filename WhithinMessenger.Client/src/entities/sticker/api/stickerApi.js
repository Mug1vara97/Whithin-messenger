import apiClient from '../../../shared/lib/api/apiClient';

export const stickerApi = {
  async getInstalledPacks() {
    const response = await apiClient.get('/stickers/packs');
    return response.data;
  },

  async getAvailablePacks() {
    const response = await apiClient.get('/stickers/packs/available');
    return response.data;
  },

  async installPack(packId) {
    const response = await apiClient.post(`/stickers/packs/${packId}/install`);
    return response.data;
  },

  async createPack(title) {
    const response = await apiClient.post('/stickers/packs', { title });
    return response.data;
  },

  async uploadPack(title, archiveFile) {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('archive', archiveFile);
    const response = await apiClient.post('/stickers/packs/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async addStickerToPack(packId, file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post(`/stickers/packs/${packId}/stickers`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async uninstallPack(packId) {
    const response = await apiClient.delete(`/stickers/packs/${packId}/install`);
    return response.data;
  },

  async deletePack(packId) {
    const response = await apiClient.delete(`/stickers/packs/${packId}`);
    return response.data;
  },

  async sendSticker(chatId, stickerId, { repliedToMessageId } = {}) {
    const body = repliedToMessageId ? { repliedToMessageId } : {};
    const response = await apiClient.post(
      `/stickers/chats/${chatId}/send/${stickerId}`,
      body,
    );
    return response.data;
  },
};
