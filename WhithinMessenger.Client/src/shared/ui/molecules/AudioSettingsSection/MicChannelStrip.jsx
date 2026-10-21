import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import MicNoneOutlinedIcon from '@mui/icons-material/MicNoneOutlined';
import MicOffOutlinedIcon from '@mui/icons-material/MicOffOutlined';
import './MicChannelStrip.css';

const MIN_DB = -60;
const MAX_DB = 0;
const CLIP_DB = -0.5;
const WARN_DB = -9;
const HOLD_MS = 1200;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Map analyser average (0..255) + gain to approximate peak dBFS. */
export function levelToDb(level, gain = 1) {
  const linear = (Number(level) / 255) * Math.max(0, Number(gain) || 0);
  if (linear <= 0.00001) return MIN_DB;
  return clamp(20 * Math.log10(linear), MIN_DB, MAX_DB);
}

export function formatDb(db) {
  if (!Number.isFinite(db) || db <= MIN_DB + 0.05) return '−∞ dB';
  const abs = Math.abs(db).toFixed(1);
  return db > -0.05 ? `0.0 dB` : `−${abs} dB`;
}

function dbToUnit(db) {
  return clamp((db - MIN_DB) / (MAX_DB - MIN_DB), 0, 1);
}

/**
 * Mixer-style mic channel strip inspired by audiocn Channel Strip.
 * https://www.audiocn.dev/docs/components/channel-strip
 */
export function MicChannelStrip({
  deviceLabel = 'Системный микрофон',
  volume = 1,
  onVolumeChange,
  level = 0,
  live = false,
  muted = false,
  onMuteChange,
  onToggleLive,
  notice = null,
  noticeVariant = 'destructive',
  disabled = false,
}) {
  const titleId = useId();
  const [displayDb, setDisplayDb] = useState(MIN_DB);
  const [holdUnit, setHoldUnit] = useState(0);
  const [clipping, setClipping] = useState(false);
  const peakRef = useRef(MIN_DB);
  const holdUnitRef = useRef(0);
  const holdUntilRef = useRef(0);
  const clipUntilRef = useRef(0);
  const rafRef = useRef(0);
  const targetDbRef = useRef(MIN_DB);

  const targetDb = useMemo(() => {
    if (muted || !live) return MIN_DB;
    return levelToDb(level, volume);
  }, [level, live, muted, volume]);

  targetDbRef.current = targetDb;

  useEffect(() => {
    let last = performance.now();

    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const target = targetDbRef.current;
      let peak = peakRef.current;
      if (target >= peak) {
        // ~15 ms attack
        peak = peak + (target - peak) * Math.min(1, dt / 0.015);
      } else {
        // ~1.2 s release to silence
        peak = peak + (target - peak) * Math.min(1, dt / 0.55);
      }
      peakRef.current = peak;
      setDisplayDb(peak);

      if (peak >= CLIP_DB) {
        clipUntilRef.current = now + 1500;
      }
      setClipping(now < clipUntilRef.current);

      const unit = dbToUnit(peak);
      if (unit >= holdUnitRef.current - 0.001 || now > holdUntilRef.current) {
        holdUnitRef.current = unit;
        holdUntilRef.current = now + HOLD_MS;
        setHoldUnit(unit);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    if (!live || muted) {
      peakRef.current = MIN_DB;
      holdUnitRef.current = 0;
      setDisplayDb(MIN_DB);
      setHoldUnit(0);
      setClipping(false);
    }
  }, [live, muted]);

  const meterUnit = dbToUnit(displayDb);
  const zone = displayDb >= CLIP_DB ? 'clip' : displayDb >= WARN_DB ? 'warn' : 'ok';
  const volumePercent = Math.round(clamp(volume, 0, 1) * 100);
  const statusTone = muted ? 'muted' : live ? 'live' : 'default';
  const statusLabel = muted ? 'Mute' : live ? 'Live' : 'Готов';

  return (
    <div
      className="mic-strip"
      role="group"
      aria-labelledby={titleId}
      data-muted={muted || undefined}
      data-live={live || undefined}
      data-clipping={clipping || undefined}
      data-disabled={disabled || undefined}
    >
      <div className="mic-strip__layout">
        <div className="mic-strip__header">
          <span className="mic-strip__icon" aria-hidden>
            {muted ? <MicOffOutlinedIcon fontSize="small" /> : <MicNoneOutlinedIcon fontSize="small" />}
          </span>
          <div className="mic-strip__text">
            <span className="mic-strip__title" id={titleId}>
              Микрофон
            </span>
            <span className="mic-strip__desc" title={deviceLabel}>
              {deviceLabel}
            </span>
          </div>
          <span className={`mic-strip__status mic-strip__status--${statusTone}`} data-tone={statusTone}>
            {statusLabel}
          </span>
        </div>

        <div className="mic-strip__meter" data-zone={zone} data-dimmed={muted || !live || undefined}>
          <div
            className="mic-strip__meter-track"
            role="meter"
            aria-label="Уровень микрофона"
            aria-valuemin={MIN_DB}
            aria-valuemax={MAX_DB}
            aria-valuenow={Math.round(displayDb)}
            aria-valuetext={formatDb(displayDb)}
          >
            <div
              className="mic-strip__meter-fill"
              style={{ transform: `scaleX(${meterUnit})` }}
            />
            <div
              className="mic-strip__meter-hold"
              style={{ left: `calc(${holdUnit * 100}% - 1px)` }}
            />
            <span className="mic-strip__meter-zones" aria-hidden />
          </div>
          <span className={`mic-strip__clip${clipping ? ' is-on' : ''}`} aria-hidden title="Clip">
            CLIP
          </span>
        </div>

        <div className="mic-strip__fader">
          <input
            type="range"
            className="mic-strip__fader-input"
            min={0}
            max={100}
            step={1}
            value={volumePercent}
            disabled={disabled}
            aria-label="Громкость микрофона"
            style={{ '--fader-fill': `${volumePercent}%` }}
            onChange={(event) => {
              const next = Number(event.target.value) / 100;
              onVolumeChange?.(next);
            }}
          />
        </div>

        <div className="mic-strip__value" aria-live="off">
          {formatDb(displayDb)}
        </div>

        <div className="mic-strip__controls">
          <button
            type="button"
            className={`mic-strip__toggle${muted ? ' is-active is-mute' : ''}`}
            aria-pressed={muted}
            aria-label={muted ? 'Включить звук монитора' : 'Выключить звук монитора'}
            disabled={disabled}
            onClick={() => onMuteChange?.(!muted)}
            title="Mute"
          >
            M
          </button>
          <button
            type="button"
            className={`mic-strip__toggle${live ? ' is-active is-live' : ''}`}
            aria-pressed={live}
            aria-label={live ? 'Остановить проверку микрофона' : 'Проверить микрофон'}
            disabled={disabled}
            onClick={() => onToggleLive?.()}
            title={live ? 'Стоп' : 'Проверка'}
          >
            {live ? '■' : '▶'}
          </button>
        </div>

        {notice ? (
          <div
            className={`mic-strip__notice mic-strip__notice--${noticeVariant}`}
            role={noticeVariant === 'destructive' ? 'alert' : 'status'}
          >
            {notice}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default MicChannelStrip;
