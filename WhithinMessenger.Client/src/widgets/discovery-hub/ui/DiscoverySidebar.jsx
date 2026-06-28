import React from 'react';

import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';

import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';

import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';

import { DISCOVERY_TAB } from './discoveryConstants';

import './DiscoveryHub.css';



const NAV_ITEMS = [

  {

    id: DISCOVERY_TAB.SERVERS,

    label: 'Серверы',

    icon: DnsOutlinedIcon,

  },

  {

    id: DISCOVERY_TAB.THEMES,

    label: 'Темы',

    icon: PaletteOutlinedIcon,

  },

  {

    id: DISCOVERY_TAB.DECORATIONS,

    label: 'Украшения',

    icon: AutoAwesomeOutlinedIcon,

  },

];



const DiscoverySidebar = ({

  activeSection,

  onSectionChange,

}) => (

  <div className="discovery-sidebar">

    <div className="discovery-sidebar__header">

      <h3>Обзор</h3>

    </div>



    <nav className="discovery-sidebar__nav" aria-label="Разделы обзора">

      {NAV_ITEMS.map(({ id, label, icon: Icon }) => (

        <button

          key={id}

          type="button"

          className={`discovery-sidebar__nav-item${activeSection === id ? ' is-active' : ''}`}

          onClick={() => onSectionChange(id)}

        >

          <span className="discovery-sidebar__nav-icon" aria-hidden="true">

            <Icon sx={{ fontSize: 20 }} />

          </span>

          <span className="discovery-sidebar__nav-label">{label}</span>

        </button>

      ))}

    </nav>

  </div>

);



export default DiscoverySidebar;

