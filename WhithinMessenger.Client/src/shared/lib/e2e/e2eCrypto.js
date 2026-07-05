import _sodium from 'libsodium-wrappers';
import { e2eApi, invalidateChatWrappedKeyCache } from './e2eApi';

const DEVICE_ID = 'web';
const IDENTITY_STORAGE_PREFIX = 'whithin:e2e:identity:';
const CHAT_KEY_STORAGE_PREFIX = 'whithin:e2e:chat-key:';
const PEER_KEY_CACHE = new Map();
/** Users known to have no device key on the server (404). */
const PEER_KEY_MISSING = new Set();
const ENSURE_CHAT_KEY_INFLIGHT = new Map();
const CHAT_KEYS_MARKED_UNAVAILABLE = new Set();
const E2E_LOG_ONCE_KEYS = new Set();
const CHAT_LEGACY_PROBE_ATTEMPTED = new Set();
const SELF_DEVICE_KEY_AVAILABILITY = new Map();
const CHAT_REWRAP_REQUESTED = new Set();

const CHAT_KEY_UNAVAILABLE_MESSAGE =
  'E2E-ключ чата ещё не выдан этому устройству. Откройте этот чат на другом устройстве, где переписка работает, отправьте любое сообщение и обновите страницу здесь.';

const e2eLog = (event, details = {}, level = 'log') => {
  const logger = console[level] ?? console.log;
  logger(`[E2E] ${event}`, details);
};

const e2eLogOnce = (key, event, details = {}, level = 'log') => {
  if (E2E_LOG_ONCE_KEYS.has(key)) return;
  E2E_LOG_ONCE_KEYS.add(key);
  e2eLog(event, details, level);
};

const requestChatRewrapIfNeeded = async (userId, chatId, deviceId) => {
  const chatKey = String(chatId);
  if (CHAT_REWRAP_REQUESTED.has(chatKey)) {
    return;
  }

  CHAT_REWRAP_REQUESTED.add(chatKey);
  try {
    await e2eApi.requestChatKeyRewrap(chatId, deviceId ?? DEVICE_ID);
    e2eLog('chat-key-rewrap-request-sent', {
      userId: String(userId),
      chatId: chatKey,
      deviceId: deviceId ?? DEVICE_ID,
    });
  } catch (error) {
    e2eLog('chat-key-rewrap-request-failed', {
      userId: String(userId),
      chatId: chatKey,
      deviceId: deviceId ?? DEVICE_ID,
      errorMessage: error?.message ?? String(error),
      httpStatus: error?.response?.status ?? null,
    }, 'warn');
  }
};

export const clearChatKeyUnavailableState = (chatId) => {
  if (!chatId) return;
  const chatKey = String(chatId);
  CHAT_KEYS_MARKED_UNAVAILABLE.delete(chatKey);
  CHAT_LEGACY_PROBE_ATTEMPTED.delete(chatKey);
  CHAT_REWRAP_REQUESTED.delete(chatKey);
  E2E_LOG_ONCE_KEYS.delete(`missing:${chatKey}`);
  E2E_LOG_ONCE_KEYS.delete(`marked:${chatKey}`);
  invalidateChatWrappedKeyCache(chatId);
};

const markChatKeyUnavailable = (chatId) => {
  if (!chatId) return;
  const chatKey = String(chatId);
  CHAT_KEYS_MARKED_UNAVAILABLE.add(chatKey);
  e2eLogOnce(`marked:${chatKey}`, 'chat-key-marked-unavailable', { chatId: chatKey }, 'warn');
};

const isChatKeyUnavailableError = (error) => (
  error instanceof E2eEncryptionError
  && String(error.message).includes('ещё не выдан этому устройству')
);

const isWrongSecretKeyError = (error) => (
  String(error?.message ?? '').toLowerCase().includes('wrong secret key')
);

let sodiumReadyPromise = null;

export class E2eEncryptionError extends Error {
  constructor(message, missingUserIds = []) {
    super(message);
    this.name = 'E2eEncryptionError';
    this.missingUserIds = missingUserIds;
  }
}

const ensureSodium = async () => {
  if (!sodiumReadyPromise) {
    sodiumReadyPromise = _sodium.ready.then(() => _sodium);
  }
  return sodiumReadyPromise;
};

const identityStorageKey = (userId) => `${IDENTITY_STORAGE_PREFIX}${userId}`;
const chatKeyStorageKey = (chatId) => `${CHAT_KEY_STORAGE_PREFIX}${chatId}`;

