import React from 'react';
import { enableCallAudioPlayback } from './useDismissibleCallBanners';
import './voiceCallChrome.css';

export function CallBannerStack({
  error,
  showErrorBanner,
  showAudioBlockedBanner,
  onDismissError,
  onDismissAudioBlocked,
  compact = false
}) {
  if (!showErrorBanner && !showAudioBlockedBanner) {
    return null;
  }

  return (
    <div
      className={`call-banner-stack ${compact ? 'call-banner-stack--compact' : ''}`}
      role="status"
      aria-live="polite"
    >
      {showErrorBanner && (
        <div className="error-banner call-banner-overlay">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <span className="call-banner-message">{error}</span>
          <button type="button" className="call-banner-dismiss" onClick={onDismissError}>
            Ок
          </button>
        </div>
      )}

      {showAudioBlockedBanner && (
        <div className="audio-blocked-banner call-banner-overlay">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <div className="audio-blocked-text">
            <strong>Браузер заблокировал автовоспроизведение</strong>
            <span>Нажмите кнопку ниже, чтобы разрешить воспроизведение звука</span>
            <button className="enable-audio-btn" type="button" onClick={enableCallAudioPlayback}>
              Разрешить воспроизведение
            </button>
          </div>
          <button
            type="button"
            className="call-banner-dismiss call-banner-dismiss-dark"
            onClick={onDismissAudioBlocked}
          >
            Ок
          </button>
        </div>
      )}
    </div>
  );
}
