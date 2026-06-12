import { useCallback, useEffect, useState } from 'react';
import { ideaBoardApi } from '../api/ideaBoardApi';

export const useIdeaBoard = (connection, chatId) => {
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCards = useCallback(async () => {
    if (!connection || !chatId || connection.state !== 'Connected') return;
    try {
      setIsLoading(true);
      setError(null);
      await ideaBoardApi.getCards(connection, chatId);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить идеи');
    } finally {
      setIsLoading(false);
    }
  }, [connection, chatId]);

  useEffect(() => {
    if (!connection || !chatId) return undefined;

    const handleLoaded = (loadedCards) => {
      const normalized = (Array.isArray(loadedCards) ? loadedCards : []).map(ideaBoardApi.normalizeCard);
      setCards(normalized);
      setIsLoading(false);
    };

    const handleCreated = (card) => {
      const normalized = ideaBoardApi.normalizeCard(card);
      setCards((prev) => {
        if (prev.some((item) => String(item.cardId) === String(normalized.cardId))) return prev;
        return [normalized, ...prev];
      });
    };

    const handleUpdated = (card) => {
      const normalized = ideaBoardApi.normalizeCard(card);
      setCards((prev) =>
        prev.map((item) => (String(item.cardId) === String(normalized.cardId) ? normalized : item))
      );
    };

    const handlePositionUpdated = (card) => {
      const normalized = ideaBoardApi.normalizeCard(card);
      setCards((prev) =>
        prev.map((item) => (String(item.cardId) === String(normalized.cardId) ? normalized : item))
      );
    };

    const handleDeleted = (payload) => {
      const cardId = payload?.cardId ?? payload?.CardId;
      if (!cardId) return;
      setCards((prev) => prev.filter((item) => String(item.cardId) !== String(cardId)));
    };

    connection.on('IdeaBoardCardsLoaded', handleLoaded);
    connection.on('IdeaBoardCardCreated', handleCreated);
    connection.on('IdeaBoardCardUpdated', handleUpdated);
    connection.on('IdeaBoardCardPositionUpdated', handlePositionUpdated);
    connection.on('IdeaBoardCardDeleted', handleDeleted);

    fetchCards();

    return () => {
      connection.off('IdeaBoardCardsLoaded', handleLoaded);
      connection.off('IdeaBoardCardCreated', handleCreated);
      connection.off('IdeaBoardCardUpdated', handleUpdated);
      connection.off('IdeaBoardCardPositionUpdated', handlePositionUpdated);
      connection.off('IdeaBoardCardDeleted', handleDeleted);
    };
  }, [connection, chatId, fetchCards]);

  return {
    cards,
    isLoading,
    error,
    fetchCards,
    createCard: (payload) => ideaBoardApi.createCard(connection, chatId, payload),
    updateCard: (cardId, payload) => ideaBoardApi.updateCard(connection, cardId, payload),
    updateCardPosition: (cardId, x, y, rotation) =>
      ideaBoardApi.updateCardPosition(connection, cardId, x, y, rotation),
    deleteCard: (cardId) => ideaBoardApi.deleteCard(connection, cardId),
  };
};
