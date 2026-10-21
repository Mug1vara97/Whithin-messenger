import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import './EventDateTimePickers.css';

const DEG = Math.PI / 180;
const DECELERATION = 0.00042;
const MAX_VELOCITY = 0.18;
const VELOCITY_WINDOW = 90;
const WHEEL_SENS = 0.012;
const WHEEL_SETTLE = 110;
const BACK = 1.35;

const easeOutCubic = (p) => 1 - (1 - p) ** 3;
const easeOutBack = (p) => 1 + (BACK + 1) * (p - 1) ** 3 + BACK * (p - 1) ** 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

const optionValue = (option) => (typeof option === 'string' ? option : option.value);
const optionLabel = (option) => (typeof option === 'string' ? option : option.label);

/**
 * iOS-style 3D wheel picker inspired by beUI WheelPicker.
 * https://beui.dev/components/motion/wheel-picker
 */
export function WheelPicker({
  options = [],
  value,
  defaultValue,
  onValueChange,
  visibleCount = 5,
  itemHeight = 36,
  disabled = false,
  className = '',
  'aria-label': ariaLabel = 'Выбор',
}) {
  const reduce = useReducedMotion() ?? false;
  const controlled = value !== undefined;
  const last = Math.max(0, options.length - 1);

  const indexOf = useCallback(
    (v) => {
      const i = options.findIndex((o) => optionValue(o) === v);
      return i < 0 ? 0 : i;
    },
    [options]
  );

  const [internal, setInternal] = useState(() => defaultValue ?? value ?? optionValue(options[0]));
  const currentValue = controlled ? value : internal;
  const [grabbing, setGrabbing] = useState(false);

  const { itemAngle, radius, height, hideBeyond } = useMemo(() => {
    const rowsEachSide = Math.max(1, Math.floor(visibleCount / 2));
    const cutoff = rowsEachSide + 1;
    const angle = 90 / cutoff;
    const r = itemHeight / Math.tan(angle * DEG);
    return {
      itemAngle: angle,
      radius: r,
      hideBeyond: cutoff,
      height: Math.round(2 * r * Math.sin(rowsEachSide * angle * DEG) + itemHeight),
    };
  }, [visibleCount, itemHeight]);

  const drumRef = useRef(null);
  const bandRef = useRef(null);
  const scroll = useRef(indexOf(currentValue));
  const raf = useRef(0);
  const emitted = useRef(currentValue);
  const drag = useRef(null);
  const wheelTimer = useRef(0);

  const paint = useCallback(
    (s) => {
      const drum = drumRef.current;
      const band = bandRef.current;
      const transform = `translateZ(${-radius}px) rotateX(${itemAngle * s}deg)`;
      if (drum) {
        drum.style.transform = transform;
        for (const node of Array.from(drum.children)) {
          const li = node;
          const i = Number(li.dataset.index);
          const want = Math.abs(i - s) > hideBeyond ? 'hidden' : 'visible';
          if (li.style.visibility !== want) li.style.visibility = want;
        }
      }
      if (band) {
        band.style.transform = transform;
        for (const node of Array.from(band.children)) {
          const li = node;
          const i = Number(li.dataset.index);
          const want = Math.abs(i - s) > hideBeyond ? 'hidden' : 'visible';
          if (li.style.visibility !== want) li.style.visibility = want;
        }
      }
    },
    [radius, itemAngle, hideBeyond]
  );

  const emit = useCallback(
    (i) => {
      const v = optionValue(options[clamp(Math.round(i), 0, last)]);
      if (v === emitted.current) return;
      emitted.current = v;
      if (!controlled) setInternal(v);
      onValueChange?.(v);
    },
    [options, last, controlled, onValueChange]
  );

  const stop = useCallback(() => cancelAnimationFrame(raf.current), []);

  const glide = useCallback(
    (to, duration, ease = easeOutCubic) => {
      stop();
      const from = scroll.current;
      const dist = to - from;
      if (!dist || duration <= 0) {
        scroll.current = to;
        paint(to);
        emit(to);
        return;
      }
      const start = performance.now();
      const tick = (now) => {
        const p = (now - start) / duration;
        if (p >= 1) {
          scroll.current = to;
          paint(to);
          emit(to);
          return;
        }
        scroll.current = from + dist * ease(p);
        paint(scroll.current);
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    },
    [stop, paint, emit]
  );

  const fling = useCallback(
    (velocity) => {
      const from = scroll.current;
      if (from < 0 || from > last) {
        glide(clamp(Math.round(from), 0, last), 260);
        return;
      }
      const dir = Math.sign(velocity) || 1;
      const coast = ((velocity * velocity) / (2 * DECELERATION)) * dir;
      const to = clamp(Math.round(from + coast), 0, last);
      const duration = clamp(Math.sqrt(Math.abs(to - from)) * 300 + 240, 280, 1700);
      glide(to, duration, easeOutBack);
    },
    [last, glide]
  );

  useEffect(() => {
    const i = indexOf(currentValue);
    scroll.current = i;
    paint(i);
    emitted.current = currentValue;
  }, [currentValue, indexOf, paint, options.length]);

  useEffect(() => () => stop(), [stop]);

  const onPointerDown = (event) => {
    if (disabled || reduce) return;
    stop();
    setGrabbing(true);
    drag.current = {
      pointerId: event.pointerId,
      y: event.clientY,
      scroll: scroll.current,
      samples: [{ t: performance.now(), y: event.clientY }],
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const dy = event.clientY - state.y;
    scroll.current = state.scroll - dy / itemHeight;
    paint(scroll.current);
    const now = performance.now();
    state.samples.push({ t: now, y: event.clientY });
    state.samples = state.samples.filter((s) => now - s.t <= VELOCITY_WINDOW);
  };

  const onPointerUp = (event) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    drag.current = null;
    setGrabbing(false);
    const samples = state.samples;
    let velocity = 0;
    if (samples.length >= 2) {
      const first = samples[0];
      const lastSample = samples[samples.length - 1];
      const dt = Math.max(1, lastSample.t - first.t);
      velocity = clamp((first.y - lastSample.y) / itemHeight / dt, -MAX_VELOCITY, MAX_VELOCITY);
    }
    if (Math.abs(velocity) > 0.002) fling(velocity);
    else glide(clamp(Math.round(scroll.current), 0, last), 220);
  };

  const onWheel = (event) => {
    if (disabled) return;
    event.preventDefault();
    if (reduce) {
      const next = clamp(indexOf(currentValue) + Math.sign(event.deltaY), 0, last);
      emit(next);
      paint(next);
      scroll.current = next;
      return;
    }
    stop();
    scroll.current += event.deltaY * WHEEL_SENS;
    paint(scroll.current);
    window.clearTimeout(wheelTimer.current);
    wheelTimer.current = window.setTimeout(() => {
      glide(clamp(Math.round(scroll.current), 0, last), 200);
    }, WHEEL_SETTLE);
  };

  const onKeyDown = (event) => {
    if (disabled) return;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = clamp(indexOf(currentValue) - 1, 0, last);
      if (reduce) {
        emit(next);
        paint(next);
        scroll.current = next;
      } else glide(next, 180);
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      const next = clamp(indexOf(currentValue) + 1, 0, last);
      if (reduce) {
        emit(next);
        paint(next);
        scroll.current = next;
      } else glide(next, 180);
    }
  };

  if (reduce) {
    return (
      <div
        className={`wheel-picker wheel-picker--flat ${className}`.trim()}
        style={{ height }}
        role="listbox"
        aria-label={ariaLabel}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={onKeyDown}
      >
        <div className="wheel-picker__flat-list">
          {options.map((option, i) => {
            const v = optionValue(option);
            const selected = v === currentValue;
            return (
              <button
                key={v}
                type="button"
                role="option"
                aria-selected={selected}
                className={`wheel-picker__flat-item ${selected ? 'is-selected' : ''}`}
                style={{ height: itemHeight }}
                disabled={disabled}
                onClick={() => {
                  emit(i);
                  scroll.current = i;
                  paint(i);
                }}
              >
                {optionLabel(option)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`wheel-picker ${grabbing ? 'is-grabbing' : ''} ${className}`.trim()}
      style={{ height, ['--wheel-item-height']: `${itemHeight}px` }}
      role="listbox"
      aria-label={ariaLabel}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <div className="wheel-picker__viewport" style={{ perspective: `${radius * 3}px` }}>
        <ul
          ref={drumRef}
          className="wheel-picker__drum"
          style={{
            transformStyle: 'preserve-3d',
            height: itemHeight,
            marginTop: (height - itemHeight) / 2,
          }}
        >
          {options.map((option, i) => (
            <li
              key={optionValue(option)}
              data-index={i}
              className="wheel-picker__item"
              style={{
                height: itemHeight,
                transform: `rotateX(${-itemAngle * i}deg) translateZ(${radius}px)`,
              }}
              role="option"
              aria-selected={optionValue(option) === currentValue}
            >
              {optionLabel(option)}
            </li>
          ))}
        </ul>
        <div className="wheel-picker__selection" style={{ height: itemHeight }} aria-hidden>
          <ul
            ref={bandRef}
            className="wheel-picker__drum wheel-picker__drum--band"
            style={{
              transformStyle: 'preserve-3d',
              height: itemHeight,
            }}
          >
            {options.map((option, i) => (
              <li
                key={`band-${optionValue(option)}`}
                data-index={i}
                className="wheel-picker__item wheel-picker__item--band"
                style={{
                  height: itemHeight,
                  transform: `rotateX(${-itemAngle * i}deg) translateZ(${radius}px)`,
                }}
              >
                {optionLabel(option)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default WheelPicker;
