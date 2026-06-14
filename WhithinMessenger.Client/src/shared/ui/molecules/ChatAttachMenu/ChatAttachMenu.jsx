import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AttachFile,
  Image as ImageIcon,
  InsertDriveFile,
  PollOutlined,
} from '@mui/icons-material';
import { clampMenuPosition } from '../../../lib/utils/clampMenuPosition';
import './ChatAttachMenu.css';

const MENU_HIDE_DELAY_MS = 160;
const MENU_GAP_PX = 8;
const VIEWPORT_PADDING = 8;

export function ChatAttachMenu({
  disabled = false,
  onMediaSelect,
  onDocumentSelect,
  onPollClick,
  onDefaultClick,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const hideTimerRef = useRef(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const mediaInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const defaultInputRef = useRef(null);
  const suppressNextClickRef = useRef(false);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    clearHideTimer();
    setMenuOpen(true);
  }, [clearHideTimer, disabled]);

  const scheduleHideMenu = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      setMenuOpen(false);
    }, MENU_HIDE_DELAY_MS);
  }, [clearHideTimer]);

  const updateDropdownPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const dropdown = dropdownRef.current;
    if (!trigger || !dropdown) return;

    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = dropdown.getBoundingClientRect();
    const menuWidth = menuRect.width || dropdown.offsetWidth || 210;
    const menuHeight = menuRect.height || dropdown.offsetHeight || 160;

    let x = triggerRect.left;
    let y = triggerRect.top - menuHeight - MENU_GAP_PX;

    if (x + menuWidth > window.innerWidth - VIEWPORT_PADDING) {
      x = triggerRect.right - menuWidth;
    }

    const clamped = clampMenuPosition(x, y, menuWidth, menuHeight, VIEWPORT_PADDING);

    setDropdownStyle({
      top: clamped.y,
      left: clamped.x,
      visibility: 'visible',
    });
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) {
      setDropdownStyle(null);
      return undefined;
    }

    updateDropdownPosition();

    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);

    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [menuOpen, updateDropdownPosition]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  const handleButtonClick = () => {
    if (disabled) return;
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    defaultInputRef.current?.click();
    onDefaultClick?.();
  };

  const handleMenuMouseEnter = () => {
    clearHideTimer();
    setMenuOpen(true);
  };

  const handleRootMouseLeave = () => {
    scheduleHideMenu();
  };

  const handleMediaPick = (event) => {
    if (event.target.files?.length) {
      onMediaSelect?.(event.target.files);
    }
    event.target.value = '';
    setMenuOpen(false);
  };

  const handleDocumentPick = (event) => {
    if (event.target.files?.length) {
      onDocumentSelect?.(event.target.files);
    }
    event.target.value = '';
    setMenuOpen(false);
  };

  const handleDefaultPick = (event) => {
    if (event.target.files?.length) {
      onMediaSelect?.(event.target.files);
    }
    event.target.value = '';
  };

  const handlePollClick = () => {
    suppressNextClickRef.current = true;
    setMenuOpen(false);
    onPollClick?.();
  };

  const dropdown = menuOpen
    ? createPortal(
        <div
          ref={dropdownRef}
          className="chat-attach-menu__dropdown"
          style={dropdownStyle ?? { visibility: 'hidden' }}
          role="menu"
          onMouseEnter={handleMenuMouseEnter}
          onMouseLeave={scheduleHideMenu}
        >
          <button
            type="button"
            className="chat-attach-menu__item"
            role="menuitem"
            onClick={() => mediaInputRef.current?.click()}
          >
            <ImageIcon fontSize="small" />
            <span>Фото или видео</span>
          </button>
          <button
            type="button"
            className="chat-attach-menu__item"
            role="menuitem"
            onClick={() => documentInputRef.current?.click()}
          >
            <InsertDriveFile fontSize="small" />
            <span>Документ</span>
          </button>
          <button
            type="button"
            className="chat-attach-menu__item"
            role="menuitem"
            onClick={handlePollClick}
          >
            <PollOutlined fontSize="small" />
            <span>Опрос</span>
          </button>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div
        ref={rootRef}
        className={`chat-attach-menu${menuOpen ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`}
        onMouseEnter={openMenu}
        onMouseLeave={handleRootMouseLeave}
      >
        <input
          ref={defaultInputRef}
          type="file"
          multiple
          className="chat-attach-menu__input"
          onChange={handleDefaultPick}
        />
        <input
          ref={mediaInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="chat-attach-menu__input"
          onChange={handleMediaPick}
        />
        <input
          ref={documentInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.zip,.rar,.7z,.xls,.xlsx,.ppt,.pptx,application/*"
          className="chat-attach-menu__input"
          onChange={handleDocumentPick}
        />

        <button
          ref={triggerRef}
          type="button"
          className="media-button chat-attach-menu__trigger"
          disabled={disabled}
          onClick={handleButtonClick}
          title="Прикрепить файл"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <AttachFile />
        </button>
      </div>
      {dropdown}
    </>
  );
}

export default ChatAttachMenu;
