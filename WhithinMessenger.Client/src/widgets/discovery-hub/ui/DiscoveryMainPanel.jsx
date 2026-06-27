import React, { useMemo } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import ServerDiscovery from '../../server-discovery/ui/ServerDiscovery';
import ThemeDiscovery from './ThemeDiscovery';
import { THEME_PRESET_LIST } from '../../../shared/lib/theme/appTheme';
import { DISCOVERY_TAB, DISCOVERY_SECTION_META } from './discoveryConstants';
import './DiscoveryHub.css';

const DiscoveryMainPanel = ({
  activeSection = DISCOVERY_TAB.SERVERS,
  searchQuery = '',
  onSearchChange,
  onServerSelected,
  onClose,
}) => {
  const isServersSection = activeSection === DISCOVERY_TAB.SERVERS;
  const sectionMeta = DISCOVERY_SECTION_META[activeSection] ?? DISCOVERY_SECTION_META[DISCOVERY_TAB.SERVERS];

  const themeCountLabel = useMemo(() => {
    if (isServersSection) return null;
    const query = searchQuery.trim().toLowerCase();
    const count = !query
      ? THEME_PRESET_LIST.length
      : THEME_PRESET_LIST.filter((preset) => {
          const nameMatch = preset.name?.toLowerCase().includes(query);
          const descMatch = preset.description?.toLowerCase().includes(query);
          return nameMatch || descMatch;
        }).length;

    if (count === 1) return '1 тема';
    if (count < 5) return `${count} темы`;
    return `${count} тем`;
  }, [isServersSection, searchQuery]);

  return (
    <div className="discovery-main">
      <header className="discovery-main__header">
        <div>
          <h1 className="discovery-main__title">{sectionMeta.heading}</h1>
          <p className="discovery-main__subtitle">{sectionMeta.subtitle}</p>
        </div>
      </header>

      <div className="discovery-main__toolbar">
        <label className="discovery-main__search">
          <SearchIcon className="discovery-main__search-icon" sx={{ fontSize: 20 }} />
          <input
            type="search"
            placeholder={sectionMeta.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </label>
        {themeCountLabel && (
          <span className="discovery-main__count">{themeCountLabel}</span>
        )}
      </div>

      <div className="discovery-main__content">
        {isServersSection ? (
          <ServerDiscovery
            embedded
            searchQuery={searchQuery}
            onServerSelected={onServerSelected}
            onClose={onClose}
          />
        ) : (
          <ThemeDiscovery searchQuery={searchQuery} />
        )}
      </div>
    </div>
  );
};

export default DiscoveryMainPanel;
