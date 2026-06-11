import React, { useEffect, useState } from 'react';
import { soundpadBridge } from '../../../lib/soundpad/soundpadBridge';
import { soundpadStorage } from '../../../lib/soundpad/soundpadStorage';
import { findHotkeyConflict } from '../../../lib/soundpad/soundpadHotkeys';
import hotkeyStorage from '../../../lib/utils/hotkeyStorage';
import { soundpadError } from '../../../lib/soundpad/soundpadLogger';
import '../SoundpadSettingsModal/SoundpadSettingsModal.css';

const SoundpadSoundsModal = ({ isOpen, onClose }) => {
  const [slots, setSlots] = useState(() => soundpadStorage.getConfig().slots);
  const [globalVolume, setGlobalVolume] = useState(() => soundpadStorage.getConfig().globalVolume);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingLabel, setPendingLabel] = useState('Новый звук');
  const [editingHotkeySlotId, setEditingHotkeySlotId] = useState(null);
  const [tempHotkey, setTempHotkey] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;
    document.body.style.overflow = 'hidden';
    setSlots(soundpadStorage.getConfig().slots);
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) onClose();
  };

  const handleUploadSound = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    setError('');
    try {
      const soundId = await soundpadStorage.saveSoundFile(file);
      soundpadStorage.addSlot({
        label: pendingLabel || file.name,
        soundId,
        volume: 1,
      });
      setSlots(soundpadStorage.getConfig().slots);
      setPendingLabel('Новый звук');
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveSlot = async (slotId) => {
    const removed = soundpadStorage.removeSlot(slotId);
    if (removed?.soundId) {
      await soundpadStorage.deleteSound(removed.soundId);
    }
    setSlots(soundpadStorage.getConfig().slots);
  };

  const handlePlaySlot = async (slotId) => {
    setError('');
    try {
      await soundpadBridge.playSlot(slotId);
    } catch (err) {
      soundpadError('SoundpadSoundsModal: play failed', err);
      setError(err.message || String(err));
    }
  };

  const handleGlobalVolume = (value) => {
    const parsed = Number(value);
    const next = Number.isFinite(parsed) ? parsed : 1;
    setGlobalVolume(next);
    soundpadStorage.saveConfig({ globalVolume: next });
  };

  const startHotkeyEdit = (slotId, currentHotkey = '') => {
    setEditingHotkeySlotId(slotId);
    setTempHotkey(currentHotkey || '');
    setError('');
  };

  const cancelHotkeyEdit = () => {
    setEditingHotkeySlotId(null);
    setTempHotkey('');
  };

  const saveHotkeyForSlot = (slotId) => {
    if (tempHotkey) {
      const conflict = findHotkeyConflict(tempHotkey, slotId);
      if (conflict) {
        const where = conflict.type === 'voice' ? 'настройках голоса' : `звуке «${conflict.label}»`;
        setError(`Комбинация уже используется в ${where}`);
        return;
      }
    }
    soundpadStorage.updateSlot(slotId, { hotkey: tempHotkey });
    setSlots(soundpadStorage.getConfig().slots);
    cancelHotkeyEdit();
  };

  const handleHotkeyKeyDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      cancelHotkeyEdit();
      return;
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      setTempHotkey('');
      return;
    }
    const keyString = hotkeyStorage.parseKeyEvent(event);
    if (keyString) setTempHotkey(keyString);
  };

  const handleHotkeyMouseDown = (event) => {
    if (event.button === 3 || event.button === 4 || event.button === 1) {
      event.preventDefault();
      event.stopPropagation();
      setTempHotkey(hotkeyStorage.parseMouseEvent(event));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="soundpad-modal-overlay" onClick={handleOverlayClick} role="presentation">
      <div className="soundpad-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="soundpad-modal__header">
          <h2>Саундпад</h2>
          <button type="button" className="soundpad-modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>

        <div className="soundpad-modal__content">
          <section className="soundpad-section">
            <h3>Звуки</h3>
            <div className="soundpad-field">
              <label htmlFor="global-volume">Общая громкость</label>
              <input
                id="global-volume"
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={globalVolume}
                onChange={(e) => handleGlobalVolume(e.target.value)}
              />
            </div>

            <div className="soundpad-upload">
              <input
                type="text"
                value={pendingLabel}
                onChange={(e) => setPendingLabel(e.target.value)}
                placeholder="Название кнопки"
              />
              <label className="soundpad-btn soundpad-btn--secondary">
                Добавить звук
                <input type="file" accept="audio/*" hidden onChange={handleUploadSound} disabled={busy} />
              </label>
            </div>

            <p className="soundpad-hint">
              Шорткаты работают глобально в десктоп-приложении. Режим VB-Cable и мост — в Настройках → Саундпад.
            </p>

            <div className="soundpad-slots">
              {slots.length === 0 && (
                <p className="soundpad-hint">Добавьте mp3, wav или ogg — появятся кнопки на панели и шорткаты.</p>
              )}
              {slots.map((slot) => (
                <div key={slot.id} className="soundpad-slot">
                  <input
                    type="text"
                    value={slot.label}
                    onChange={(e) => {
                      soundpadStorage.updateSlot(slot.id, { label: e.target.value });
                      setSlots(soundpadStorage.getConfig().slots);
                    }}
                    placeholder="Название"
                  />
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.05"
                    value={slot.volume ?? 1}
                    onChange={(e) => {
                      soundpadStorage.updateSlot(slot.id, { volume: Number(e.target.value) });
                      setSlots(soundpadStorage.getConfig().slots);
                    }}
                    title="Громкость слота"
                  />
                  {editingHotkeySlotId === slot.id ? (
                    <>
                      <div className="soundpad-slot__hotkey-edit">
                        <input
                          type="text"
                          className="soundpad-hotkey-input"
                          value={hotkeyStorage.formatKey(tempHotkey)}
                          onKeyDown={handleHotkeyKeyDown}
                          onMouseDown={handleHotkeyMouseDown}
                          readOnly
                          placeholder="Нажмите клавишу…"
                          autoFocus
                        />
                        <button
                          type="button"
                          className="soundpad-btn soundpad-btn--primary"
                          onClick={() => saveHotkeyForSlot(slot.id)}
                        >
                          OK
                        </button>
                        <button
                          type="button"
                          className="soundpad-btn soundpad-btn--secondary"
                          onClick={cancelHotkeyEdit}
                        >
                          ✕
                        </button>
                      </div>
                      <span />
                      <span />
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={`soundpad-hotkey-btn${slot.hotkey ? ' soundpad-hotkey-btn--set' : ''}`}
                        onClick={() => startHotkeyEdit(slot.id, slot.hotkey)}
                      >
                        {slot.hotkey ? hotkeyStorage.formatKey(slot.hotkey) : 'Шорткат'}
                      </button>
                      <button
                        type="button"
                        className="soundpad-btn soundpad-btn--primary"
                        onClick={() => handlePlaySlot(slot.id)}
                        title="Проиграть"
                      >
                        ▶
                      </button>
                      <button
                        type="button"
                        className="soundpad-btn soundpad-btn--danger"
                        onClick={() => handleRemoveSlot(slot.id)}
                        title="Удалить"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>

          {error && <div className="soundpad-status soundpad-status--warn">{error}</div>}
        </div>
      </div>
    </div>
  );
};

export default SoundpadSoundsModal;
