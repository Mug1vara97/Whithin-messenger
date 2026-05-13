import React, { useEffect, useRef } from 'react';
import { initializeGhostAnimation } from './ghostAnimation';
import './GhostBackground.css';

const GhostBackground = ({
  backgroundOnly = false,
  hideGhost = false,
  zIndex = -1,
  stateKey = 'ghostAnimationInitialized'
}) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    console.log('GhostBackground useEffect called');
    console.log(`window.${stateKey} at start:`, window[stateKey]);

    const cleanupLocalCanvas = () => {
      const localCanvas = container.querySelector('canvas');
      if (localCanvas) {
        localCanvas.remove();
      }
    };

    // Background-only mode for overlays (startup preloader, etc).
    if (backgroundOnly) {
      initializeGhostAnimation(undefined, { hideGhost, container, stateKey });
      return () => {
        console.log('GhostBackground cleanup');
        cleanupLocalCanvas();
        window[stateKey] = false;
      };
    }

    if (window.__startupPreloaderActive) {
      const waitForBoot = window.setInterval(() => {
        if (!window.__startupPreloaderActive && !window[stateKey]) {
          window.clearInterval(waitForBoot);
          initializeGhostAnimation(undefined, { hideGhost, container, stateKey });
        }
      }, 180);
      return () => {
        window.clearInterval(waitForBoot);
      };
    }

    if (window[stateKey]) {
      const retryTimer = window.setInterval(() => {
        if (!window[stateKey]) {
          window.clearInterval(retryTimer);
          initializeGhostAnimation(undefined, { hideGhost, container, stateKey });
        }
      }, 180);
      return () => {
        window.clearInterval(retryTimer);
      };
    }

    initializeGhostAnimation(undefined, { hideGhost, container, stateKey });

    // Cleanup function
    return () => {
      console.log('GhostBackground cleanup');
      cleanupLocalCanvas();
      // Reset the initialization flag
      window[stateKey] = false;
    };
  }, [backgroundOnly, hideGhost, stateKey]);

  return (
    <div
      ref={containerRef}
      className={`ghost-background ${backgroundOnly ? 'ghost-background--background-only' : ''}`}
      style={{ zIndex }}
    >
      {!backgroundOnly && (
        <div className="content fade-in">
          <div className="quote-container">
            <h1 className="quote">Whithin</h1>
          </div>
        </div>
      )}
    </div>
  );
};


export default GhostBackground;
