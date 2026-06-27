import _sodium from 'libsodium-wrappers';
import { e2eApi } from './e2eApi';

const DEVICE_ID = 'web';
const LEGACY_DEVICE_IDS = ['default', 'android'];
const IDENTITY_STORAGE_PREFIX = 'whithin:e2e:identity:';
const CHAT_KEY_STORAGE_PREFIX = 'whithin:e2e:chat-key:';
const PEER_KEY_CACHE = new Map();
/** Users known to have no device key on the server (404). */
const PEER_KEY_MISSING = new Set();

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

  try {
    await e2eApi.uploadDeviceKey(identity.deviceId, identity.publicKeyBase64);
    identity.uploadedPublicKeyBase64 = identity.publicKeyBase64;
    saveIdentity(userId, identity);
    PEER_KEY_CACHE.set(String(userId), identity.publicKeyBase64);
  } catch (error) {
    if (strictUpload) {
      throw new E2eEncryptionError(
        'Не удалось загрузить ключ шифрования на сервер. Проверьте соединение и попробуйте снова.',
      );
    }
    console.warn('Failed to upload E2E public key:', error);
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

  const eligible = [];
  const ineligible = [];

  const resolved = await Promise.all(
    members.map(async (memberId) => {
      const publicKey = await getPeerPublicKey(memberId, userId, { fresh: strictAllMembers });
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

  if (strictAllMembers && ineligible.length > 0) {
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
    let publicKeyBase64;
    let deviceId = 'default';

    if (currentUserId && String(memberId) === String(currentUserId)) {
      const identity = loadIdentity(currentUserId) ?? await ensureE2eIdentity(currentUserId);
      publicKeyBase64 = identity?.publicKeyBase64 ?? null;
      deviceId = identity?.deviceId ?? DEVICE_ID;
    } else {
      const remote = await e2eApi.getDeviceKey(memberId);
      publicKeyBase64 = remote?.publicKeyBase64 ?? null;
      deviceId = remote?.deviceId ?? 'default';
    }

    if (!publicKeyBase64) {
      missingUserIds.push(String(memberId));
      continue;
    }

    const wrappedKeyBase64 = await sealChatKeyForUser(chatKeyBytes, publicKeyBase64);
    wraps.push({ userId: memberId, wrappedKeyBase64, deviceId });
  }

  if (strict && missingUserIds.length > 0) {
    throw new E2eEncryptionError(
      formatMissingKeysError(missingUserIds, currentUserId),
      missingUserIds,
    );
  }

  return { wraps, missingUserIds };
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
      const ownWrap = await e2eApi.getChatWrappedKey(chatId, ourDeviceId);
      if (!ownWrap?.wrappedKeyBase64) {
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
  ...LEGACY_DEVICE_IDS.filter((id) => id !== primaryDeviceId),
].filter((id, index, arr) => arr.indexOf(id) === index);

/** Upload chat-key wraps for our other registered devices (e.g. android) when this device holds the key. */
const syncAlternateSelfDeviceWraps = async (userId, chatId, chatKeyBase64) => {
  const identity = loadIdentity(userId) ?? await ensureE2eIdentity(userId);
  const ourPrimaryDeviceId = identity?.deviceId ?? DEVICE_ID;
  const sodium = await ensureSodium();
  const chatKeyBytes = sodium.from_base64(chatKeyBase64, sodium.base64_variants.ORIGINAL);
  const wraps = [];

  for (const deviceId of selfDeviceIds(ourPrimaryDeviceId)) {
    if (deviceId === ourPrimaryDeviceId) continue;

    const existing = await e2eApi.getChatWrappedKey(chatId, deviceId);
    if (existing?.wrappedKeyBase64) continue;

    const deviceKey = await e2eApi.getDeviceKey(userId, deviceId);
    if (!deviceKey?.publicKeyBase64) continue;

    const wrappedKeyBase64 = await sealChatKeyForUser(chatKeyBytes, deviceKey.publicKeyBase64);
    wraps.push({ userId, wrappedKeyBase64, deviceId });
  }

  if (!wraps.length) return;
  await e2eApi.uploadChatWrappedKeys(chatId, wraps);
};

const syncChatKeyWraps = async (
  userId,
  chatId,
  chatKeyBase64,
  eligibleMemberIds,
  { strictAllMembers = false } = {},
) => {
  if (!eligibleMemberIds.length) return;

  const { userIds: existingRecipients } = await e2eApi.getChatKeyRecipients(chatId);
  const missingWraps = await resolveMissingWrapMemberIds(
    userId,
    chatId,
    eligibleMemberIds,
    existingRecipients,
  );
  if (!missingWraps.length) return;

  const sodium = await ensureSodium();
  const chatKeyBytes = sodium.from_base64(chatKeyBase64, sodium.base64_variants.ORIGINAL);
  const { wraps } = await buildWrapsForMembers(
    chatKeyBytes,
    missingWraps,
    userId,
    { strict: strictAllMembers },
  );

  if (!wraps.length) {
    await syncAlternateSelfDeviceWraps(userId, chatId, chatKeyBase64);
    return;
  }

  await e2eApi.uploadChatWrappedKeys(chatId, wraps);
  await syncAlternateSelfDeviceWraps(userId, chatId, chatKeyBase64);
};

const tryOpenChatKeyFromServer = async (userId, chatId, primaryDeviceId) => {
  const deviceIds = [
    primaryDeviceId,
    ...LEGACY_DEVICE_IDS.filter((id) => id !== primaryDeviceId),
  ];

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
};

export const ensureChatKey = async (userId, chatId, memberUserIds = [], options = {}) => {
  const { forEncrypt = false, strictAllMembers = false } = options;

  if (!userId || !chatId) {
    throw new Error('Chat E2E requires userId and chatId');
  }

  const localKeyBase64 = loadLocalChatKey(chatId);

  if (forEncrypt && localKeyBase64 && !strictAllMembers) {
    await ensureE2eIdentity(userId, { strictUpload: true });
    const members = normalizeMemberIds(memberUserIds, userId);
    await syncChatKeyWraps(userId, chatId, localKeyBase64, members, { strictAllMembers });
    return localKeyBase64;
  }

  let audience = normalizeMemberIds(memberUserIds, userId);
  let eligible = audience;

  if (forEncrypt) {
    const resolved = await resolveEncryptAudience(userId, memberUserIds, { strictAllMembers });
    audience = resolved.audience;
    eligible = resolved.eligible;
  } else {
    await ensureE2eIdentity(userId);
  }

  if (localKeyBase64) {
    if (forEncrypt) {
      await syncChatKeyWraps(userId, chatId, localKeyBase64, eligible, { strictAllMembers });
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
    saveLocalChatKey(chatId, keyBase64FromServer);
    if (forEncrypt) {
      await syncChatKeyWraps(userId, chatId, keyBase64FromServer, eligible, { strictAllMembers });
    }
    return keyBase64FromServer;
  }

  const { userIds: existingRecipients } = await e2eApi.getChatKeyRecipients(chatId);
  if ((existingRecipients || []).length > 0) {
    const message = forEncrypt
      ? 'Не удалось отправить сообщение: у вас ещё нет ключа этого чата. Попросите любого участника, который уже писал здесь, отправить сообщение ещё раз.'
      : 'E2E-ключ чата ещё не выдан этому устройству.';
    throw new E2eEncryptionError(message);
  }

  if (!eligible.length) {
    throw new E2eEncryptionError('Не удалось определить участников с ключами шифрования.');
  }

  const sodium = await ensureSodium();
  const chatKeyBytes = sodium.randombytes_buf(32);
  const keyBase64 = sodium.to_base64(chatKeyBytes, sodium.base64_variants.ORIGINAL);
  const { wraps } = await buildWrapsForMembers(
    chatKeyBytes,
    eligible,
    userId,
    { strict: strictAllMembers },
  );

  if (!wraps.length) {
    throw new E2eEncryptionError(
      strictAllMembers
        ? formatMissingKeysError(audience.filter((id) => !eligible.includes(String(id))), userId)
        : 'Не удалось создать ключ шифрования для чата.',
    );
  }

  await e2eApi.uploadChatWrappedKeys(chatId, wraps);
  saveLocalChatKey(chatId, keyBase64);
  return keyBase64;
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

  const sodium = await ensureSodium();
  const chatKeyBase64 = await ensureChatKey(userId, chatId, memberUserIds, { forEncrypt: false });
  const chatKey = sodium.from_base64(chatKeyBase64, sodium.base64_variants.ORIGINAL);
  const nonce = sodium.from_base64(envelope.nonce, sodium.base64_variants.ORIGINAL);
  const ciphertext = sodium.from_base64(envelope.ciphertext, sodium.base64_variants.ORIGINAL);
  const plaintextBytes = sodium.crypto_secretbox_open_easy(ciphertext, nonce, chatKey);
  return sodium.to_string(plaintextBytes);
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
    console.warn('Chat-key E2E decrypt failed:', error);
  }

  try {
    const legacy = await decryptWithPairwiseKey(userId, peerUserId, content);
    if (legacy != null) {
      return legacy;
    }
  } catch (error) {
    console.warn('Legacy pairwise E2E decrypt failed:', error);
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