const loadIdentity = (userId) => {
  try {
    const raw = localStorage.getItem(identityStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.publicKeyBase64 || !parsed?.secretKeyBase64) return null;
    return {
      deviceId: parsed.deviceId ?? DEVICE_ID,
      publicKeyBase64: parsed.publicKeyBase64,
      secretKeyBase64: parsed.secretKeyBase64,
      uploadedPublicKeyBase64: parsed.uploadedPublicKeyBase64 ?? null,
    };
  } catch {
    return null;
  }
};

const saveIdentity = (userId, identity) => {
  localStorage.setItem(identityStorageKey(userId), JSON.stringify({
    deviceId: identity.deviceId ?? DEVICE_ID,
    publicKeyBase64: identity.publicKeyBase64,
    secretKeyBase64: identity.secretKeyBase64,
    uploadedPublicKeyBase64: identity.uploadedPublicKeyBase64 ?? null,
  }));
};

const loadLocalChatKey = (chatId) => {
  try {
    const raw = localStorage.getItem(chatKeyStorageKey(chatId));
    if (!raw) return null;
    return raw;
  } catch {
    return null;
  }
};

const saveLocalChatKey = (chatId, keyBase64) => {
  localStorage.setItem(chatKeyStorageKey(chatId), keyBase64);
  clearChatKeyUnavailableState(chatId);
};

const normalizeMemberIds = (memberUserIds, userId) => {
  const ids = new Set();
  (memberUserIds || []).forEach((id) => {
    if (id != null && String(id).trim()) {
      ids.add(String(id));
    }
  });
  if (userId != null) {
    ids.add(String(userId));
  }
  return Array.from(ids);
};

const formatMissingKeysError = (missingUserIds, currentUserId) => {
  const others = missingUserIds.filter((id) => id !== String(currentUserId));
  if (others.length === 0) {
    return 'Не удалось настроить шифрование на этом устройстве. Проверьте соединение и попробуйте снова.';
  }
  if (others.length === 1) {
    return 'Не удалось отправить сообщение: у собеседника нет ключа шифрования. Вероятно, он давно не заходил в приложение — попросите его войти в Whithin.';
  }
  return `Не удалось отправить сообщение: у ${others.length} участников нет ключей шифрования (давно не заходили в приложение).`;
};

const parseEnvelope = (content) => {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    const nonce = parsed.n ?? parsed.N;
    const ciphertext = parsed.c ?? parsed.C;
    if (!nonce || !ciphertext) return null;
    return { nonce, ciphertext };
  } catch {
    return null;
  }
};

const buildEnvelope = (nonceBase64, ciphertextBase64) => JSON.stringify({
  n: nonceBase64,
  c: ciphertextBase64,
});

const derivePairwiseKey = async (secretKeyBytes, peerPublicKeyBytes) => {
  const sodium = await ensureSodium();
  const shared = sodium.crypto_scalarmult(secretKeyBytes, peerPublicKeyBytes);
  return sodium.crypto_generichash(32, shared);
};

export const E2E_ENCRYPTION_VERSION = 1;
export const E2E_DECRYPT_FAILED_TEXT = 'Не удалось расшифровать сообщение';
export const E2E_PEER_KEY_MISSING_TEXT =
  'Собеседник ещё не настроил шифрование. Попросите его войти в мессенджер.';

export const ensureE2eIdentity = async (userId, options = {}) => {
  const { strictUpload = false } = options;
  if (!userId) return null;

  const sodium = await ensureSodium();
  let identity = loadIdentity(userId);

  if (!identity) {
    const keypair = sodium.crypto_box_keypair();
    identity = {
      deviceId: DEVICE_ID,
      publicKeyBase64: sodium.to_base64(keypair.publicKey, sodium.base64_variants.ORIGINAL),
      secretKeyBase64: sodium.to_base64(keypair.privateKey, sodium.base64_variants.ORIGINAL),
    };
    saveIdentity(userId, identity);
  } else if (identity.deviceId === 'default') {
    identity = { ...identity, deviceId: DEVICE_ID };
    saveIdentity(userId, identity);
  }

  const shouldUpload = strictUpload || identity.uploadedPublicKeyBase64 !== identity.publicKeyBase64;
  if (shouldUpload) {
    try {
      await e2eApi.uploadDeviceKey(identity.deviceId, identity.publicKeyBase64);
      SELF_DEVICE_KEY_AVAILABILITY.set(identity.deviceId ?? DEVICE_ID, true);
      identity.uploadedPublicKeyBase64 = identity.publicKeyBase64;
      saveIdentity(userId, identity);
      PEER_KEY_CACHE.set(String(userId), identity.publicKeyBase64);
    } catch (error) {
      if (strictUpload) {
        throw new E2eEncryptionError(
          'Не удалось загрузить ключ шифрования на сервер. Проверьте соединение и попробуйте снова.',
        );
      }
      e2eLog('device-key-upload-failed', {
        userId: String(userId),
        deviceId: identity?.deviceId ?? DEVICE_ID,
        errorMessage: error?.message ?? String(error),
        httpStatus: error?.response?.status ?? null,
      }, 'warn');
    }
  } else {
    SELF_DEVICE_KEY_AVAILABILITY.set(identity.deviceId ?? DEVICE_ID, true);
    PEER_KEY_CACHE.set(String(userId), identity.publicKeyBase64);
  }

  return identity;
};

