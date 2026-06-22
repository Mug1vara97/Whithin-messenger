import React, { useEffect } from 'react';
import Close from '@mui/icons-material/Close';
import GraphicEq from '@mui/icons-material/GraphicEq';
import SoundpadSoundsContent from './SoundpadSoundsContent';
import '../SoundpadSettingsModal/SoundpadSettingsModal.css';

const SoundpadSoundsModal = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return undefined;

    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

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
          <SoundpadSoundsContent active={isOpen} />
        </div>
      </div>
    </div>
  );
};

export default SoundpadSoundsModal;
