import React, { useCallback, useEffect, useRef, useState } from 'react';
import { sidebarPanelWidthStorage } from '../../../lib/utils/sidebarPanelWidthStorage';
import './ResizableSidebarShell.css';

const ResizableSidebarShell = ({ children }) => {
  const [width, setWidth] = useState(() => sidebarPanelWidthStorage.get());
  const widthRef = useRef(width);
  const resizingRef = useRef(false);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  const handleMouseDown = useCallback((event) => {
    event.preventDefault();
    resizingRef.current = true;
    const startX = event.clientX;
    const startWidth = widthRef.current;

    const handleMouseMove = (moveEvent) => {
      const next = sidebarPanelWidthStorage.set(startWidth + moveEvent.clientX - startX);
      widthRef.current = next;
      setWidth(next);
    };

    const handleMouseUp = () => {
      resizingRef.current = false;
      sidebarPanelWidthStorage.set(widthRef.current);
      document.body.classList.remove('resizable-sidebar-shell--resizing');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.body.classList.add('resizable-sidebar-shell--resizing');
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  return (
    <div
      className="resizable-sidebar-shell"
      style={{
        width: `${width}px`,
        '--sidebar-panel-width': `${width}px`,
      }}
    >
      <div className="resizable-sidebar-shell__content">{children}</div>
      <div
        className="resizable-sidebar-shell__handle"
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Изменить ширину панели"
        title="Потяните, чтобы изменить ширину"
      />
    </div>
  );
};

export default ResizableSidebarShell;