export const getPeerPublicKey = async (peerUserId, currentUserId = null, options = {}) => {
  const { fresh = false } = options;
  const cacheKey = String(peerUserId);

  if (!cacheKey) return null;

  if (!fresh && PEER_KEY_MISSING.has(cacheKey)) {
    return null;
  }

  if (!fresh && PEER_KEY_CACHE.has(cacheKey)) {
    return PEER_KEY_CACHE.get(cacheKey);
  }

  if (currentUserId && cacheKey === String(currentUserId)) {
    const identity = loadIdentity(currentUserId) ?? await ensureE2eIdentity(currentUserId);
    if (identity?.publicKeyBase64) {
      PEER_KEY_CACHE.set(cacheKey, identity.publicKeyBase64);
      PEER_KEY_MISSING.delete(cacheKey);
      return identity.publicKeyBase64;
    }
    return null;
  }

  const remote = await e2eApi.getDeviceKey(peerUserId);
  if (!remote?.publicKeyBase64) {
    PEER_KEY_CACHE.delete(cacheKey);
    PEER_KEY_MISSING.add(cacheKey);
    return null;
  }

  PEER_KEY_CACHE.set(cacheKey, remote.publicKeyBase64);
  PEER_KEY_MISSING.delete(cacheKey);
  return remote.publicKeyBase64;
};

export const resolveEncryptAudience = async (userId, memberUserIds, options = {}) => {
  const { strictAllMembers = false } = options;
  const members = normalizeMemberIds(memberUserIds, userId);
  if (!members.length) {
    throw new E2eEncryptionError('Не удалось определить участников чата для шифрования.');
  }

  await ensureE2eIdentity(userId, { strictUpload: true });

  // Legacy strict mode: verify every member has a device key before sending.
  if (!strictAllMembers) {
    return { audience: members, eligible: [String(userId)], ineligible: [] };
  }

  const eligible = [];
  const ineligible = [];

  const resolved = await Promise.all(
    members.map(async (memberId) => {
      const publicKey = await getPeerPublicKey(memberId, userId, { fresh: true });
      return { memberId: String(memberId), publicKey };
    }),
  );

  for (const { memberId, publicKey } of resolved) {
    if (publicKey) {
      eligible.push(memberId);
    } else {
      ineligible.push(memberId);
    }
  }

  if (!eligible.includes(String(userId))) {
    throw new E2eEncryptionError(
      'Не удалось настроить шифрование на этом устройстве. Проверьте соединение и попробуйте снова.',
    );
  }

  if (ineligible.length > 0) {
    throw new E2eEncryptionError(
      formatMissingKeysError(ineligible, userId),
      ineligible,
    );
  }

  return { audience: members, eligible, ineligible };
};

/** @deprecated Use resolveEncryptAudience */
export const assertAllMembersHaveDeviceKeys = async (userId, memberUserIds) => {
  const { audience } = await resolveEncryptAudience(userId, memberUserIds, { strictAllMembers: true });
  return audience;
};

const sealChatKeyForUser = async (chatKeyBytes, targetPublicKeyBase64) => {
  const sodium = await ensureSodium();
  const publicKey = sodium.from_base64(targetPublicKeyBase64, sodium.base64_variants.ORIGINAL);
  const sealed = sodium.crypto_box_seal(chatKeyBytes, publicKey);
  return sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL);
};

const openSealedChatKey = async (userId, wrappedKeyBase64) => {
  const sodium = await ensureSodium();
  const identity = loadIdentity(userId) ?? await ensureE2eIdentity(userId);
  if (!identity) {
    throw new Error('E2E identity is not initialized');
  }

  const publicKey = sodium.from_base64(identity.publicKeyBase64, sodium.base64_variants.ORIGINAL);
  const secretKey = sodium.from_base64(identity.secretKeyBase64, sodium.base64_variants.ORIGINAL);
  const sealed = sodium.from_base64(wrappedKeyBase64, sodium.base64_variants.ORIGINAL);
  return sodium.crypto_box_seal_open(sealed, publicKey, secretKey);
};

