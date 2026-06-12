export const CHANNEL_TYPE = {
  TEXT: 3,
  VOICE: 4,
  IDEAS_BOARD: 5,
};

export const CHANNEL_TYPE_GUID = {
  TEXT: '33333333-3333-3333-3333-333333333333',
  VOICE: '44444444-4444-4444-4444-444444444444',
  IDEAS_BOARD: '55555555-5555-5555-5555-555555555555',
};

const normalizeTypeValue = (value) => {
  if (value === null || value === undefined) return null;
  return String(value).toLowerCase();
};

export const isVoiceChannel = (chat) => {
  const values = [
    chat?.chatType,
    chat?.chatTypeId,
    chat?.typeId,
    chat?.TypeId,
  ].map(normalizeTypeValue);

  return values.some(
    (value) =>
      value === '4' ||
      value === CHANNEL_TYPE_GUID.VOICE.toLowerCase()
  );
};

export const isIdeasBoardChannel = (chat) => {
  const values = [
    chat?.chatType,
    chat?.chatTypeId,
    chat?.typeId,
    chat?.TypeId,
  ].map(normalizeTypeValue);

  return values.some(
    (value) =>
      value === '5' ||
      value === CHANNEL_TYPE_GUID.IDEAS_BOARD.toLowerCase()
  );
};
