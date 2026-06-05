import React, { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_THEME,
  THEME_COLOR_FIELDS,
  getMergedTheme,
  persistTheme,
  resetTheme,
  applyThemeToRoot,
  extractFirstHexFromThemeValue
} from '../../../lib/theme/appTheme';
import styles from './ThemeColorMenu.module.css';

const colorPickerValue = (raw, key) => extractFirstHexFromThemeValue(raw) || DEFAULT_THEME[key] || '#5865f2';

function expandHex(hex) {
  if (!hex || typeof hex !== 'string') return '#000000';
  let h = hex.trim();
  if (!h.startsWith('#')) return '#000000';
  h = h.slice(1);
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (h.length !== 6) return '#000000';
  return `#${h.toLowerCase()}`;
}

function isPlainHex(value) {
  const s = (value || '').trim();
  return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(s);
}

function collectHexes(str) {
  const m = str.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi);
  return [...m].map((x) => expandHex(`#${x[1]}`));
}

const GRADIENT_STOP_COUNT = 6;

function stopPositionPercent(index) {
  if (GRADIENT_STOP_COUNT <= 1) return 0;
  return Math.round((index / (GRADIENT_STOP_COUNT - 1)) * 100);
}

function interpolateHex(c1, c2, t) {
  const parse = (hex) => {
    const n = parseInt(expandHex(hex).slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r1, g1, b1] = parse(c1);
  const [r2, g2, b2] = parse(c2);
  const ratio = Math.min(1, Math.max(0, t));
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Дополняет до 6 стопов, равномерно распределяя имеющиеся цвета. */
function expandToSixStops(hexes, fallbackHex) {
  const source = (hexes?.length ? hexes : [fallbackHex]).map(expandHex);
  if (source.length >= GRADIENT_STOP_COUNT) {
    return source.slice(0, GRADIENT_STOP_COUNT);
  }
  if (source.length === 1) {
    return Array.from({ length: GRADIENT_STOP_COUNT }, () => source[0]);
  }
  return Array.from({ length: GRADIENT_STOP_COUNT }, (_, index) => {
    const t = index / (GRADIENT_STOP_COUNT - 1);
    const srcIndex = t * (source.length - 1);
    const lo = Math.floor(srcIndex);
    const hi = Math.min(source.length - 1, Math.ceil(srcIndex));
    if (lo === hi) return source[lo];
    return interpolateHex(source[lo], source[hi], srcIndex - lo);
  });
}

function parseLinearGradientAngle(inner) {
  let angle = 180;
  const degM = inner.match(/^(-?\d+(?:\.\d+)?)deg\s*,/i);
  if (degM) {
    angle = Math.round(parseFloat(degM[1])) % 360;
  } else {
    const head = inner.split(',')[0].toLowerCase();
    if (head.includes('to bottom right') || head.includes('to right bottom')) angle = 135;
    else if (head.includes('to top right') || head.includes('to right top')) angle = 45;
    else if (head.includes('to bottom left') || head.includes('to left bottom')) angle = 225;
    else if (head.includes('to top left') || head.includes('to left top')) angle = 315;
    else if (head.includes('to right')) angle = 90;
    else if (head.includes('to left')) angle = 270;
    else if (head.includes('to bottom')) angle = 180;
    else if (head.includes('to top')) angle = 0;
    else {
      const anyDeg = inner.match(/(-?\d+(?:\.\d+)?)deg/i);
      if (anyDeg) angle = Math.round(parseFloat(anyDeg[1])) % 360;
    }
  }
  return ((angle % 360) + 360) % 360;
}

/** Угол (deg) и до 6 цветов из linear-gradient. Поддержка Ndeg и to top/right/... */
function parseLinearGradientUi(raw) {
  const s = (raw || '').trim();
  const open = /^linear-gradient\s*\(\s*(.*)\)$/i.exec(s);
  if (!open) return null;
  const inner = open[1];
  const hexes = collectHexes(inner);
  if (hexes.length < 2) return null;

  return {
    angle: parseLinearGradientAngle(inner),
    stops: expandToSixStops(hexes, hexes[0]),
  };
}

function buildLinearGradient(angle, stops) {
  const a = ((Math.round(Number(angle)) % 360) + 360) % 360;
  const list = Array.isArray(stops) ? stops : [stops].filter(Boolean);
  const colors = expandToSixStops(list, list[0] || '#36393f');
  const parts = colors.map((color, index) => `${expandHex(color)} ${stopPositionPercent(index)}%`);
  return `linear-gradient(${a}deg, ${parts.join(', ')})`;
}

function isAdvancedPaint(raw) {
  const s = (raw || '').trim();
  if (!s) return false;
  if (isPlainHex(s)) return false;
  if (/^linear-gradient\s*\(/i.test(s) && parseLinearGradientUi(s)) return false;
  return true;
}

const ANGLE_PRESETS = [
  { label: '→', angle: 90, title: 'Вправо' },
  { label: '←', angle: 270, title: 'Влево' },
  { label: '↓', angle: 180, title: 'Вниз' },
  { label: '↑', angle: 0, title: 'Вверх' },
  { label: '↘', angle: 135, title: 'Диагональ' },
  { label: '↗', angle: 45, title: 'Диагональ' }
];

function GradientFieldEditor({ label, raw, fallbackHex, onChange }) {
  const advanced = isAdvancedPaint(raw);
  const parsedLinear = useMemo(() => parseLinearGradientUi(raw), [raw]);

  const [tab, setTab] = useState(() => {
    if (advanced) return 'advanced';
    if (parsedLinear) return 'gradient';
    return 'solid';
  });

  useEffect(() => {
    const adv = isAdvancedPaint(raw);
    const parsed = parseLinearGradientUi(raw);
    if (adv) setTab('advanced');
    else if (parsed) setTab('gradient');
    else setTab('solid');
  }, [raw]);

  const solidHex = expandHex(isPlainHex(raw) ? raw : extractFirstHexFromThemeValue(raw) || fallbackHex);

  const linearState = parsedLinear || {
    angle: 135,
    stops: expandToSixStops(
      [
        expandHex(extractFirstHexFromThemeValue(raw) || fallbackHex),
        expandHex(fallbackHex),
      ],
      fallbackHex
    ),
  };

  const setSolid = (hex) => onChange(expandHex(hex));
  const setLinearPart = (next) => {
    const angle = next.angle ?? linearState.angle;
    const stops = [...linearState.stops];
    if (typeof next.stopIndex === 'number' && next.color) {
      stops[next.stopIndex] = expandHex(next.color);
    }
    onChange(buildLinearGradient(angle, stops));
  };

  const simplifyToLinear = () => {
    const hexes = collectHexes(raw);
    let c1 = expandHex(hexes[0] || fallbackHex);
    let c2 = expandHex(hexes[1] || fallbackHex);
    if (c1 === c2) c2 = adjustHue(c1);
    const p = parseLinearGradientUi(raw);
    const angle = p ? p.angle : 135;
    onChange(buildLinearGradient(angle, expandToSixStops(hexes.length ? hexes : [c1, c2], fallbackHex)));
    setTab('gradient');
  };

  return (
    <div className={styles.fieldBlock}>
      <div className={styles.fieldHeader}>
        <span className={styles.label}>{label}</span>
      </div>

      <div className={styles.tabRow} role="tablist" aria-label={`Режим: ${label}`}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'solid'}
          className={`${styles.tab} ${tab === 'solid' ? styles.tabActive : ''}`}
          onClick={() => {
            setTab('solid');
            setSolid(solidHex);
          }}
        >
          Цвет
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'gradient'}
          className={`${styles.tab} ${tab === 'gradient' ? styles.tabActive : ''}`}
          onClick={() => {
            setTab('gradient');
            if (!parseLinearGradientUi(raw) && isPlainHex(raw)) {
              const end = expandHex(fallbackHex);
              const start = solidHex;
              const c2 = start === end ? adjustHue(start) : end;
              onChange(buildLinearGradient(135, expandToSixStops([start, c2], fallbackHex)));
            } else if (!parseLinearGradientUi(raw)) {
              simplifyToLinear();
            }
          }}
        >
          Градиент
        </button>
        {advanced && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'advanced'}
            className={`${styles.tab} ${tab === 'advanced' ? styles.tabActive : ''}`}
            onClick={() => setTab('advanced')}
          >
            Свой CSS
          </button>
        )}
      </div>

      {tab === 'solid' && (
        <div className={styles.solidRow}>
          <input
            type="color"
            className={styles.colorInputWide}
            value={solidHex}
            onChange={(e) => setSolid(e.target.value)}
            aria-label={`${label}: цвет`}
          />
        </div>
      )}

      {tab === 'gradient' && (
        <div className={styles.gradientPanel}>
          <div className={styles.gradientStopsGrid}>
            {linearState.stops.map((stopColor, index) => (
              <label key={index} className={styles.miniLabel}>
                Точка {index + 1} ({stopPositionPercent(index)}%)
                <input
                  type="color"
                  className={styles.colorInput}
                  value={expandHex(stopColor)}
                  onChange={(e) => setLinearPart({ stopIndex: index, color: e.target.value })}
                  aria-label={`${label}: точка градиента ${index + 1}`}
                />
              </label>
            ))}
          </div>
          <div className={styles.angleRow}>
            <span className={styles.angleLabel}>Угол</span>
            <input
              type="range"
              className={styles.angleRange}
              min={0}
              max={359}
              value={linearState.angle}
              onChange={(e) => setLinearPart({ angle: Number(e.target.value) })}
              aria-label={`Угол градиента ${linearState.angle} градусов`}
            />
            <span className={styles.angleValue}>{linearState.angle}°</span>
          </div>
          <div className={styles.presets} role="group" aria-label="Направление">
            {ANGLE_PRESETS.map((p) => (
              <button
                key={p.angle}
                type="button"
                className={styles.presetBtn}
                title={p.title}
                onClick={() => setLinearPart({ angle: p.angle })}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'advanced' && (
        <p className={styles.advancedHint}>
          Сложное значение (например radial-gradient). Можно упростить до линейного градиента по цветам из строки.
        </p>
      )}

      <div className={styles.previewStrip} style={{ background: raw }} aria-hidden />

      {(tab === 'advanced' || advanced) && (
        <div className={styles.advancedActions}>
          <button type="button" className={styles.linkishBtn} onClick={simplifyToLinear}>
            Упростить до линейного градиента
          </button>
        </div>
      )}

      <details className={styles.cssDetails}>
        <summary className={styles.cssSummary}>CSS вручную</summary>
        <textarea
          className={styles.cssTextarea}
          rows={2}
          spellCheck={false}
          value={raw}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#36393f или linear-gradient(...)"
        />
      </details>
    </div>
  );
}

/** Лёгкое смещение hex для второго стопа, если совпадает с первым. */
function adjustHue(hex) {
  const e = expandHex(hex);
  const n = parseInt(e.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const r2 = Math.min(255, r + 40);
  const g2 = Math.min(255, g + 20);
  const b2 = Math.min(255, b + 60);
  return `#${((1 << 24) + (r2 << 16) + (g2 << 8) + b2).toString(16).slice(1)}`;
}

const ThemeColorMenu = ({ open, onClose }) => {
  const [draft, setDraft] = useState(() => ({ ...DEFAULT_THEME }));

  useEffect(() => {
    if (open) {
      setDraft(getMergedTheme());
    }
  }, [open]);

  if (!open) return null;

  const handleChange = (key, value) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      applyThemeToRoot(next);
      return next;
    });
  };

  const handleSave = () => {
    persistTheme(draft);
    onClose();
  };

  const handleReset = () => {
    resetTheme();
    setDraft({ ...DEFAULT_THEME });
    onClose();
  };

  const handleCancel = () => {
    applyThemeToRoot(getMergedTheme());
    onClose();
  };

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-color-menu-title"
      onClick={(e) => e.target === e.currentTarget && handleCancel()}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 id="theme-color-menu-title" className={styles.title}>
            Цвета интерфейса
          </h2>
          <button type="button" className={styles.closeBtn} onClick={handleCancel} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className={styles.body}>
          {THEME_COLOR_FIELDS.map(({ key, label, acceptsGradient }) => {
            const raw = draft[key] ?? DEFAULT_THEME[key];
            const fallbackHex = DEFAULT_THEME[key] || '#36393f';

            if (acceptsGradient) {
              return (
                <GradientFieldEditor
                  key={key}
                  label={label}
                  raw={raw}
                  fallbackHex={fallbackHex}
                  onChange={(value) => handleChange(key, value)}
                />
              );
            }

            return (
              <div key={key} className={styles.fieldBlock}>
                <div className={styles.fieldHeader}>
                  <span className={styles.label}>{label}</span>
                  <input
                    type="color"
                    className={styles.colorInput}
                    value={colorPickerValue(raw, key)}
                    onChange={(e) => handleChange(key, e.target.value)}
                    title={label}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className={styles.footer}>
          <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={handleReset}>
            Сбросить
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleCancel}>
            Отмена
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThemeColorMenu;