const buildWrapsForMembers = async (chatKeyBytes, memberIds, currentUserId, { strict = false } = {}) => {
  const wraps = [];
  const missingUserIds = [];

  for (const memberId of memberIds) {
    const trimmedMemberId = String(memberId ?? '').trim();
    if (!trimmedMemberId) continue;

    const deviceKeys = await resolveMemberDeviceKeys(trimmedMemberId, currentUserId);
    if (!deviceKeys.length) {
      missingUserIds.push(trimmedMemberId);
      continue;
    }

    for (const { deviceId, publicKeyBase64 } of deviceKeys) {
      const wrappedKeyBase64 = await sealChatKeyForUser(chatKeyBytes, publicKeyBase64);
      wraps.push({ userId: trimmedMemberId, wrappedKeyBase64, deviceId });
    }
  }

  if (strict && missingUserIds.length > 0) {
    throw new E2eEncryptionError(
      formatMissingKeysError(missingUserIds, currentUserId),
      missingUserIds,
    );
  }

  return { wraps, missingUserIds };
};

const resolveMemberDeviceKeys = async (memberId, currentUserId) => {
  if (currentUserId && String(memberId) === String(currentUserId)) {
    const identity = loadIdentity(currentUserId) ?? await ensureE2eIdentity(currentUserId);
    const deviceId = identity?.deviceId ?? DEVICE_ID;
    const publicKeyBase64 = identity?.publicKeyBase64 ?? null;
    return publicKeyBase64 ? [{ deviceId, publicKeyBase64 }] : [];
  }

  const byDeviceId = new Map();

  const primary = await e2eApi.getDeviceKey(memberId);
  if (primary?.publicKeyBase64) {
    byDeviceId.set(primary.deviceId ?? 'default', primary.publicKeyBase64);
  }

  return [...byDeviceId.entries()].map(([deviceId, publicKeyBase64]) => ({
    deviceId,
    publicKeyBase64,
  }));
};

const resolveMissingWrapMemberIds = async (
  userId,
  chatId,
  eligibleMemberIds,
  existingRecipientUserIds,
) => {
  const identity = loadIdentity(userId) ?? await ensureE2eIdentity(userId);
  const ourDeviceId = identity?.deviceId ?? DEVICE_ID;
  const existingSet = new Set((existingRecipientUserIds || []).map((id) => String(id)));
  const missing = [];

  for (const memberId of eligibleMemberIds) {
    const memberKey = String(memberId);
    if (memberKey === String(userId)) {
      const readable = await ownWrapIsReadable(userId, chatId, ourDeviceId);
      if (!readable) {
        missing.push(memberId);
      }
    } else if (!existingSet.has(memberKey)) {
      missing.push(memberId);
    }
  }

  return missing;
};

const selfDeviceIds = (primaryDeviceId) => [
  primaryDeviceId,
].filter((id, index, arr) => arr.indexOf(id) === index);

/** Re-upload own wrap when the server has a stale wrap for the current device key. */
const refreshOwnUnreadableDeviceWrap = async (userId, chatId, chatKeyBase64) => {
  const identity = loadIdentity(userId) ?? await ensureE2eIdentity(userId);
  if (!identity?.publicKeyBase64) return;

  const deviceId = identity.deviceId ?? DEVICE_ID;
  if (await ownWrapIsReadable(userId, chatId, deviceId)) return;

  const sodium = await ensureSodium();
  const chatKeyBytes = sodium.from_base64(chatKeyBase64, sodium.base64_variants.ORIGINAL);
  const wrappedKeyBase64 = await sealChatKeyForUser(chatKeyBytes, identity.publicKeyBase64);
  await e2eApi.uploadChatWrappedKeys(chatId, [{ userId, wrappedKeyBase64, deviceId }]);
};

/** Re-seal chat key for this deviceId when another browser registered the same deviceId. */
const refreshOwnDeviceWrapForCurrentServerKey = async (userId, chatId, chatKeyBase64) => {
  const identity = loadIdentity(userId);
  if (!identity?.publicKeyBase64) return;

  const deviceId = identity.deviceId ?? DEVICE_ID;
  const remoteKey = await e2eApi.getDeviceKey(userId, deviceId);
  if (!remoteKey?.publicKeyBase64) return;
  if (remoteKey.publicKeyBase64 === identity.publicKeyBase64) return;

  const sodium = await ensureSodium();
  const chatKeyBytes = sodium.from_base64(chatKeyBase64, sodium.base64_variants.ORIGINAL);
  const wrappedKeyBase64 = await sealChatKeyForUser(chatKeyBytes, remoteKey.publicKeyBase64);
  await e2eApi.uploadChatWrappedKeys(chatId, [{ userId, wrappedKeyBase64, deviceId }]);
};

