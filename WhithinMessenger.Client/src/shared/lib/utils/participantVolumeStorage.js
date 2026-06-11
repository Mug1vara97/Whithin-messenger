const STORAGE_KEY = 'participantVolumeLevels';
const CHANGE_EVENT = 'participantVolumesChanged';

class ParticipantVolumeStorage {
  _readAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      console.warn('Failed to load participant volumes:', error);
      return {};
    }
  }

  _writeAll(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
      return true;
    } catch (error) {
      console.warn('Failed to save participant volumes:', error);
      return false;
    }
  }

  getVolume(userId) {
    const entry = this._readAll()[String(userId)];
    if (!entry || typeof entry.volume !== 'number') {
      return 100;
    }
    return Math.max(0, Math.min(100, Math.round(entry.volume)));
  }

  getVolumeEntry(userId) {
    return this._readAll()[String(userId)] || null;
  }

  getAllEntries() {
    const all = this._readAll();
    return Object.entries(all)
      .map(([userId, entry]) => ({
        userId,
        volume: typeof entry?.volume === 'number' ? Math.max(0, Math.min(100, Math.round(entry.volume))) : 100,
        userName: entry?.userName || null,
        updatedAt: entry?.updatedAt || 0,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  setVolume(userId, volume, userName) {
    const id = String(userId);
    const all = this._readAll();
    const prev = all[id] || {};
    all[id] = {
      volume: Math.max(0, Math.min(100, Math.round(volume))),
      userName: userName || prev.userName || null,
      updatedAt: Date.now(),
    };
    return this._writeAll(all);
  }

  remove(userId) {
    const all = this._readAll();
    delete all[String(userId)];
    return this._writeAll(all);
  }

  clearAll() {
    return this._writeAll({});
  }
}

export const participantVolumeStorage = new ParticipantVolumeStorage();
