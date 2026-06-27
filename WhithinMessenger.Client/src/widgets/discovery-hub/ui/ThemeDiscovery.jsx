import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import {
  DEFAULT_THEME,
  getThemePresetId,
  persistThemePreset,
  THEME_PRESET_LIST,
} from '../../../shared/lib/theme/appTheme';
import { isLightThemePreset } from '../../../shared/lib/theme/themePresets';
import {
  addThemeToLibrary,
  getInstalledThemeIds,
  subscribeUserThemeLibrary,
} from '../../../shared/lib/theme/userThemeLibrary';
import './ThemeDiscovery.css';

const ThemePreview = ({ preset }) => {
  const colors = preset.colors || DEFAULT_THEME;
  const isLight = isLightThemePreset(preset.id);

  return (
    <div
      className={`theme-discovery__preview${isLight ? ' theme-discovery__preview--light' : ''}`}
      style={{
        '--preview-bg': colors['--background-primary'] || DEFAULT_THEME['--background-primary'],
        '--preview-surface': colors['--surface'] || DEFAULT_THEME['--surface'],
        '--preview-primary': colors['--primary'] || DEFAULT_THEME['--primary'],
        '--preview-text': colors['--text'] || DEFAULT_THEME['--text'],
        '--preview-muted': colors['--text-muted'] || DEFAULT_THEME['--text-muted'],
        '--preview-border': colors['--border'] || DEFAULT_THEME['--border'],
      }}
      aria-hidden
    >
      <div className="theme-discovery__preview-sidebar" />
      <div className="theme-discovery__preview-main">
        <div className="theme-discovery__preview-bar" />
        <div className="theme-discovery__preview-lines">
          <span />
          <span />
          <span className="theme-discovery__preview-lines--short" />
        </div>
        <div className="theme-discovery__preview-chip" />
      </div>
    </div>
  );
};

const ThemeDiscoveryCard = ({
  preset,
  isInstalled,
  isActive,
  onAdd,
  onApply,
}) => (
  <article className="theme-discovery__card">
    <ThemePreview preset={preset} />

    <div className="theme-discovery__card-body">
      <div className="theme-discovery__card-head">
        <h3 className="theme-discovery__card-title">{preset.name}</h3>
        {isActive && (
          <span className="theme-discovery__badge theme-discovery__badge--active">
            Активна
          </span>
        )}
      </div>

      {preset.description ? (
        <p className="theme-discovery__card-desc">{preset.description}</p>
      ) : (
        <p className="theme-discovery__card-desc theme-discovery__card-desc--empty">
          Без описания
        </p>
      )}
    </div>

    <div className="theme-discovery__card-actions">
      {isActive ? (
        <button type="button" className="theme-discovery__btn theme-discovery__btn--installed" disabled>
          <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
          Используется
        </button>
      ) : isInstalled ? (
        <button
          type="button"
          className="theme-discovery__btn theme-discovery__btn--apply"
          onClick={() => onApply(preset.id)}
        >
          Применить
        </button>
      ) : (
        <button
          type="button"
          className="theme-discovery__btn theme-discovery__btn--add"
          onClick={() => onAdd(preset.id)}
        >
          <AddOutlinedIcon sx={{ fontSize: 18 }} />
          Добавить
        </button>
      )}
    </div>
  </article>
);

const ThemeDiscovery = ({ searchQuery = '' }) => {
  const [installedIds, setInstalledIds] = useState(() => getInstalledThemeIds());
  const [activePresetId, setActivePresetId] = useState(() => getThemePresetId());

  const filteredThemes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return THEME_PRESET_LIST;

    return THEME_PRESET_LIST.filter((preset) => {
      const nameMatch = preset.name?.toLowerCase().includes(query);
      const descMatch = preset.description?.toLowerCase().includes(query);
      return nameMatch || descMatch;
    });
  }, [searchQuery]);

  useEffect(() => subscribeUserThemeLibrary(setInstalledIds), []);

  useEffect(() => {
    const handleThemePresetChanged = () => {
      setActivePresetId(getThemePresetId());
      setInstalledIds(getInstalledThemeIds());
    };

    window.addEventListener('themePresetChanged', handleThemePresetChanged);
    return () => window.removeEventListener('themePresetChanged', handleThemePresetChanged);
  }, []);

  const handleAdd = useCallback((presetId) => {
    const next = addThemeToLibrary(presetId);
    setInstalledIds(next);
  }, []);

  const handleApply = useCallback((presetId) => {
    addThemeToLibrary(presetId);
    persistThemePreset(presetId);
    setInstalledIds(getInstalledThemeIds());
    setActivePresetId(presetId);
  }, []);

  if (filteredThemes.length === 0) {
    return (
      <div className="theme-discovery__state">
        <PaletteOutlinedIcon sx={{ fontSize: 48, opacity: 0.35 }} />
        <h3>Темы не найдены</h3>
        <p>
          {searchQuery.trim()
            ? 'Попробуйте другой запрос или очистите поиск.'
            : 'Каталог тем пока пуст.'}
        </p>
      </div>
    );
  }

  return (
    <div className="theme-discovery__grid">
      {filteredThemes.map((preset) => (
        <ThemeDiscoveryCard
          key={preset.id}
          preset={preset}
          isInstalled={installedIds.includes(preset.id)}
          isActive={activePresetId === preset.id}
          onAdd={handleAdd}
          onApply={handleApply}
        />
      ))}
    </div>
  );
};

export default ThemeDiscovery;