const ownWrapIsReadable = async (userId, chatId, deviceId) => {
  const ownWrap = await e2eApi.getChatWrappedKey(chatId, deviceId);
  if (!ownWrap?.wrappedKeyBase64) return false;
  try {
    await openSealedChatKey(userId, ownWrap.wrappedKeyBase64);
    return true;
  } catch {
    return false;
  }
};

/** Upload chat-key wraps for our other registered devices (e.g. android) when this device holds the key. */
const syncAlternateSelfDeviceWraps = async (userId, chatId, chatKeyBase64) => {
  const identity = loadIdentity(userId) ?? await ensureE2eIdentity(userId);
  const ourPrimaryDeviceId = identity?.deviceId ?? DEVICE_ID;
  const sodium = await ensureSodium();
  const chatKeyBytes = sodium.from_base64(chatKeyBase64, sodium.base64_variants.ORIGINAL);
  const wraps = [];

  for (const deviceId of selfDeviceIds(ourPrimaryDeviceId)) {
    if (deviceId === ourPrimaryDeviceId) continue;
    if (SELF_DEVICE_KEY_AVAILABILITY.get(deviceId) === false) continue;

    const existing = await e2eApi.getChatWrappedKey(chatId, deviceId);
    if (existing?.wrappedKeyBase64) continue;

    const deviceKey = await e2eApi.getDeviceKey(userId, deviceId);
    if (!deviceKey?.publicKeyBase64) {
      SELF_DEVICE_KEY_AVAILABILITY.set(deviceId, false);
      continue;
    }
    SELF_DEVICE_KEY_AVAILABILITY.set(deviceId, true);

    const wrappedKeyBase64 = await sealChatKeyForUser(chatKeyBytes, deviceKey.publicKeyBase64);
    wraps.push({ userId, wrappedKeyBase64, deviceId });
  }

  if (!wraps.length) return;
  await e2eApi.uploadChatWrappedKeys(chatId, wraps);
  await refreshOwnDeviceWrapForCurrentServerKey(userId, chatId, chatKeyBase64);
};

const syncChatKeyWraps = async (
  userId,
  chatId,
  chatKeyBase64,
  eligibleMemberIds,
  { strictAllMembers = false } = {},
) => {
  if (!eligibleMemberIds.length) return;

  await refreshOwnUnreadableDeviceWrap(userId, chatId, chatKeyBase64);

  const sodium = await ensureSodium();
  const chatKeyBytes = sodium.from_base64(chatKeyBase64, sodium.base64_variants.ORIGINAL);
  const { wraps } = await buildWrapsForMembers(
    chatKeyBytes,
    eligibleMemberIds,
    userId,
    { strict: strictAllMembers },
  );

  if (wraps.length) {
    await e2eApi.uploadChatWrappedKeys(chatId, wraps);
  }

  await syncAlternateSelfDeviceWraps(userId, chatId, chatKeyBase64);
};

const tryOpenChatKeyFromServer = async (userId, chatId, primaryDeviceId) => {
  const chatKey = String(chatId);
  const deviceIds = [primaryDeviceId];
  CHAT_LEGACY_PROBE_ATTEMPTED.add(chatKey);

  for (const deviceId of deviceIds) {
    const remote = await e2eApi.getChatWrappedKey(chatId, deviceId);
    if (!remote?.wrappedKeyBase64) continue;

    try {
      const chatKeyBytes = await openSealedChatKey(userId, remote.wrappedKeyBase64);
      const sodium = await ensureSodium();
      return sodium.to_base64(chatKeyBytes, sodium.base64_variants.ORIGINAL);
    } catch {
      // Same userId but different keypair (another device) — try next legacy id.
    }
  }

  return null;
};

/** When this device already holds the chat key, upload missing wraps (e.g. android) for other devices. */
export const proactiveSyncChatDeviceWraps = async (userId, chatId, memberUserIds = []) => {
  if (!userId || !chatId) return;

  const localKeyBase64 = loadLocalChatKey(chatId);
  if (!localKeyBase64) return;

  await ensureE2eIdentity(userId, { strictUpload: true });
  const members = normalizeMemberIds(memberUserIds, userId);
  await syncChatKeyWraps(userId, chatId, localKeyBase64, members, { strictAllMembers: false });
  await refreshOwnUnreadableDeviceWrap(userId, chatId, localKeyBase64);
  await refreshOwnDeviceWrapForCurrentServerKey(userId, chatId, localKeyBase64);
};

