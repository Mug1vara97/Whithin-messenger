import { useState } from 'react';

/** Spotify-like range: fill follows the value, the thumb shows on hover; commits on release. */
export function Slider({ value, max, onChange, onCommit, className = '', label }) {
  const [draft, setDraft] = useState(null);
  const shown = draft ?? value;
  const pct = max > 0 ? Math.min(100, (shown / max) * 100) : 0;

  const commit = () => {
    if (draft === null) return;
    onCommit?.(draft);
    setDraft(null);
  };

  return (
    <input
      type="range"
      className={`slider ${className}`}
      min={0}
      max={max || 1}
      step="any"
      value={shown}
      aria-label={label}
      style={{ '--pct': `${pct}%` }}
      onChange={(e) => {
        const next = Number(e.target.value);
        if (onCommit) setDraft(next);
        onChange?.(next);
      }}
      onPointerUp={commit}
      onKeyUp={commit}
      onBlur={commit}
    />
  );
}
