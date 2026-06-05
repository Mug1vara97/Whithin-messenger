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
import {
  GRADIENT_STOP_COUNT,
  MESH_VIVID_PRESET,
  adjustHue,
  applyMeshPreset,
  buildGradientCss,
  collectHexes,
  convertGradientKind,
  createDefaultStops,
  isAdvancedPaint,
  linearStopLabel,
  meshStopLabel,
  parseGradientUi
} from '../../../lib/theme/themeGradientEditor';
import styles from './ThemeColorMenu.module.css';

const colorPickerValue = (raw, key) => extractFirstHexFromThemeValue(raw) || DEFAULT_THEME[key] || '#5865f2';

function isPlainHex(value) {
  const s = (value || '').trim();
  return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(s);
}

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
  const parsed = useMemo(() => parseGradientUi(raw, fallbackHex), [raw, fallbackHex]);

  const [tab, setTab] = useState(() => {
    if (advanced) return 'advanced';
    if (parsed) return 'gradient';
    return 'solid';
  });

  const [gradientKind, setGradientKind] = useState(() => parsed?.kind || 'linear');

  useEffect(() => {
    const adv = isAdvancedPaint(raw);
    const nextParsed = parseGradientUi(raw, fallbackHex);
    if (adv) setTab('advanced');
    else if (nextParsed) {
      setTab('gradient');
      setGradientKind(nextParsed.kind);
    } else setTab('solid');
  }, [raw, fallbackHex]);

  const solidHex = expandHex(isPlainHex(raw) ? raw : extractFirstHexFromThemeValue(raw) || fallbackHex);

  const gradientState = parsed || {
    kind: gradientKind,
    angle: 135,
    stops: createDefaultStops(fallbackHex, solidHex),
  };

  const activeKind = tab === 'gradient' ? gradientKind : gradientState.kind;

  const setSolid = (hex) => onChange(expandHex(hex));

  const emitGradient = (nextState) => {
    onChange(buildGradientCss(nextState));
  };

  const updateGradient = (patch) => {
    const next = {
      kind: activeKind,
      angle: patch.angle ?? gradientState.angle,
      stops: patch.stops ?? gradientState.stops,
    };
    emitGradient(next);
  };

  const setStopColor = (index, color) => {
    const stops = gradientState.stops.map((stop, i) =>
      i === index ? { ...stop, color: expandHex(color) } : stop
    );
    updateGradient({ stops });
  };

  const toggleStop = (index) => {
    const enabledCount = gradientState.stops.filter((stop) => stop.enabled).length;
    const stop = gradientState.stops[index];
    if (stop.enabled && enabledCount <= 1) return;

    const stops = gradientState.stops.map((item, i) =>
      i === index ? { ...item, enabled: !item.enabled } : item
    );
    updateGradient({ stops });
  };

  const switchGradientKind = (nextKind) => {
    setGradientKind(nextKind);
    const converted = convertGradientKind(
      { ...gradientState, kind: activeKind },
      nextKind,
      fallbackHex
    );
    emitGradient(converted);
  };

  const simplifyToEditable = () => {
    const hexes = collectHexes(raw);
    const meshParsed = parseGradientUi(raw, fallbackHex);
    if (meshParsed?.kind === 'mesh') {
      emitGradient(meshParsed);
      setGradientKind('mesh');
      setTab('gradient');
      return;
    }
    let c1 = expandHex(hexes[0] || fallbackHex);
    let c2 = expandHex(hexes[1] || fallbackHex);
    if (c1 === c2) c2 = adjustHue(c1);
    const stops = createDefaultStops(fallbackHex, c1).map((stop, index) => ({
      ...stop,
      color: index === 0 ? c1 : index === GRADIENT_STOP_COUNT - 1 ? c2 : stop.color,
      enabled: index === 0 || index === GRADIENT_STOP_COUNT - 1,
    }));
    emitGradient({
      kind: 'linear',
      angle: meshParsed?.angle || 135,
      stops,
    });
    setGradientKind('linear');
    setTab('gradient');
  };

  const enabledCount = gradientState.stops.filter((stop) => stop.enabled).length;

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
            if (!parseGradientUi(raw, fallbackHex) && isPlainHex(raw)) {
              const end = expandHex(fallbackHex);
              const start = solidHex;
              const c2 = start === end ? adjustHue(start) : end;
              emitGradient({
                kind: 'linear',
                angle: 135,
                stops: createDefaultStops(fallbackHex, start).map((stop, index) => ({
                  ...stop,
                  color: index === 0 ? start : index === GRADIENT_STOP_COUNT - 1 ? c2 : stop.color,
                  enabled: index === 0 || index === GRADIENT_STOP_COUNT - 1,
                })),
              });
              setGradientKind('linear');
            } else if (!parseGradientUi(raw, fallbackHex)) {
              simplifyToEditable();
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
          <div className={styles.kindRow} role="group" aria-label="Тип градиента">
            <button
              type="button"
              className={`${styles.kindBtn} ${activeKind === 'linear' ? styles.kindBtnActive : ''}`}
              onClick={() => switchGradientKind('linear')}
            >
              Линейный
            </button>
            <button
              type="button"
              className={`${styles.kindBtn} ${activeKind === 'mesh' ? styles.kindBtnActive : ''}`}
              onClick={() => switchGradientKind('mesh')}
            >
              Сферный
            </button>
          </div>

          <p className={styles.gradientHint}>
            {activeKind === 'mesh'
              ? 'Сферный градиент смешивает цвета из углов и центра — как на ярком фоне с красным и пурпурным. Снимите галочку с точки, чтобы не использовать её.'
              : 'Линейный градиент по линии. Можно включить от 1 до 6 точек — в CSS попадут только отмеченные.'}
          </p>

          <div className={styles.gradientStopsGrid}>
            {gradientState.stops.map((stop, index) => {
              const stopLabel =
                activeKind === 'mesh'
                  ? meshStopLabel(index)
                  : `Точка ${index + 1} (${linearStopLabel(index)})`;
              return (
                <div
                  key={index}
                  className={`${styles.stopCard} ${stop.enabled ? '' : styles.stopCardDisabled}`}
                >
                  <label className={styles.stopToggle}>
                    <input
                      type="checkbox"
                      checked={stop.enabled}
                      onChange={() => toggleStop(index)}
                      aria-label={`${label}: использовать ${stopLabel}`}
                    />
                    <span>{stopLabel}</span>
                  </label>
                  <input
                    type="color"
                    className={styles.colorInput}
                    value={expandHex(stop.color)}
                    disabled={!stop.enabled}
                    onChange={(e) => setStopColor(index, e.target.value)}
                    aria-label={`${label}: цвет ${stopLabel}`}
                  />
                </div>
              );
            })}
          </div>

          {activeKind === 'linear' && (
            <>
              <div className={styles.angleRow}>
                <span className={styles.angleLabel}>Угол</span>
                <input
                  type="range"
                  className={styles.angleRange}
                  min={0}
                  max={359}
                  value={gradientState.angle}
                  onChange={(e) => updateGradient({ angle: Number(e.target.value) })}
                  aria-label={`Угол градиента ${gradientState.angle} градусов`}
                />
                <span className={styles.angleValue}>{gradientState.angle}°</span>
              </div>
              <div className={styles.presets} role="group" aria-label="Направление">
                {ANGLE_PRESETS.map((preset) => (
                  <button
                    key={preset.angle}
                    type="button"
                    className={styles.presetBtn}
                    title={preset.title}
                    onClick={() => updateGradient({ angle: preset.angle })}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {activeKind === 'mesh' && (
            <div className={styles.presets}>
              <button
                type="button"
                className={styles.presetWideBtn}
                onClick={() => {
                  setGradientKind('mesh');
                  emitGradient(applyMeshPreset(MESH_VIVID_PRESET));
                }}
              >
                Пресет: яркий закат
              </button>
            </div>
          )}

          <p className={styles.enabledCountHint}>
            Активных точек: {enabledCount} из {GRADIENT_STOP_COUNT}
          </p>
        </div>
      )}

      {tab === 'advanced' && (
        <p className={styles.advancedHint}>
          Сложное значение (например conic-gradient). Можно упростить до редактора градиента.
        </p>
      )}

      <div className={styles.previewStrip} style={{ background: raw }} aria-hidden />

      {(tab === 'advanced' || advanced) && (
        <div className={styles.advancedActions}>
          <button type="button" className={styles.linkishBtn} onClick={simplifyToEditable}>
            Открыть в редакторе градиента
          </button>
        </div>
      )}

      <details className={styles.cssDetails}>
        <summary className={styles.cssSummary}>CSS вручную</summary>
        <textarea
          className={styles.cssTextarea}
          rows={3}
          spellCheck={false}
          value={raw}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#36393f, linear-gradient(...) или сферный mesh"
        />
      </details>
    </div>
  );
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