const ensureChatKeyImpl = async (userId, chatId, memberUserIds = [], options = {}) => {
  const { forEncrypt = false, strictAllMembers = false } = options;

  if (!userId || !chatId) {
    throw new Error('Chat E2E requires userId and chatId');
  }

  const members = normalizeMemberIds(memberUserIds, userId);
  const scheduleWrapSync = (chatKeyBase64, targetMemberIds) => {
    if (!targetMemberIds.length) return;
    void syncChatKeyWraps(userId, chatId, chatKeyBase64, targetMemberIds, { strictAllMembers: false })
      .then(() => refreshOwnDeviceWrapForCurrentServerKey(userId, chatId, chatKeyBase64))
      .catch((error) => {
        e2eLog('wrap-sync-best-effort-failed', {
          userId: String(userId),
          chatId: String(chatId),
          targetMemberIds,
          errorMessage: error?.message ?? String(error),
          httpStatus: error?.response?.status ?? null,
        }, 'warn');
      });
  };

  const localKeyBase64 = loadLocalChatKey(chatId);

  // Send path: only the sender must have keys; peer wraps are best-effort in the background.
  if (forEncrypt && localKeyBase64 && !strictAllMembers) {
    await ensureE2eIdentity(userId, { strictUpload: true });
    scheduleWrapSync(localKeyBase64, members);
    return localKeyBase64;
  }

  let audience = members;
  let eligible = members;

  if (forEncrypt && strictAllMembers) {
    const resolved = await resolveEncryptAudience(userId, memberUserIds, { strictAllMembers: true });
    audience = resolved.audience;
    eligible = resolved.eligible;
  } else if (forEncrypt) {
    await ensureE2eIdentity(userId, { strictUpload: true });
    eligible = [String(userId)];
  } else {
    await ensureE2eIdentity(userId);
  }

  if (localKeyBase64) {
    if (forEncrypt && strictAllMembers) {
      await syncChatKeyWraps(userId, chatId, localKeyBase64, eligible, { strictAllMembers: true });
    } else if (forEncrypt) {
      scheduleWrapSync(localKeyBase64, members);
    }
    return localKeyBase64;
  }

  const identity = loadIdentity(userId) ?? await ensureE2eIdentity(userId);
  const keyBase64FromServer = await tryOpenChatKeyFromServer(
    userId,
    chatId,
    identity?.deviceId ?? DEVICE_ID,
  );
  if (keyBase64FromServer) {
    e2eLog('chat-key-restored-from-server-wrap', {
      userId: String(userId),
      chatId: String(chatId),
      deviceId: identity?.deviceId ?? DEVICE_ID,
      forEncrypt,
    });
    saveLocalChatKey(chatId, keyBase64FromServer);
    if (forEncrypt && strictAllMembers) {
      await syncChatKeyWraps(userId, chatId, keyBase64FromServer, eligible, { strictAllMembers: true });
    } else if (forEncrypt) {
      scheduleWrapSync(keyBase64FromServer, members);
    }
    return keyBase64FromServer;
  }

  const { userIds: existingRecipients } = await e2eApi.getChatKeyRecipients(chatId);
  if ((existingRecipients || []).length > 0) {
    await requestChatRewrapIfNeeded(userId, chatId, identity?.deviceId ?? DEVICE_ID);
    e2eLog('chat-key-missing-for-current-device', {
      userId: String(userId),
      chatId: String(chatId),
      forEncrypt,
      recipientsWithWraps: existingRecipients.map((id) => String(id)),
      requestedMembers: members.map((id) => String(id)),
      localDeviceId: identity?.deviceId ?? DEVICE_ID,
    }, 'warn');
    const message = forEncrypt
      ? 'Не удалось отправить сообщение: у вас ещё нет ключа этого чата. Откройте чат на устройстве, где переписка уже работает, и отправьте любое сообщение — затем обновите страницу здесь.'
      : CHAT_KEY_UNAVAILABLE_MESSAGE;
    throw new E2eEncryptionError(message);
  }

  // Decrypt path: never bootstrap a brand-new chat key.
  // If we cannot restore a server wrap, creating a new key would make all historical
  // ciphertext undecryptable on this device ("wrong secret key for the given ciphertext").
  if (!forEncrypt) {
    await requestChatRewrapIfNeeded(userId, chatId, identity?.deviceId ?? DEVICE_ID);
    e2eLog('chat-key-decrypt-no-server-wrap', {
      userId: String(userId),
      chatId: String(chatId),
      recipientsWithWraps: (existingRecipients || []).map((id) => String(id)),
      requestedMembers: members.map((id) => String(id)),
      localDeviceId: identity?.deviceId ?? DEVICE_ID,
    }, 'warn');
    throw new E2eEncryptionError(CHAT_KEY_UNAVAILABLE_MESSAGE);
  }

  const wrapTargets = forEncrypt && !strictAllMembers ? [String(userId)] : eligible;

  if (!wrapTargets.length) {
    throw new E2eEncryptionError(
      'Не удалось настроить шифрование на этом устройстве. Проверьте соединение и попробуйте снова.',
    );
  }

  const sodium = await ensureSodium();
  const chatKeyBytes = sodium.randombytes_buf(32);
  const keyBase64 = sodium.to_base64(chatKeyBytes, sodium.base64_variants.ORIGINAL);
  const { wraps } = await buildWrapsForMembers(
    chatKeyBytes,
    wrapTargets,
    userId,
    { strict: strictAllMembers },
  );

  if (!wraps.length) {
    e2eLog('chat-key-bootstrap-no-wrap-targets', {
      userId: String(userId),
      chatId: String(chatId),
      forEncrypt,
      strictAllMembers,
      audience: audience.map((id) => String(id)),
      eligible: eligible.map((id) => String(id)),
      wrapTargets: wrapTargets.map((id) => String(id)),
    }, 'warn');
    throw new E2eEncryptionError(
      strictAllMembers
        ? formatMissingKeysError(audience.filter((id) => !eligible.includes(String(id))), userId)
        : 'Не удалось настроить шифрование на этом устройстве. Проверьте соединение и попробуйте снова.',
    );
  }

  await e2eApi.uploadChatWrappedKeys(chatId, wraps);
  saveLocalChatKey(chatId, keyBase64);

  if (forEncrypt && !strictAllMembers) {
    scheduleWrapSync(keyBase64, members);
  }

  return keyBase64;
};

