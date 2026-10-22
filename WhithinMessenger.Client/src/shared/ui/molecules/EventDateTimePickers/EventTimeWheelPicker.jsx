import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronDown, Clock } from 'lucide-react';
import { WheelPicker } from './WheelPicker';
import './EventDateTimePickers.css';

const EASE_OUT = [0.16, 1, 0.3, 1];
const SPRING_LAYOUT = { type: 'spring', stiffness: 420, damping: 36, mass: 0.8 };

const pad = (n) => String(n).padStart(2, '0');
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.parseInt(v, 10) || 0));

const parseTime = (value) => {
  const [h = '00', m = '00'] = String(value || '00:00').split(':');
  return {
    hour: pad(clampInt(h, 0, 23)),
    minute: pad(clampInt(m, 0, 59)),
  };
};

/**
 * Expandable time picker (beUI-style trigger + wheel panel).
 */
export function EventTimeWheelPicker({
  value = '12:00',
  onChange,
  minuteStep = 5,
  disabled = false,
  label = 'Время',
  placeholder = 'Выберите время',
  className = '',
}) {
  const reduce = useReducedMotion() ?? false;
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const { hour, minute } = parseTime(value);
  const display = value ? `${hour}:${minute}` : placeholder;

  const hours = useMemo(
    () => Array.from({ length: 24 }, (_, i) => ({ value: pad(i), label: pad(i) })),
    []
  );

  const minutes = useMemo(() => {
    const step = Math.max(1, minuteStep);
    const list = [];
    for (let m = 0; m < 60; m += step) {
      list.push({ value: pad(m), label: pad(m) });
    }
    if (!list.some((o) => o.value === minute)) {
      list.push({ value: minute, label: minute });
      list.sort((a, b) => Number(a.value) - Number(b.value));
    }
    return list;
  }, [minuteStep, minute]);

  const setHour = (h) => onChange?.(`${h}:${minute}`);
  const setMinute = (m) => onChange?.(`${hour}:${m}`);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      className={`be-time-picker ${className}`.trim()}
      ref={rootRef}
      data-open={open || undefined}
      data-disabled={disabled || undefined}
    >
      <motion.button
        ref={triggerRef}
        type="button"
        layout={!reduce}
        transition={{ layout: SPRING_LAYOUT }}
        className="be-time-picker__trigger"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${display}`}
        onClick={() => setOpen((v) => !v)}
      >
        <motion.span
          layout={reduce ? false : 'position'}
          transition={{ layout: SPRING_LAYOUT }}
          className="be-time-picker__trigger-icon"
          aria-hidden
        >
          <Clock size={16} />
        </motion.span>
        <motion.span
          layout={reduce ? false : 'position'}
          transition={{ layout: SPRING_LAYOUT }}
          className="be-time-picker__trigger-label"
        >
          {display}
        </motion.span>
        <motion.span
          layout={reduce ? false : 'position'}
          transition={{ layout: SPRING_LAYOUT }}
          className={`be-time-picker__trigger-chevron${open ? ' is-open' : ''}`}
          aria-hidden
        >
          <ChevronDown size={14} />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="be-time-picker__panel"
            role="dialog"
            aria-label={label}
            initial={{ opacity: 0, y: reduce ? 0 : -6, scale: reduce ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: reduce ? 0 : -4,
              scale: reduce ? 1 : 0.98,
              transition: { duration: 0.12, ease: EASE_OUT },
            }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
          >
            <div className="be-time-picker__wheels">
              <WheelPicker
                options={hours}
                value={hour}
                onValueChange={setHour}
                visibleCount={5}
                itemHeight={36}
                loop
                disabled={disabled}
                aria-label="Часы"
              />
              <span className="be-time-picker__sep" aria-hidden>
                :
              </span>
              <WheelPicker
                options={minutes}
                value={minute}
                onValueChange={setMinute}
                visibleCount={5}
                itemHeight={36}
                loop
                disabled={disabled}
                aria-label="Минуты"
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default EventTimeWheelPicker;
