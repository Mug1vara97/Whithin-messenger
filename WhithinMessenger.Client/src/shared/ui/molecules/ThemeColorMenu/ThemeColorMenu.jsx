import React, { useEffect, useState } from 'react';
import {
  DEFAULT_THEME,
  THEME_COLOR_FIELDS,
  getMergedTheme,
  persistTheme,
  resetTheme,
  applyThemeToRoot
} from '../../../lib/theme/appTheme';
import styles from './ThemeColorMenu.module.css';

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
          {THEME_COLOR_FIELDS.map(({ key, label }) => (
            <div key={key} className={styles.row}>
              <span className={styles.label}>{label}</span>
              <input
                type="color"
                className={styles.colorInput}
                value={draft[key] || DEFAULT_THEME[key]}
                onChange={(e) => handleChange(key, e.target.value)}
                title={label}
              />
            </div>
          ))}
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
