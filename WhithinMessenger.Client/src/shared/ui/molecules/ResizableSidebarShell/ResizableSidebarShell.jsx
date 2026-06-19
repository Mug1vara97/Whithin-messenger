import React, { useCallback, useEffect, useRef, useState } from 'react';
import { sidebarPanelWidthStorage } from '../../../lib/utils/sidebarPanelWidthStorage';
import './ResizableSidebarShell.css';

const ResizableSidebarShell = ({
  children,
  widthStorage = sidebarPanelWidthStorage,
  handleEdge = 'right',
}) => {
  const [width, setWidth] = useState(() => widthStorage.get());
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
      const delta =
        handleEdge === 'left'
          ? startX - moveEvent.clientX
          : moveEvent.clientX - startX;
      const next = widthStorage.set(startWidth + delta);
      widthRef.current = next;
      setWidth(next);
    };

    const handleMouseUp = () => {
      resizingRef.current = false;
      widthStorage.set(widthRef.current);
      document.body.classList.remove('resizable-sidebar-shell--resizing');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.body.classList.add('resizable-sidebar-shell--resizing');
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [handleEdge, widthStorage]);

  return (
    <div
      className="resizable-sidebar-shell"
      style={{
        width: `${width}px`,
        '--sidebar-panel-width': `${width}px`,
      }}
    >
      {handleEdge === 'left' && (
        <div
          className="resizable-sidebar-shell__handle resizable-sidebar-shell__handle--left"
          onMouseDown={handleMouseDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="Изменить ширину панели участников"
          title="Потяните, чтобы изменить ширину"
        />
      )}
      <div className="resizable-sidebar-shell__content">{children}</div>
      {handleEdge === 'right' && (
        <div
          className="resizable-sidebar-shell__handle"
          onMouseDown={handleMouseDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="Изменить ширину панели"
          title="Потяните, чтобы изменить ширину"
        />
      )}
    </div>
  );
};

export default ResizableSidebarShell;
