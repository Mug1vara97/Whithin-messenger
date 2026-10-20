const aboutByUserId = new Map();

const toKey = (userId) => {
  if (userId == null) return null;
  return String(userId).trim().toLowerCase();
};

export const setCachedProfileAbout = (userId, description) => {
  const key = toKey(userId);
  if (!key) return;
  const text = description == null ? '' : String(description).trim();
  if (text) {
    aboutByUserId.set(key, text);
  } else {
    aboutByUserId.delete(key);
  }
};

export const getCachedProfileAbout = (userId) => {
  const key = toKey(userId);
  if (!key) return '';
  return aboutByUserId.get(key) || '';
};

export const rememberProfileAboutFromPatch = (patch) => {
  if (!patch) return;
  const userId = patch.userId ?? patch.UserId;
  const description = patch.description ?? patch.Description;
  if (description != null && String(description).trim()) {
    setCachedProfileAbout(userId, description);
  }
};
