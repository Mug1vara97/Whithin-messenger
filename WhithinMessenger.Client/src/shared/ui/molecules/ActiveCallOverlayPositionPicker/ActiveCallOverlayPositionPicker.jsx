import React, { useCallback, useRef } from 'react';
import { ACTIVE_CALL_OVERLAY_CORNER_PRESETS } from '../../../lib/utils/activeCallOverlaySettings';
import './ActiveCallOverlayPositionPicker.css';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function ActiveCallOverlayPositionPicker({ coords, onChange, disabled = false }) {
  const previewRef = useRef(null);

  const updateFromClientPoint = useCallback(
    (clientX, clientY) => {
      if (disabled || !previewRef.current) return;

      const rect = previewRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const xPercent = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
      const yPercent = clamp(((clientY - rect.top) / rect.height) * 100, 0, 100);

      onChange({
        xPercent: Math.round(xPercent),
        yPercent: Math.round(yPercent),
      });
    },
    [disabled, onChange],
  );

  const handlePointerDown = (event) => {
    if (disabled) return;
    event.preventDefault();
    updateFromClientPoint(event.clientX, event.clientY);

    const handleMove = (moveEvent) => {
      updateFromClientPoint(moveEvent.clientX, moveEvent.clientY);
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp, { once: true });
  };

  const markerStyle = {
    left: `${coords?.xPercent ?? 100}%`,
    top: `${coords?.yPercent ?? 100}%`,
  };

  return (
    <div className={`active-call-overlay-position-picker${disabled ? ' is-disabled' : ''}`}>
      <div
        ref={previewRef}
        className="active-call-overlay-position-picker__screen"
        onPointerDown={handlePointerDown}
        role="presentation"
      >
        <div className="active-call-overlay-position-picker__marker" style={markerStyle} aria-hidden="true">
          <span className="active-call-overlay-position-picker__marker-chip" />
        </div>
      </div>
      <p className="active-call-overlay-position-picker__hint">
        Нажмите или перетащите по схеме экрана, чтобы выбрать место для панели участников.
      </p>
      <div className="active-call-overlay-position-picker__presets">
        {ACTIVE_CALL_OVERLAY_CORNER_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="active-call-overlay-position-picker__preset"
            disabled={disabled}
            onClick={() => onChange(preset.coords)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