export const ensureChatKey = async (userId, chatId, memberUserIds = [], options = {}) => {
  if (!userId || !chatId) {
    throw new Error('Chat E2E requires userId and chatId');
  }

  const chatKey = String(chatId);
  if (CHAT_KEYS_MARKED_UNAVAILABLE.has(chatKey) && !loadLocalChatKey(chatId)) {
    const identity = loadIdentity(userId);
    await requestChatRewrapIfNeeded(userId, chatId, identity?.deviceId ?? DEVICE_ID);
    e2eLogOnce(`missing:${chatKey}`, 'chat-key-short-circuit-missing', {
      userId: String(userId),
      chatId: String(chatId),
      memberCount: Array.isArray(memberUserIds) ? memberUserIds.length : 0,
      forEncrypt: Boolean(options?.forEncrypt),
    }, 'warn');
    throw new E2eEncryptionError(CHAT_KEY_UNAVAILABLE_MESSAGE);
  }

  const inFlight = ENSURE_CHAT_KEY_INFLIGHT.get(chatKey);
  if (inFlight) {
    return inFlight;
  }

  const promise = ensureChatKeyImpl(userId, chatId, memberUserIds, options)
    .catch((error) => {
      if (isChatKeyUnavailableError(error)) {
        markChatKeyUnavailable(chatId);
      }
      throw error;
    })
    .finally(() => {
      ENSURE_CHAT_KEY_INFLIGHT.delete(chatKey);
    });

  ENSURE_CHAT_KEY_INFLIGHT.set(chatKey, promise);
  return promise;
};

export const encryptChatMessage = async (userId, chatId, memberUserIds, plaintext, options = {}) => {
  const { strictAllMembers = false } = options;
  const sodium = await ensureSodium();
  const chatKeyBase64 = await ensureChatKey(userId, chatId, memberUserIds, {
    forEncrypt: true,
    strictAllMembers,
  });
  const chatKey = sodium.from_base64(chatKeyBase64, sodium.base64_variants.ORIGINAL);

  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = sodium.crypto_secretbox_easy(
    sodium.from_string(plaintext),
    nonce,
    chatKey,
  );

  return {
    content: buildEnvelope(
      sodium.to_base64(nonce, sodium.base64_variants.ORIGINAL),
      sodium.to_base64(ciphertext, sodium.base64_variants.ORIGINAL),
    ),
    encryptionVersion: E2E_ENCRYPTION_VERSION,
  };
};

