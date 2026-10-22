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
const wrap = (i, n) => {
  if (n <= 0) return 0;
  return ((Math.round(i) % n) + n) % n;
};

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
  loop = false,
  className = '',
  'aria-label': ariaLabel = 'Выбор',
}) {
  const reduce = useReducedMotion() ?? false;
  const controlled = value !== undefined;
  const n = options.length;
  const last = Math.max(0, n - 1);
  const canLoop = loop && n > 1;

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

  const { itemAngle, radius, height, hideBeyond, slotCount } = useMemo(() => {
    const rowsEachSide = Math.max(1, Math.floor(visibleCount / 2));
    const cutoff = rowsEachSide + 1;
    const angle = 90 / cutoff;
    const r = itemHeight / Math.tan(angle * DEG);
    return {
      itemAngle: angle,
      radius: r,
      hideBeyond: cutoff,
      slotCount: cutoff * 2 + 4,
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

      const paintList = (list) => {
        if (!list) return;
        list.style.transform = transform;
        const children = Array.from(list.children);
        if (canLoop) {
          const first = Math.floor(s) - hideBeyond - 1;
          for (let k = 0; k < children.length; k += 1) {
            const li = children[k];
            const vi = first + k;
            const opt = options[wrap(vi, n)];
            const want = Math.abs(vi - s) > hideBeyond ? 'hidden' : 'visible';
            li.dataset.index = String(vi);
            li.style.transform = `rotateX(${-itemAngle * vi}deg) translateZ(${radius}px)`;
            li.style.visibility = want;
            const label = optionLabel(opt);
            if (li.textContent !== label) li.textContent = label;
            li.setAttribute('aria-selected', optionValue(opt) === emitted.current ? 'true' : 'false');
          }
          return;
        }
        for (const node of children) {
          const li = node;
          const i = Number(li.dataset.index);
          const want = Math.abs(i - s) > hideBeyond ? 'hidden' : 'visible';
          if (li.style.visibility !== want) li.style.visibility = want;
        }
      };

      paintList(drum);
      paintList(band);
    },
    [radius, itemAngle, hideBeyond, canLoop, options, n]
  );

  const emit = useCallback(
    (i) => {
      const idx = canLoop ? wrap(i, n) : clamp(Math.round(i), 0, last);
      const v = optionValue(options[idx]);
      if (v === emitted.current) return;
      emitted.current = v;
      if (!controlled) setInternal(v);
      onValueChange?.(v);
    },
    [options, last, canLoop, n, controlled, onValueChange]
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
      if (!canLoop && (from < 0 || from > last)) {
        glide(clamp(Math.round(from), 0, last), 260);
        return;
      }
      const dir = Math.sign(velocity) || 1;
      const coast = ((velocity * velocity) / (2 * DECELERATION)) * dir;
      const raw = from + coast;
      const to = canLoop ? Math.round(raw) : clamp(Math.round(raw), 0, last);
      const duration = clamp(Math.sqrt(Math.abs(to - from)) * 300 + 240, 280, 1700);
      glide(to, duration, easeOutBack);
    },
    [last, canLoop, glide]
  );

  useEffect(() => {
    const i = indexOf(currentValue);
    // Keep continuous scroll near the new value (for loop, pick nearest turn).
    if (canLoop && n > 0) {
      const base = Math.round(scroll.current);
      const currentMod = wrap(base, n);
      let delta = i - currentMod;
      if (delta > n / 2) delta -= n;
      if (delta < -n / 2) delta += n;
      scroll.current = base + delta;
    } else {
      scroll.current = i;
    }
    paint(scroll.current);
    emitted.current = currentValue;
  }, [currentValue, indexOf, paint, options.length, canLoop, n]);

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
    else {
      const to = canLoop ? Math.round(scroll.current) : clamp(Math.round(scroll.current), 0, last);
      glide(to, 220);
    }
  };

  const onWheel = (event) => {
    if (disabled) return;
    event.preventDefault();
    if (reduce) {
      const cur = indexOf(currentValue);
      const next = canLoop ? wrap(cur + Math.sign(event.deltaY), n) : clamp(cur + Math.sign(event.deltaY), 0, last);
      emit(next);
      paint(canLoop ? scroll.current - cur + next : next);
      scroll.current = canLoop ? scroll.current - cur + next : next;
      return;
    }
    stop();
    scroll.current += event.deltaY * WHEEL_SENS;
    paint(scroll.current);
    window.clearTimeout(wheelTimer.current);
    wheelTimer.current = window.setTimeout(() => {
      const to = canLoop ? Math.round(scroll.current) : clamp(Math.round(scroll.current), 0, last);
      glide(to, 200);
    }, WHEEL_SETTLE);
  };

  const stepBy = (dir) => {
    const cur = indexOf(currentValue);
    const next = canLoop ? wrap(cur + dir, n) : clamp(cur + dir, 0, last);
    if (reduce) {
      emit(next);
      const target = canLoop ? scroll.current - cur + next : next;
      scroll.current = target;
      paint(target);
      return;
    }
    const target = canLoop ? Math.round(scroll.current) + dir : next;
    glide(target, 180);
  };

  const onKeyDown = (event) => {
    if (disabled) return;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      stepBy(-1);
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      stepBy(1);
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

  const slots = canLoop
    ? Array.from({ length: slotCount }, (_, k) => k)
    : options.map((_, i) => i);

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
          {slots.map((slot) => {
            const option = canLoop ? options[0] : options[slot];
            return (
              <li
                key={canLoop ? `slot-${slot}` : optionValue(option)}
                data-index={canLoop ? 0 : slot}
                className="wheel-picker__item"
                style={{
                  height: itemHeight,
                  transform: canLoop
                    ? undefined
                    : `rotateX(${-itemAngle * slot}deg) translateZ(${radius}px)`,
                }}
                role="option"
                aria-selected={canLoop ? false : optionValue(option) === currentValue}
              >
                {canLoop ? '' : optionLabel(option)}
              </li>
            );
          })}
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
            {slots.map((slot) => {
              const option = canLoop ? options[0] : options[slot];
              return (
                <li
                  key={canLoop ? `band-slot-${slot}` : `band-${optionValue(option)}`}
                  data-index={canLoop ? 0 : slot}
                  className="wheel-picker__item wheel-picker__item--band"
                  style={{
                    height: itemHeight,
                    transform: canLoop
                      ? undefined
                      : `rotateX(${-itemAngle * slot}deg) translateZ(${radius}px)`,
                  }}
                >
                  {canLoop ? '' : optionLabel(option)}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default WheelPicker;
