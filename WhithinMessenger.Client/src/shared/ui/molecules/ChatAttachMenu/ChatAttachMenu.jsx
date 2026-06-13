import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AttachFile,
  Image as ImageIcon,
  InsertDriveFile,
  PollOutlined,
} from '@mui/icons-material';
import './ChatAttachMenu.css';

const MENU_HIDE_DELAY_MS = 160;

export function ChatAttachMenu({
  disabled = false,
  onMediaSelect,
  onDocumentSelect,
  onPollClick,
  onDefaultClick,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const hideTimerRef = useRef(null);
  const rootRef = useRef(null);
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

  return (
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

      {menuOpen && (
        <div
          className="chat-attach-menu__dropdown"
          role="menu"
          onMouseEnter={handleMenuMouseEnter}
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
        </div>
      )}
    </div>
  );
}

export default ChatAttachMenu;
