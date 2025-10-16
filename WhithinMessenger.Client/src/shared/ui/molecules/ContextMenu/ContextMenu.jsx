import React, { useEffect, useRef } from 'react';
import './ContextMenu.css';

const ContextMenu = ({ 
  isOpen, 
  position, 
  onClose, 
  items = [] 
}) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 1000
      }}
    >
      {items.map((item, index) => (
        <div
          key={index}
          className={`context-menu-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''}`}
          onClick={() => {
            if (!item.disabled && item.onClick) {
              item.onClick();
              onClose();
            }
          }}
        >
          {item.icon && <span className="context-menu-icon">{item.icon}</span>}
          <span className="context-menu-text">{item.text}</span>
          {item.shortcut && <span className="context-menu-shortcut">{item.shortcut}</span>}
        </div>
      ))}
    </div>
  );
};

export default ContextMenu;
