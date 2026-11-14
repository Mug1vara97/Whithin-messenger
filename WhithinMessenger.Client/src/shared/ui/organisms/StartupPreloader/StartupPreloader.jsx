import React, { useEffect, useRef } from 'react';
import { alignPreloaderLoopAnimations, createD20Scene } from './d20Scene';
import './StartupPreloader.css';

const StartupPreloader = ({ isExiting = false, loadingText = 'Booting Whithin' }) => {
  const rootRef = useRef(null);
  const viewportRef = useRef(null);

  useEffect(() => {
    window.__startupPreloaderActive = true;
    alignPreloaderLoopAnimations(rootRef.current);
    const viewport = viewportRef.current;
    if (!viewport) {
      return () => {
        window.__startupPreloaderActive = false;
      };
    }

    const d20 = createD20Scene(viewport);
    window.addEventListener('themePresetChanged', d20.applyTheme);

    return () => {
      window.__startupPreloaderActive = false;
      window.removeEventListener('themePresetChanged', d20.applyTheme);
      d20.destroy();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`startup-preloader ${isExiting ? 'is-exiting' : ''}`}
      data-nosnippet
    >
      <div className="startup-preloader__noise" />
      <div className="startup-preloader__scanlines" />

      <div className="startup-preloader__panel">
        <div ref={viewportRef} className="startup-preloader__viewport" aria-hidden="true" />

        <h1 className="startup-preloader__title">Whithin</h1>
        <p className="startup-preloader__subtitle">{loadingText}</p>
        <div className="startup-preloader__progress">
          <span />
        </div>
      </div>
    </div>
  );
};

export default StartupPreloader;
