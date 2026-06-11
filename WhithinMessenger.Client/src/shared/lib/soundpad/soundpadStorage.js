const DB_NAME = 'whithin-soundpad';
const DB_VERSION = 1;
const SOUNDS_STORE = 'sounds';
const CONFIG_KEY = 'whithinSoundpadConfig';

const defaultConfig = () => ({
  slots: [],
  globalVolume: 1,
  /** Hear soundpad in your headphones/speakers (separate from mic/CABLE level). */
  monitorEnabled: true,
  monitorVolume: 1,
  showPanel: true,
});

const openDb = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SOUNDS_STORE)) {
        db.createObjectStore(SOUNDS_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const readConfig = () => {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return defaultConfig();
    return { ...defaultConfig(), ...JSON.parse(raw) };
  } catch {
    return defaultConfig();
  }
};

const writeConfig = (config) => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent('soundpadConfigChanged', { detail: config }));
};

const createId = () => `slot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const soundpadStorage = {
  getConfig() {
    return readConfig();
  },

  saveConfig(patch) {
    const next = { ...readConfig(), ...patch };
    writeConfig(next);
    return next;
  },

  async saveSoundFile(file) {
    const id = createId();
    const buffer = await file.arrayBuffer();
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SOUNDS_STORE, 'readwrite');
      tx.objectStore(SOUNDS_STORE).put({
        id,
        name: file.name,
        mimeType: file.type || 'audio/mpeg',
        data: buffer,
        createdAt: Date.now(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return id;
  },

  async getSoundBlob(soundId) {
    const db = await openDb();
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction(SOUNDS_STORE, 'readonly');
      const request = tx.objectStore(SOUNDS_STORE).get(soundId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (!record?.data) return null;
    return new Blob([record.data], { type: record.mimeType || 'audio/mpeg' });
  },

  async deleteSound(soundId) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SOUNDS_STORE, 'readwrite');
      tx.objectStore(SOUNDS_STORE).delete(soundId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  },

  addSlot({ label, soundId, volume = 1, hotkey = '' }) {
    const config = readConfig();
    const slot = {
      id: createId(),
      label: label || 'Звук',
      soundId,
      volume,
      hotkey,
    };
    config.slots = [...config.slots, slot];
    writeConfig(config);
    return slot;
  },

  updateSlot(slotId, patch) {
    const config = readConfig();
    config.slots = config.slots.map((slot) =>
      slot.id === slotId ? { ...slot, ...patch } : slot
    );
    writeConfig(config);
    return config;
  },

  removeSlot(slotId) {
    const config = readConfig();
    const removed = config.slots.find((slot) => slot.id === slotId);
    config.slots = config.slots.filter((slot) => slot.id !== slotId);
    writeConfig(config);
    return removed;
  },
};
