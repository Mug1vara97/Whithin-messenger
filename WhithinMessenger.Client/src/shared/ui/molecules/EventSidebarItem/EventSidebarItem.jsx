import React from 'react';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import './EventSidebarItem.css';

const EventSidebarItem = ({
  event,
  isActive = false,
  onClick,
}) => {
  if (!event) return null;

  const handleClick = () => {
    onClick?.(event);
  };

  return (
    <div
      className={`channel-item event-sidebar-item ${isActive ? 'active' : ''}`}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      title={event.title}
    >
      <span className="channel-icon" aria-hidden="true">
        <EventAvailableOutlinedIcon sx={{ fontSize: 16, width: 16, height: 16 }} />
      </span>
      <span className="channel-name">{event.title}</span>
    </div>
  );
};

export default EventSidebarItem;
