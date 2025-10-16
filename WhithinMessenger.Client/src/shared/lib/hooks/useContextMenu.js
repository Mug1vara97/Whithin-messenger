import { useState, useEffect, useCallback } from 'react';

export const useContextMenu = () => {
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    messageId: null,
    isOwnMessage: false,
    canDelete: false,
    type: null
  });

  const [highlightedMessageId, setHighlightedMessageId] = useState(null);

  const handleContextMenu = useCallback((e, messageId, isOwnMessage = false, canDelete = false, type = 'message') => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      messageId: messageId,
      isOwnMessage: isOwnMessage,
      canDelete: canDelete,
      type: type
    });
    setHighlightedMessageId(messageId);
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ 
      visible: false, 
      x: 0, 
      y: 0, 
      messageId: null, 
      isOwnMessage: false, 
      canDelete: false,
      type: null
    });
    setHighlightedMessageId(null);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const contextMenuElement = document.querySelector('.context-menu');
      if (contextMenuElement && !contextMenuElement.contains(e.target)) {
        closeContextMenu();
      }
    };
  
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape') {
        closeContextMenu();
      }
    };
  
    if (contextMenu.visible) {
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
        document.addEventListener('keydown', handleEscapeKey);
      }, 100);
  
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [contextMenu.visible, closeContextMenu]);

  return {
    contextMenu,
    highlightedMessageId,
    handleContextMenu,
    closeContextMenu
  };
};
