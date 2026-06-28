import React, { useMemo } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import ServerDiscovery from '../../server-discovery/ui/ServerDiscovery';
import ThemeDiscovery from './ThemeDiscovery';
import AvatarDecorationDiscovery from './AvatarDecorationDiscovery';
import { THEME_PRESET_LIST } from '../../../shared/lib/theme/appTheme';
import { AVATAR_DECORATION_CATALOG } from '../../../shared/lib/avatarDecorations/catalog';
import { DISCOVERY_TAB, DISCOVERY_SECTION_META } from './discoveryConstants';
import './DiscoveryHub.css';

const formatCountLabel = (count, one, few, many) => {
  if (count === 1) return one;
  if (count < 5) return few;
  return many;
};

const DiscoveryMainPanel = ({
  activeSection = DISCOVERY_TAB.SERVERS,
  searchQuery = '',
  onSearchChange,
  onServerSelected,
  onClose,
  onSectionChange,
}) => {
  const sectionMeta = DISCOVERY_SECTION_META[activeSection] ?? DISCOVERY_SECTION_META[DISCOVERY_TAB.SERVERS];

  const countLabel = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (activeSection === DISCOVERY_TAB.THEMES) {
      const count = !query
        ? THEME_PRESET_LIST.length
        : THEME_PRESET_LIST.filter((preset) => {
          const nameMatch = preset.name?.toLowerCase().includes(query);
          const descMatch = preset.description?.toLowerCase().includes(query);
          return nameMatch || descMatch;
        }).length;

      return formatCountLabel(count, '1 тема', `${count} темы`, `${count} тем`);
    }

    if (activeSection === DISCOVERY_TAB.DECORATIONS) {
      const count = !query
        ? AVATAR_DECORATION_CATALOG.length
        : AVATAR_DECORATION_CATALOG.filter((item) => {
          const nameMatch = item.name?.toLowerCase().includes(query);
          const descMatch = item.description?.toLowerCase().includes(query);
          return nameMatch || descMatch;
        }).length;

      return formatCountLabel(count, '1 рамка', `${count} рамки`, `${count} рамок`);
    }

    return null;
  }, [activeSection, searchQuery]);

  const renderContent = () => {
    if (activeSection === DISCOVERY_TAB.SERVERS) {
      return (
        <ServerDiscovery
          embedded
          searchQuery={searchQuery}
          onServerSelected={onServerSelected}
          onClose={onClose}
        />
      );
    }

    if (activeSection === DISCOVERY_TAB.THEMES) {
      return <ThemeDiscovery searchQuery={searchQuery} />;
    }

    return <AvatarDecorationDiscovery searchQuery={searchQuery} />;
  };

  return (
    <div className="discovery-main">
      <header className="discovery-main__header">
        <h2 className="discovery-main__title">{sectionMeta.heading}</h2>
        <div className="discovery-main__header-end">
          <label className="discovery-main__search">
            <SearchIcon className="discovery-main__search-icon" sx={{ fontSize: 18 }} />
            <input
              type="search"
              placeholder={sectionMeta.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
            />
          </label>
          {countLabel && (
            <span className="discovery-main__count">{countLabel}</span>
          )}
        </div>
      </header>

      <div className="discovery-main__content">
        {renderContent()}
      </div>
    </div>
  );
};

export default DiscoveryMainPanel;
