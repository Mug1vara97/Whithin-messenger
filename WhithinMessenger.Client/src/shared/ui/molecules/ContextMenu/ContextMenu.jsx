import React, { useEffect, useRef } from 'react';
import { useClampedMenuPosition } from '../../../lib/hooks/useClampedMenuPosition';
import './ContextMenu.css';

const ContextMenu = ({ 
  isOpen, 
  position, 
  onClose, 
  items = [] 
}) => {
  const menuRef = useRef(null);
  const clampedPosition = useClampedMenuPosition(isOpen, position, menuRef);

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

  if (!isOpen || items.length === 0) return null;

  return (
    <div 
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        left: clampedPosition.x,
        top: clampedPosition.y,
        zIndex: 1000
      }}
    >
      {items.map((item, index) => {
        if (item.separator) {
          return <div key={`sep-${index}`} className="context-menu-separator" role="separator" />;
        }

        return (
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
            {item.hasSubmenu && <span className="context-menu-chevron" aria-hidden>›</span>}
            {item.trailingBadge && (
              <span className="context-menu-badge">{item.trailingBadge}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ContextMenu;
