const normalizeCard = (card) => ({
  cardId: card.cardId ?? card.CardId ?? card.id,
  chatId: card.chatId ?? card.ChatId,
  authorUserId: card.authorUserId ?? card.AuthorUserId,
  authorUsername: card.authorUsername ?? card.AuthorUsername ?? 'User',
  title: card.title ?? card.Title ?? '',
  body: card.body ?? card.Body ?? '',
  tag: card.tag ?? card.Tag ?? null,
  sourceUrl: card.sourceUrl ?? card.SourceUrl ?? null,
  positionX: card.positionX ?? card.PositionX ?? null,
  positionY: card.positionY ?? card.PositionY ?? null,
  rotation: card.rotation ?? card.Rotation ?? 0,
  isFiled: Boolean(card.isFiled ?? card.IsFiled),
  createdAt: card.createdAt ?? card.CreatedAt,
  updatedAt: card.updatedAt ?? card.UpdatedAt ?? null,
});

export const ideaBoardApi = {
  normalizeCard,

  async getCards(connection, chatId) {
    return connection.invoke('GetIdeaBoardCards', chatId);
  },

  async createCard(connection, chatId, payload) {
    return connection.invoke(
      'CreateIdeaBoardCard',
      chatId,
      payload.title,
      payload.body,
      payload.tag ?? null,
      payload.sourceUrl ?? null
    );
  },

  async updateCard(connection, cardId, payload) {
    return connection.invoke(
      'UpdateIdeaBoardCard',
      cardId,
      payload.title,
      payload.body,
      payload.tag ?? null,
      payload.sourceUrl ?? null,
      payload.isFiled ?? null
    );
  },

  async updateCardPosition(connection, cardId, positionX, positionY, rotation) {
    return connection.invoke(
      'UpdateIdeaBoardCardPosition',
      cardId,
      positionX,
      positionY,
      rotation
    );
  },

  async deleteCard(connection, cardId) {
    return connection.invoke('DeleteIdeaBoardCard', cardId);
  },
};
