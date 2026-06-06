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

  async sendSticker(chatId, stickerId, { repliedToMessageId } = {}) {
    const body = repliedToMessageId ? { repliedToMessageId } : {};
    const response = await apiClient.post(
      `/stickers/chats/${chatId}/send/${stickerId}`,
      body,
    );
    return response.data;
  },
};