const decryptWithChatKey = async (userId, chatId, memberUserIds, content) => {
  const envelope = parseEnvelope(content);
  if (!envelope) return null;

  const decryptEnvelope = async (chatKeyBase64) => {
    const sodium = await ensureSodium();
    const chatKey = sodium.from_base64(chatKeyBase64, sodium.base64_variants.ORIGINAL);
    const nonce = sodium.from_base64(envelope.nonce, sodium.base64_variants.ORIGINAL);
    const ciphertext = sodium.from_base64(envelope.ciphertext, sodium.base64_variants.ORIGINAL);
    const plaintextBytes = sodium.crypto_secretbox_open_easy(ciphertext, nonce, chatKey);
    return sodium.to_string(plaintextBytes);
  };

  try {
    const chatKeyBase64 = await ensureChatKey(userId, chatId, memberUserIds, { forEncrypt: false });
    return await decryptEnvelope(chatKeyBase64);
  } catch (error) {
    if (isWrongSecretKeyError(error)) {
      removeLocalChatKey(chatId);
      clearChatKeyUnavailableState(chatId);
      try {
        const refreshedChatKeyBase64 = await ensureChatKey(userId, chatId, memberUserIds, { forEncrypt: false });
        return await decryptEnvelope(refreshedChatKeyBase64);
      } catch (retryError) {
        if (retryError instanceof E2eEncryptionError) {
          return null;
        }
        throw retryError;
      }
    }

    if (error instanceof E2eEncryptionError) {
      return null;
    }
    throw error;
  }
};

const decryptWithPairwiseKey = async (userId, peerUserId, content) => {
  const envelope = parseEnvelope(content);
  if (!envelope || !peerUserId) return null;

  const sodium = await ensureSodium();
  const identity = loadIdentity(userId) ?? await ensureE2eIdentity(userId);
  if (!identity) return null;

  const peerPublicKeyBase64 = await getPeerPublicKey(peerUserId, userId);
  if (!peerPublicKeyBase64) return null;
  const secretKey = sodium.from_base64(identity.secretKeyBase64, sodium.base64_variants.ORIGINAL);
  const peerPublicKey = sodium.from_base64(peerPublicKeyBase64, sodium.base64_variants.ORIGINAL);
  const symmetricKey = await derivePairwiseKey(secretKey, peerPublicKey);
  const nonce = sodium.from_base64(envelope.nonce, sodium.base64_variants.ORIGINAL);
  const ciphertext = sodium.from_base64(envelope.ciphertext, sodium.base64_variants.ORIGINAL);
  const plaintextBytes = sodium.crypto_secretbox_open_easy(ciphertext, nonce, symmetricKey);
  return sodium.to_string(plaintextBytes);
};

export const decryptChatMessage = async (
  userId,
  chatId,
  memberUserIds,
  content,
  encryptionVersion,
  peerUserId = null,
) => {
  if (!encryptionVersion || encryptionVersion <= 0) {
    return content;
  }

  try {
    const decrypted = await decryptWithChatKey(userId, chatId, memberUserIds, content);
    if (decrypted != null) {
      return decrypted;
    }
  } catch (error) {
    if (!(error instanceof E2eEncryptionError)) {
      e2eLog('chat-key-decrypt-runtime-failed', {
        userId: String(userId),
        chatId: String(chatId),
        encryptionVersion: Number(encryptionVersion || 0),
        peerUserId: peerUserId ? String(peerUserId) : null,
        errorMessage: error?.message ?? String(error),
      }, 'warn');
    }
  }

  try {
    const legacy = await decryptWithPairwiseKey(userId, peerUserId, content);
    if (legacy != null) {
      return legacy;
    }
  } catch (error) {
    e2eLog('legacy-pairwise-decrypt-failed', {
      userId: String(userId),
      chatId: String(chatId),
      peerUserId: peerUserId ? String(peerUserId) : null,
      encryptionVersion: Number(encryptionVersion || 0),
      errorMessage: error?.message ?? String(error),
    }, 'warn');
  }

  return E2E_DECRYPT_FAILED_TEXT;
};

/** @deprecated Use encryptChatMessage */
export const encryptDmMessage = async (userId, peerUserId, plaintext) => {
  return encryptChatMessage(userId, `dm:${peerUserId}`, [peerUserId, userId], plaintext);
};

/** @deprecated Use decryptChatMessage */
export const decryptDmMessage = async (userId, peerUserId, content, encryptionVersion) => {
  return decryptChatMessage(
    userId,
    `dm:${peerUserId}`,
    [peerUserId, userId],
    content,
    encryptionVersion,
    peerUserId,
  );
};

export const clearE2ePeerKeyCache = () => {
  PEER_KEY_CACHE.clear();
  PEER_KEY_MISSING.clear();
};
