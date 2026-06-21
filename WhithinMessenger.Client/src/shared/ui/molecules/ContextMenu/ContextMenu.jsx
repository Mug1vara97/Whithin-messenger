import React, { useEffect, useRef, useState, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useClampedMenuPosition } from '../../../lib/hooks/useClampedMenuPosition';
import './ContextMenu.css';

const SUBMENU_HIDE_DELAY_MS = 150;
const SUBMENU_ESTIMATED_WIDTH = 220;
const VIEWPORT_PADDING = 8;

const ContextMenuItem = ({ item, onClose }) => {
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [submenuPosition, setSubmenuPosition] = useState(null);
  const itemRef = useRef(null);
  const submenuRef = useRef(null);
  const hideSubmenuTimeoutRef = useRef(null);
  const hasSubmenu = Boolean(item.submenuItems?.length);

  const clearHideSubmenuTimeout = useCallback(() => {
    if (hideSubmenuTimeoutRef.current) {
      clearTimeout(hideSubmenuTimeoutRef.current);
      hideSubmenuTimeoutRef.current = null;
    }
  }, []);

  const openSubmenu = useCallback(() => {
    if (item.disabled || !hasSubmenu) return;
    clearHideSubmenuTimeout();
    setSubmenuOpen(true);
  }, [clearHideSubmenuTimeout, hasSubmenu, item.disabled]);

  const scheduleHideSubmenu = useCallback(() => {
    clearHideSubmenuTimeout();
    hideSubmenuTimeoutRef.current = window.setTimeout(() => {
      setSubmenuOpen(false);
      setSubmenuPosition(null);
    }, SUBMENU_HIDE_DELAY_MS);
  }, [clearHideSubmenuTimeout]);

  useEffect(() => () => clearHideSubmenuTimeout(), [clearHideSubmenuTimeout]);

  useLayoutEffect(() => {
    if (!submenuOpen || !itemRef.current) {
      setSubmenuPosition(null);
      return undefined;
    }

    const updatePosition = () => {
      if (!itemRef.current) return;

      const itemRect = itemRef.current.getBoundingClientRect();
      const submenuHeight = submenuRef.current?.offsetHeight
        ?? (item.submenuItems.length * 34 + 12);
      const submenuWidth = submenuRef.current?.offsetWidth || SUBMENU_ESTIMATED_WIDTH;

      let left = itemRect.right - 8;
      if (left + submenuWidth > window.innerWidth - VIEWPORT_PADDING) {
        left = itemRect.left - submenuWidth + 8;
      }
      if (left < VIEWPORT_PADDING) {
        left = VIEWPORT_PADDING;
      }

      let top = itemRect.top - 6;
      if (top + submenuHeight > window.innerHeight - VIEWPORT_PADDING) {
        top = window.innerHeight - submenuHeight - VIEWPORT_PADDING;
      }
      if (top < VIEWPORT_PADDING) {
        top = VIEWPORT_PADDING;
      }

      setSubmenuPosition({ left, top });
    };

    updatePosition();
    const rafId = requestAnimationFrame(updatePosition);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [submenuOpen, item.submenuItems]);

  const handleClick = () => {
    if (item.disabled || hasSubmenu) return;
    item.onClick?.();
    onClose();
  };

  const handleSubmenuItemClick = (subItem) => {
    if (subItem.disabled) return;
    subItem.onClick?.();
    onClose();
  };

  const submenuNode = submenuOpen && submenuPosition
    ? createPortal(
      <div
        ref={submenuRef}
        data-context-menu-submenu="true"
        className="context-menu-submenu context-menu-submenu--portal"
        style={{
          position: 'fixed',
          left: submenuPosition.left,
          top: submenuPosition.top,
          zIndex: 10001,
        }}
        onMouseEnter={openSubmenu}
        onMouseLeave={scheduleHideSubmenu}
      >
        {item.submenuItems.map((subItem, subIndex) => (
          <div
            key={`${item.text}-sub-${subIndex}`}
            className={`context-menu-item ${subItem.danger ? 'danger' : ''} ${subItem.disabled ? 'disabled' : ''}`}
            onClick={(event) => {
              event.stopPropagation();
              handleSubmenuItemClick(subItem);
            }}
          >
            {subItem.icon && <span className="context-menu-icon">{subItem.icon}</span>}
            <span className="context-menu-text">{subItem.text}</span>
          </div>
        ))}
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      <div
        ref={itemRef}
        className={`context-menu-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''} ${hasSubmenu ? 'context-menu-item--submenu' : ''}`}
        onClick={handleClick}
        onMouseEnter={openSubmenu}
        onMouseLeave={hasSubmenu ? scheduleHideSubmenu : undefined}
      >
        {item.icon && <span className="context-menu-icon">{item.icon}</span>}
        <span className="context-menu-text">{item.text}</span>
        {item.shortcut && <span className="context-menu-shortcut">{item.shortcut}</span>}
        {item.subtext && <span className="context-menu-subtext">{item.subtext}</span>}
        {(item.hasSubmenu || hasSubmenu) && <span className="context-menu-chevron" aria-hidden>›</span>}
        {item.trailingBadge && (
          <span className="context-menu-badge">{item.trailingBadge}</span>
        )}
      </div>
      {submenuNode}
    </>
  );
};

const ContextMenu = ({
  isOpen,
  position,
  onClose,
  items = [],
}) => {
  const menuRef = useRef(null);
  const clampedPosition = useClampedMenuPosition(isOpen, position, menuRef);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target;
      if (menuRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[data-context-menu-submenu="true"]')) return;
      onClose();
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

  return createPortal(
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        left: clampedPosition.x,
        top: clampedPosition.y,
        zIndex: 10000,
      }}
    >
      {items.map((item, index) => {
        if (item.separator) {
          return <div key={`sep-${index}`} className="context-menu-separator" role="separator" />;
        }

        return <ContextMenuItem key={`${item.text}-${index}`} item={item} onClose={onClose} />;
      })}
    </div>,
    document.body,
  );
};

export default ContextMenu;
