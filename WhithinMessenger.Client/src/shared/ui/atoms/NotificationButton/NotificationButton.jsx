import React, { useState } from 'react';
import './NotificationButton.css';

const NotificationButton = () => {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [unreadCount] = useState(0);

  const handleClick = () => {
    setIsPanelOpen(!isPanelOpen);
  };

  const handleClose = () => {
    setIsPanelOpen(false);
  };

  return (
    <>
      <button 
        className="notification-button" 
        onClick={handleClick}
        title="Уведомления"
      >
        <svg 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="currentColor"
        >
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
        </svg>
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      
      {/* NotificationPanel будет добавлен позже */}
      {isPanelOpen && (
        <div className="notification-panel">
          <div className="notification-panel-content">
            <h3>Уведомления</h3>
            <p>Нет новых уведомлений</p>
            <button onClick={handleClose}>Закрыть</button>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationButton;
