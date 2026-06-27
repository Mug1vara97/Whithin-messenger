import React from 'react';
import CloseIcon from '@mui/icons-material/Close';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import { DISCOVERY_TAB } from './discoveryConstants';
import './DiscoveryHub.css';

const DiscoverySidebar = ({
  activeSection,
  onSectionChange,
  onClose,
}) => {
  const isServersSection = activeSection === DISCOVERY_TAB.SERVERS;

  return (
    <div className="discovery-sidebar">
      <div className="discovery-sidebar__header">
        <div className="discovery-sidebar__title">
          <ExploreOutlinedIcon sx={{ fontSize: 20 }} />
          <span>Обзор</span>
        </div>
        {onClose && (
          <button
            type="button"
            className="discovery-sidebar__close"
            onClick={onClose}
            aria-label="Закрыть обзор"
          >
            <CloseIcon fontSize="small" />
          </button>
        )}
      </div>

      <nav className="discovery-sidebar__nav" aria-label="Разделы обзора">
        <button
          type="button"
          className={`discovery-sidebar__nav-item${isServersSection ? ' is-active' : ''}`}
          onClick={() => onSectionChange(DISCOVERY_TAB.SERVERS)}
        >
          <span className="discovery-sidebar__nav-icon" aria-hidden="true">
            <DnsOutlinedIcon sx={{ fontSize: 20 }} />
          </span>
          <span className="discovery-sidebar__nav-label">Серверы</span>
        </button>
        <button
          type="button"
          className={`discovery-sidebar__nav-item${!isServersSection ? ' is-active' : ''}`}
          onClick={() => onSectionChange(DISCOVERY_TAB.THEMES)}
        >
          <span className="discovery-sidebar__nav-icon" aria-hidden="true">
            <PaletteOutlinedIcon sx={{ fontSize: 20 }} />
          </span>
          <span className="discovery-sidebar__nav-label">Темы</span>
        </button>
      </nav>
    </div>
  );
};

export default DiscoverySidebar;
