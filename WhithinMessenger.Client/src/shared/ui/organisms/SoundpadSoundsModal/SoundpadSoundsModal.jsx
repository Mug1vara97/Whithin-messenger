import React, { useEffect, useState } from 'react';
import Close from '@mui/icons-material/Close';
import GraphicEq from '@mui/icons-material/GraphicEq';
import PlayArrow from '@mui/icons-material/PlayArrow';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import Keyboard from '@mui/icons-material/Keyboard';
import Add from '@mui/icons-material/Add';
import UploadFile from '@mui/icons-material/UploadFile';
import { soundpadBridge } from '../../../lib/soundpad/soundpadBridge';
import { soundpadStorage } from '../../../lib/soundpad/soundpadStorage';
import { findHotkeyConflict } from '../../../lib/soundpad/soundpadHotkeys';
import hotkeyStorage from '../../../lib/utils/hotkeyStorage';
import { soundpadError } from '../../../lib/soundpad/soundpadLogger';
import { SoundpadRemotePlaybackSetting } from '../../molecules/SoundpadRemotePlaybackSetting';
import '../SoundpadSettingsModal/SoundpadSettingsModal.css';

const formatVolume = (value) => `${Math.round(Number(value) * 100)}%`;

const SoundpadSoundsModal = ({ isOpen, onClose }) => {
  const [slots, setSlots] = useState(() => soundpadStorage.getConfig().slots);
  const [globalVolume, setGlobalVolume] = useState(() => soundpadStorage.getConfig().globalVolume);
  const [monitorEnabled, setMonitorEnabled] = useState(
    () => soundpadStorage.getConfig().monitorEnabled !== false,
  );
  const [monitorVolume, setMonitorVolume] = useState(
    () => soundpadStorage.getConfig().monitorVolume ?? 1,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingLabel, setPendingLabel] = useState('Новый звук');
  const [editingHotkeySlotId, setEditingHotkeySlotId] = useState(null);
  const [tempHotkey, setTempHotkey] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setError('');
      setEditingHotkeySlotId(null);
      setTempHotkey('');
      return undefined;
    }

    document.body.style.overflow = 'hidden';
    setSlots(soundpadStorage.getConfig().slots);

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && editingHotkeySlotId == null) onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose, editingHotkeySlotId]);

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

  const handleMonitorEnabled = (enabled) => {
    setMonitorEnabled(enabled);
    soundpadBridge.setMonitorEnabled(enabled);
  };

  const handleMonitorVolume = (value) => {
    const parsed = Number(value);
    const next = Number.isFinite(parsed) ? parsed : 1;
    setMonitorVolume(next);
    soundpadBridge.setMonitorVolume(next);
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
    <div className="soundpad-modal-root" role="dialog" aria-modal="true" aria-labelledby="soundpad-modal-title">
      <button
        type="button"
        className="soundpad-modal-root__backdrop"
        onClick={onClose}
        aria-label="Закрыть"
      />

      <div className="soundpad-modal-root__dialog" onClick={(e) => e.stopPropagation()}>
        <header className="soundpad-modal-root__header">
          <div className="soundpad-modal-root__title-block">
            <div className="soundpad-modal-root__title-row">
              <GraphicEq className="soundpad-modal-root__title-icon" aria-hidden="true" />
              <h2 id="soundpad-modal-title" className="soundpad-modal-root__title">Саундпад</h2>
            </div>
            <p className="soundpad-modal-root__subtitle">
              Звуки в микрофон, шорткаты и прослушивание
            </p>
          </div>
          <button
            type="button"
            className="soundpad-modal-root__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <Close fontSize="small" />
          </button>
        </header>

        <div className="soundpad-modal-root__body">
          <section className="soundpad-modal-section">
            <h3 className="soundpad-modal-section__title">Громкость</h3>

            <div className="soundpad-range-field">
              <div className="soundpad-range-field__head">
                <label htmlFor="global-volume">В микрофон</label>
                <span className="soundpad-range-field__value">{formatVolume(globalVolume)}</span>
              </div>
              <input
                id="global-volume"
                className="soundpad-range"
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={globalVolume}
                onChange={(e) => handleGlobalVolume(e.target.value)}
              />
            </div>

            <label className="soundpad-checkbox soundpad-modal-section__checkbox">
              <input
                type="checkbox"
                checked={monitorEnabled}
                onChange={(e) => handleMonitorEnabled(e.target.checked)}
              />
              <span>Слышать у себя (наушники / колонки)</span>
            </label>

            <div className={`soundpad-range-field${monitorEnabled ? '' : ' soundpad-range-field--disabled'}`}>
              <div className="soundpad-range-field__head">
                <label htmlFor="monitor-volume">Громкость прослушивания</label>
                <span className="soundpad-range-field__value">{formatVolume(monitorVolume)}</span>
              </div>
              <input
                id="monitor-volume"
                className="soundpad-range"
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={monitorVolume}
                disabled={!monitorEnabled}
                onChange={(e) => handleMonitorVolume(e.target.value)}
              />
            </div>
          </section>

          <div className="soundpad-modal-divider" role="separator" />

          <section className="soundpad-modal-section">
            <h3 className="soundpad-modal-section__title">Участники звонка</h3>
            <p className="soundpad-hint soundpad-modal-section__hint">
              Отключает только звуки саундпада других людей. Голос они по-прежнему слышны.
            </p>
            <SoundpadRemotePlaybackSetting showHint={false} />
          </section>

          <div className="soundpad-modal-divider" role="separator" />

          <section className="soundpad-modal-section">
            <h3 className="soundpad-modal-section__title">Добавить звук</h3>
            <div className="soundpad-upload-card">
              <input
                type="text"
                className="soundpad-input"
                value={pendingLabel}
                onChange={(e) => setPendingLabel(e.target.value)}
                placeholder="Название кнопки"
              />
              <label className="soundpad-btn soundpad-btn--primary soundpad-upload-card__btn">
                <UploadFile sx={{ fontSize: 18 }} />
                {busy ? 'Загрузка…' : 'Выбрать файл'}
                <input type="file" accept="audio/*" hidden onChange={handleUploadSound} disabled={busy} />
              </label>
            </div>
            <p className="soundpad-hint soundpad-modal-section__hint">
              mp3, wav, ogg. Шорткаты работают глобально в десктоп-приложении.
            </p>
          </section>

          <div className="soundpad-modal-divider" role="separator" />

          <section className="soundpad-modal-section">
            <div className="soundpad-modal-section__title-row">
              <h3 className="soundpad-modal-section__title">Мои звуки</h3>
              <span className="soundpad-modal-section__count">{slots.length}</span>
            </div>

            {slots.length === 0 ? (
              <div className="soundpad-empty">
                <Add className="soundpad-empty__icon" aria-hidden="true" />
                <p>Добавьте звук — появятся кнопки на панели</p>
              </div>
            ) : (
              <div className="soundpad-slots">
                {slots.map((slot) => (
                  <article key={slot.id} className="soundpad-slot-card">
                    <div className="soundpad-slot-card__top">
                      <input
                        type="text"
                        className="soundpad-input soundpad-slot-card__name"
                        value={slot.label}
                        onChange={(e) => {
                          soundpadStorage.updateSlot(slot.id, { label: e.target.value });
                          setSlots(soundpadStorage.getConfig().slots);
                        }}
                        placeholder="Название"
                      />
                      <div className="soundpad-slot-card__actions">
                        <button
                          type="button"
                          className="soundpad-icon-btn soundpad-icon-btn--play"
                          onClick={() => handlePlaySlot(slot.id)}
                          title="Проиграть"
                          aria-label="Проиграть"
                        >
                          <PlayArrow fontSize="small" />
                        </button>
                        <button
                          type="button"
                          className="soundpad-icon-btn soundpad-icon-btn--danger"
                          onClick={() => handleRemoveSlot(slot.id)}
                          title="Удалить"
                          aria-label="Удалить"
                        >
                          <DeleteOutline fontSize="small" />
                        </button>
                      </div>
                    </div>

                    <div className="soundpad-slot-card__bottom">
                      <div className="soundpad-range-field soundpad-range-field--compact">
                        <div className="soundpad-range-field__head">
                          <label htmlFor={`slot-volume-${slot.id}`}>Громкость</label>
                          <span className="soundpad-range-field__value">
                            {formatVolume(slot.volume ?? 1)}
                          </span>
                        </div>
                        <input
                          id={`slot-volume-${slot.id}`}
                          className="soundpad-range"
                          type="range"
                          min="0"
                          max="2"
                          step="0.05"
                          value={slot.volume ?? 1}
                          onChange={(e) => {
                            soundpadStorage.updateSlot(slot.id, { volume: Number(e.target.value) });
                            setSlots(soundpadStorage.getConfig().slots);
                          }}
                        />
                      </div>

                      {editingHotkeySlotId === slot.id ? (
                        <div className="soundpad-slot-card__hotkey-edit">
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
                            className="soundpad-btn soundpad-btn--primary soundpad-btn--compact"
                            onClick={() => saveHotkeyForSlot(slot.id)}
                          >
                            OK
                          </button>
                          <button
                            type="button"
                            className="soundpad-btn soundpad-btn--ghost soundpad-btn--compact"
                            onClick={cancelHotkeyEdit}
                            aria-label="Отмена"
                          >
                            <Close fontSize="small" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={`soundpad-hotkey-btn${slot.hotkey ? ' soundpad-hotkey-btn--set' : ''}`}
                          onClick={() => startHotkeyEdit(slot.id, slot.hotkey)}
                        >
                          <Keyboard sx={{ fontSize: 16 }} />
                          {slot.hotkey ? hotkeyStorage.formatKey(slot.hotkey) : 'Шорткат'}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {error && (
            <div className="soundpad-status soundpad-status--warn" role="alert">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SoundpadSoundsModal;
