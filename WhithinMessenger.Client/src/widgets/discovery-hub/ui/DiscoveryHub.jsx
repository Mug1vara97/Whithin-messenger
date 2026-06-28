import React, { useEffect, useState } from 'react';
import DiscoverySidebar from './DiscoverySidebar';
import DiscoveryMainPanel from './DiscoveryMainPanel';
import { DISCOVERY_TAB } from './discoveryConstants';

/** Standalone layout (sidebar + main). HomePage uses split placement instead. */
const DiscoveryHub = ({
  initialTab = DISCOVERY_TAB.SERVERS,
  onServerSelected,
  onClose,
}) => {
  const [activeSection, setActiveSection] = useState(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setActiveSection(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setSearchQuery('');
  }, [activeSection]);

  return (
    <div className="discovery-hub-standalone">
      <DiscoverySidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onClose={onClose}
      />
      <DiscoveryMainPanel
        activeSection={activeSection}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onServerSelected={onServerSelected}
        onClose={onClose}
        onSectionChange={setActiveSection}
      />
    </div>
  );
};

export default DiscoveryHub;
export { DISCOVERY_TAB } from './discoveryConstants';
