import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/*
 * Elastic slider in the spirit of reactbits.dev/components/elastic-slider: the bar thickens
 * on hover, stretches like rubber when dragged past either end and springs back.
 */

const TAU = Math.PI * 2;
const MAX_STRETCH = 42;
const BOUNCE = 0.5;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const rubber = (distance, limit) => 2 * (1 / (1 + Math.exp(-distance / limit)) - 0.5) * limit;

export function ElasticSlider({
  value,
  min = 0,
  max = 1,
  onChange,
  onChangeEnd,
  startIcon,
  endIcon,
  thickness = 6,
  activeThickness = 12,
  label,
  className = '',
}) {
  const rootRef = useRef(null);
  const hitRef = useRef(null);
  const trackRef = useRef(null);
  const rangeRef = useRef(null);
  const startRef = useRef(null);
  const endRef = useRef(null);
  const m = useRef({ p: 0, vp: 0, target: 0, s: 0, vs: 0, side: 1, held: false, a: 0, va: 0, goal: 0, length: 1, raf: 0, last: 0, ready: false, hovered: false });
  const drag = useRef(null);
  const [dragValue, setDragValue] = useState(null);
  const span = max - min || 1;
  const current = clamp(dragValue ?? value ?? min, min, max);
  const props = useRef({});
  props.current = { onChange, onChangeEnd, min, max, span, thickness, activeThickness };

  const paint = () => {
    const s = m.current;
    const { thickness: base, activeThickness: active } = props.current;
    const track = trackRef.current;
    const range = rangeRef.current;
    if (!track || !range) return;
    const thick = base + (active - base) * s.a;
    track.style.height = `${thick.toFixed(2)}px`;
    const along = 1 + s.s / Math.max(1, s.length);
    const across = 1 - 0.22 * clamp(s.s / MAX_STRETCH, -1, 1);
    track.style.transformOrigin = s.side > 0 ? '0% 50%' : '100% 50%';
    track.style.transform = `scale(${along.toFixed(4)}, ${across.toFixed(4)})`;
    const p = clamp(s.p, 0, 1);
    range.style.clipPath = `inset(0 ${((1 - p) * 100).toFixed(3)}% 0 0 round ${(thick / 2).toFixed(2)}px)`;
    const iconScale = (1 + 0.08 * s.a).toFixed(3);
    const startShift = s.side > 0 ? 0 : s.s;
    const endShift = s.side > 0 ? s.s : 0;
    if (startRef.current) startRef.current.style.transform = `translateX(${(-startShift).toFixed(2)}px) scale(${iconScale})`;
    if (endRef.current) endRef.current.style.transform = `translateX(${endShift.toFixed(2)}px) scale(${iconScale})`;
  };

  const frame = (now) => {
    const s = m.current;
    s.raf = 0;
    const elapsed = clamp((now - s.last) / 1000, 0, 1 / 20);
    s.last = now;
    const steps = Math.max(1, Math.ceil(elapsed / (1 / 240)));
    const dt = elapsed / steps;
    const dragging = !!drag.current;
    const fillOmega = TAU / (dragging ? 0.09 : 0.3);
    const fillZeta = dragging ? 1 : 0.86;
    const stretchOmega = TAU / 0.42;
    const stretchZeta = 1 - 0.9 * BOUNCE;
    const activeOmega = TAU / 0.32;
    for (let i = 0; i < steps; i += 1) {
      s.vp += (-fillOmega * fillOmega * (s.p - s.target) - 2 * fillZeta * fillOmega * s.vp) * dt;
      s.p += s.vp * dt;
      if (!s.held) {
        s.vs += (-stretchOmega * stretchOmega * s.s - 2 * stretchZeta * stretchOmega * s.vs) * dt;
        s.s += s.vs * dt;
      }
      s.va += (-activeOmega * activeOmega * (s.a - s.goal) - 2 * 0.9 * activeOmega * s.va) * dt;
      s.a += s.va * dt;
    }
    const settled =
      Math.abs(s.p - s.target) < 0.0004 &&
      Math.abs(s.vp) < 0.002 &&
      (s.held || (Math.abs(s.s) < 0.05 && Math.abs(s.vs) < 0.5)) &&
      Math.abs(s.a - s.goal) < 0.002 &&
      Math.abs(s.va) < 0.005;
    if (settled) {
      Object.assign(s, { p: s.target, vp: 0, a: s.goal, va: 0 });
      if (!s.held) Object.assign(s, { s: 0, vs: 0 });
    }
    paint();
    if (!settled || dragging) s.raf = requestAnimationFrame(frame);
  };

  const kick = () => {
    const s = m.current;
    if (s.raf) return;
    s.last = performance.now();
    s.raf = requestAnimationFrame(frame);
  };

  const refreshGoal = () => {
    const active = Boolean(m.current.hovered || drag.current);
    m.current.goal = active ? 1 : 0;
    rootRef.current?.classList.toggle('es--active', active);
    kick();
  };

  useLayoutEffect(() => {
    const s = m.current;
    const fraction = (current - min) / span;
    s.target = fraction;
    if (!s.ready) {
      s.ready = true;
      s.p = fraction;
      paint();
      return;
    }
    kick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, min, span]);

  useLayoutEffect(() => {
    const hit = hitRef.current;
    if (!hit) return undefined;
    const measure = () => {
      m.current.length = Math.max(1, hit.clientWidth);
      paint();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(hit);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => cancelAnimationFrame(m.current.raf), []);

  const valueAt = (event) => {
    const rect = hitRef.current.getBoundingClientRect();
    return (event.clientX - rect.left) / Math.max(1, rect.width);
  };

  const pulse = (side) => {
    const icon = (side > 0 ? endRef : startRef).current?.firstElementChild;
    icon?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], {
      duration: 280,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    });
  };

  const follow = (event) => {
    const s = m.current;
    const { min: lo, span: range, onChange: change } = props.current;
    const fraction = valueAt(event);
    const over = fraction < 0 ? -fraction * s.length : fraction > 1 ? (fraction - 1) * s.length : 0;
    if (over > 0) {
      const side = fraction < 0 ? -1 : 1;
      if (!s.held || s.side !== side) pulse(side);
      s.held = true;
      s.side = side;
      s.s = rubber(over, MAX_STRETCH);
      s.vs = 0;
    } else s.held = false;
    const next = lo + clamp(fraction, 0, 1) * range;
    setDragValue(next);
    drag.current.value = next;
    change?.(next);
    kick();
  };

  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    hitRef.current.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, value: current };
    refreshGoal();
    follow(event);
  };

  const onPointerMove = (event) => {
    if (drag.current?.id === event.pointerId) follow(event);
  };

  const release = () => {
    if (!drag.current) return;
    const final = drag.current.value;
    drag.current = null;
    m.current.held = false;
    refreshGoal();
    props.current.onChangeEnd?.(final);
    setDragValue(null);
  };

  const onKeyDown = (event) => {
    const unit = span / 20;
    const keys = { ArrowRight: unit, ArrowUp: unit, ArrowLeft: -unit, ArrowDown: -unit };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const next = clamp(current + keys[event.key], min, max);
    if (next === current) {
      m.current.side = keys[event.key] > 0 ? 1 : -1;
      m.current.vs = MAX_STRETCH * 5.5;
      pulse(m.current.side);
      kick();
      return;
    }
    onChange?.(next);
    onChangeEnd?.(next);
  };

  return (
    <div
      ref={rootRef}
      className={`es ${className}`}
      onPointerEnter={() => {
        m.current.hovered = true;
        refreshGoal();
      }}
      onPointerLeave={() => {
        m.current.hovered = false;
        refreshGoal();
      }}
    >
      {startIcon && (
        <span className="es__icon" ref={startRef}>
          <span className="es__icon-inner">{startIcon}</span>
        </span>
      )}
      <div
        ref={hitRef}
        className="es__hit"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={current}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onKeyDown={onKeyDown}
      >
        <div ref={trackRef} className="es__track">
          <div ref={rangeRef} className="es__range" />
        </div>
      </div>
      {endIcon && (
        <span className="es__icon" ref={endRef}>
          <span className="es__icon-inner">{endIcon}</span>
        </span>
      )}
    </div>
  );
}
