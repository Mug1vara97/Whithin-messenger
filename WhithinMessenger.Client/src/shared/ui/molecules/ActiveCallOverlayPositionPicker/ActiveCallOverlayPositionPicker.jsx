import React, { useCallback, useRef } from 'react';
import { ACTIVE_CALL_OVERLAY_CORNER_PRESETS } from '../../../lib/utils/activeCallOverlaySettings';
import './ActiveCallOverlayPositionPicker.css';

const MARKER_WIDTH_PX = 56;
const MARKER_HEIGHT_PX = 18;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function ActiveCallOverlayPositionPicker({ coords, onChange, disabled = false }) {
  const innerRef = useRef(null);
  const markerRef = useRef(null);

  const updateFromClientPoint = useCallback(
    (clientX, clientY) => {
      if (disabled || !innerRef.current) return;

      const innerRect = innerRef.current.getBoundingClientRect();
      if (innerRect.width <= 0 || innerRect.height <= 0) return;

      const markerWidth = markerRef.current?.offsetWidth ?? MARKER_WIDTH_PX;
      const markerHeight = markerRef.current?.offsetHeight ?? MARKER_HEIGHT_PX;
      const maxX = Math.max(0, innerRect.width - markerWidth);
      const maxY = Math.max(0, innerRect.height - markerHeight);

      const localX = clamp(clientX - innerRect.left, 0, maxX);
      const localY = clamp(clientY - innerRect.top, 0, maxY);

      const xPercent = maxX > 0 ? (localX / maxX) * 100 : 0;
      const yPercent = maxY > 0 ? (localY / maxY) * 100 : 0;

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

  const xPercent = coords?.xPercent ?? 100;
  const yPercent = coords?.yPercent ?? 100;

  const markerStyle = {
    left: `calc((100% - ${MARKER_WIDTH_PX}px) * ${xPercent / 100})`,
    top: `calc((100% - ${MARKER_HEIGHT_PX}px) * ${yPercent / 100})`,
  };

  return (
    <div className={`active-call-overlay-position-picker${disabled ? ' is-disabled' : ''}`}>
      <div className="active-call-overlay-position-picker__screen" role="presentation">
        <div
          ref={innerRef}
          className="active-call-overlay-position-picker__inner"
          onPointerDown={handlePointerDown}
        >
          <div
            ref={markerRef}
            className="active-call-overlay-position-picker__marker"
            style={markerStyle}
            aria-hidden="true"
          >
            <span className="active-call-overlay-position-picker__marker-chip" />
          </div>
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
