import React, { useEffect, useRef } from 'react';
import { initializeGhostAnimation } from './ghostAnimation';
import './GhostBackground.css';

const GhostBackground = () => {
  const preloaderRef = useRef(null);
  const mainContentRef = useRef(null);

  useEffect(() => {
    console.log('GhostBackground useEffect called');
    console.log('window.ghostAnimationInitialized at start:', window.ghostAnimationInitialized);
    
    // Prevent multiple initializations
    if (window.ghostAnimationInitialized) {
      console.log('Ghost animation already initialized, skipping...');
      return;
    }
    // Don't set the flag here, let the animation module handle it
    console.log('Starting ghost animation initialization...');

    // Preloader management
    class PreloaderManager {
      constructor() {
        this.preloader = preloaderRef.current;
        this.mainContent = mainContentRef.current;
        this.progressBar = document.querySelector(".progress-bar");
        this.loadingSteps = 0;
        this.totalSteps = 5;
        this.isComplete = false;
      }

      updateProgress(step) {
        this.loadingSteps = Math.min(step, this.totalSteps);
        const percentage = (this.loadingSteps / this.totalSteps) * 100;
        if (this.progressBar) {
          this.progressBar.style.width = `${percentage}%`;
        }
      }

      complete(canvas) {
        if (this.isComplete) return;
        this.isComplete = true;

        this.updateProgress(this.totalSteps);

        setTimeout(() => {
          if (this.preloader) {
            this.preloader.classList.add("fade-out");
          }
          if (this.mainContent) {
            this.mainContent.classList.add("fade-in");
          }
          if (canvas) {
            canvas.classList.add("fade-in");
          }

          setTimeout(() => {
            if (this.preloader) {
              this.preloader.style.display = "none";
            }
          }, 1000);
        }, 1500);
      }
    }

    // Initialize preloader
    const preloader = new PreloaderManager();
    preloader.updateProgress(1);

    // Load dependencies (just fonts, three.js is now bundled)
    const loadStylesheet = (href) => {
      return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.onload = resolve;
        link.onerror = reject;
        document.head.appendChild(link);
      });
    };

    // Load fonts and initialize animation
    loadStylesheet('https://fonts.googleapis.com/css2?family=Boldonse&display=swap')
      .then(() => {
        console.log('Fonts loaded successfully');
        preloader.updateProgress(2);
        
        console.log('Initializing ghost animation...');
        console.log('window.ghostAnimationInitialized before call:', window.ghostAnimationInitialized);
        
        // Initialize the ghost animation
        initializeGhostAnimation(preloader);
        console.log('window.ghostAnimationInitialized after call:', window.ghostAnimationInitialized);
        
        // Check if canvas was created after a short delay
        setTimeout(() => {
          const canvas = document.querySelector('.ghost-background canvas');
          if (canvas) {
            console.log('Canvas found in DOM:', canvas);
            console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
            console.log('Canvas parent:', canvas.parentElement);
          } else {
            console.log('Canvas not found in DOM');
          }
        }, 1000);
      })
      .catch(error => {
        console.error('Error loading fonts:', error);
        // Even if fonts fail, initialize animation
        preloader.updateProgress(2);
        initializeGhostAnimation(preloader);
      });

    // Cleanup function
    return () => {
      console.log('GhostBackground cleanup');
      // Remove any existing canvas elements
      const existingCanvas = document.querySelector('.ghost-background canvas');
      if (existingCanvas) {
        existingCanvas.remove();
      }
      // Reset the initialization flag
      window.ghostAnimationInitialized = false;
    };
  }, []);

  return (
    <div className="ghost-background">
      {/* Preloader */}
      <div id="preloader" className="preloader" ref={preloaderRef}>
        <div className="preloader-content">
          <div className="ghost-loader">
            <svg className="ghost-svg" height="80" viewBox="0 0 512 512" width="80" xmlns="http://www.w3.org/2000/svg">
              {/* Ghost body - white */}
              <path className="ghost-body" d="m508.374 432.802s-46.6-39.038-79.495-275.781c-8.833-87.68-82.856-156.139-172.879-156.139-90.015 0-164.046 68.458-172.879 156.138-32.895 236.743-79.495 275.782-79.495 275.782-15.107 25.181 20.733 28.178 38.699 27.94 35.254-.478 35.254 40.294 70.516 40.294 35.254 0 35.254-35.261 70.508-35.261s37.396 45.343 72.65 45.343 37.389-45.343 72.651-45.343c35.254 0 35.254 35.261 70.508 35.261s35.27-40.772 70.524-40.294c17.959.238 53.798-2.76 38.692-27.94z" fill="white" />
              {/* Left eye - black with pulsing animation */}
              <circle className="ghost-eye left-eye" cx="208" cy="225" r="22" fill="black" />
              {/* Right eye - black with pulsing animation */}
              <circle className="ghost-eye right-eye" cx="297" cy="225" r="22" fill="black" />
            </svg>
          </div>
          <div className="loading-text">Summoning spirits</div>
          <div className="loading-progress">
            <div className="progress-bar"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="content" id="main-content" ref={mainContentRef}>
        <div className="quote-container">
          <h1 className="quote">
            Whithin
          </h1>
        </div>
      </div>
    </div>
  );
};


export default GhostBackground;
