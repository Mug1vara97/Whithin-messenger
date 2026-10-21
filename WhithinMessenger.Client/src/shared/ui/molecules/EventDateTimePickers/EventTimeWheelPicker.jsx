import React, { useMemo } from 'react';
import { WheelPicker } from './WheelPicker';
import './EventDateTimePickers.css';

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
 * Dual wheel (hour + minute) inspired by beUI WheelPicker.
 */
export function EventTimeWheelPicker({
  value = '12:00',
  onChange,
  minuteStep = 5,
  disabled = false,
  label,
  className = '',
}) {
  const { hour, minute } = parseTime(value);

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
    // Ensure current minute is selectable even if not on step
    if (!list.some((o) => o.value === minute)) {
      list.push({ value: minute, label: minute });
      list.sort((a, b) => Number(a.value) - Number(b.value));
    }
    return list;
  }, [minuteStep, minute]);

  const setHour = (h) => onChange?.(`${h}:${minute}`);
  const setMinute = (m) => onChange?.(`${hour}:${m}`);

  return (
    <div className={`event-time-wheels ${className}`.trim()}>
      {label ? <div className="event-datetime-label">{label}</div> : null}
      <div className="event-time-wheels__row">
        <WheelPicker
          options={hours}
          value={hour}
          onValueChange={setHour}
          visibleCount={5}
          itemHeight={36}
          disabled={disabled}
          aria-label="Часы"
        />
        <span className="event-time-wheels__sep" aria-hidden>
          :
        </span>
        <WheelPicker
          options={minutes}
          value={minute}
          onValueChange={setMinute}
          visibleCount={5}
          itemHeight={36}
          disabled={disabled}
          aria-label="Минуты"
        />
      </div>
    </div>
  );
}

export default EventTimeWheelPicker;
