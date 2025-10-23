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

    // Load Three.js and other dependencies
    // Load script function (kept for potential future use)
    // const loadScript = (src) => {
    //   return new Promise((resolve, reject) => {
    //     const script = document.createElement('script');
    //     script.src = src;
    //     script.onload = resolve;
    //     script.onerror = reject;
    //     document.head.appendChild(script);
    //   });
    // };

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

    // Load dependencies with multiple CDN fallbacks
    const loadThreeJS = () => {
      return new Promise((resolve, reject) => {
        // Check if Three.js is already loaded
        if (typeof window.THREE !== 'undefined') {
          console.log('Three.js already loaded');
          resolve();
          return;
        }
        
        // Try multiple CDNs
        const cdnUrls = [
          'https://unpkg.com/three@0.158.0/build/three.min.js',
          'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js',
          'https://cdnjs.cloudflare.com/ajax/libs/three.js/r158/three.min.js'
        ];
        
        let currentIndex = 0;
        
        const tryLoad = () => {
          if (currentIndex >= cdnUrls.length) {
            reject(new Error('All CDNs failed'));
            return;
          }
          
          const script = document.createElement('script');
          script.src = cdnUrls[currentIndex];
          script.onload = () => {
            console.log(`Three.js loaded from: ${cdnUrls[currentIndex]}`);
            resolve();
          };
          script.onerror = () => {
            console.log(`Failed to load from: ${cdnUrls[currentIndex]}`);
            currentIndex++;
            tryLoad();
          };
          document.head.appendChild(script);
        };
        
        tryLoad();
      });
    };

    Promise.all([
      loadThreeJS(),
      loadStylesheet('https://fonts.googleapis.com/css2?family=Boldonse&display=swap')
    ]).then(() => {
      console.log('Dependencies loaded successfully');
      preloader.updateProgress(2);
      
      // Check if Three.js is available
      if (typeof window.THREE === 'undefined') {
        console.error('Three.js failed to load');
        // Show fallback animation
        showFallbackAnimation();
        setTimeout(() => {
          preloader.complete();
        }, 2000);
        return;
      }
      
      console.log('Three.js loaded, initializing animation...');
      console.log('window.ghostAnimationInitialized before call:', window.ghostAnimationInitialized);
      // Animation is already initialized in the module, just complete preloader
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
    }).catch(error => {
      console.error('Error loading dependencies:', error);
      // Show fallback animation
      showFallbackAnimation();
      // Fallback: complete preloader anyway
      setTimeout(() => {
        preloader.complete();
      }, 2000);
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

  // Fallback animation function
  const showFallbackAnimation = () => {
    console.log('Showing fallback animation');
    const container = document.querySelector('.ghost-background');
    if (container) {
      // Create a simple CSS animation fallback
      const fallbackDiv = document.createElement('div');
      fallbackDiv.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 100px;
        height: 100px;
        background: radial-gradient(circle, rgba(255, 69, 0, 0.3) 0%, transparent 70%);
        border-radius: 50%;
        animation: fallbackPulse 2s ease-in-out infinite;
        z-index: 1;
      `;
      
      // Add CSS animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes fallbackPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; }
          50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.6; }
        }
      `;
      document.head.appendChild(style);
      container.appendChild(fallbackDiv);
    }
  };

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
            Veil of Dust<br />
            Trail of Ash<br />
            Heart of Ice
          </h1>
          <span className="author">Whispers through memory</span>
        </div>
      </div>
    </div>
  );
};


export default GhostBackground;
