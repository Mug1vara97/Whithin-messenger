import React from 'react';
import { CallBannerStack } from './CallBannerStack';
import { VoiceCallHeader } from './VoiceCallHeader';
import { VoiceCallControlDock } from './VoiceCallControlDock';
import './voiceCallChrome.css';

export function VoiceCallChromeOverlay({
  title,
  showHeader = true,
  compactBanners = false,
  error,
  showErrorBanner,
  showAudioBlockedBanner,
  onDismissError,
  onDismissAudioBlocked,
  controlProps
}) {
  return (
    <div className={`voice-call-chrome video-controls${showHeader ? '' : ' video-controls--no-header'}`}>
      {showHeader && <div className="gradient-top" />}
      <div className="gradient-bottom" />

      {showHeader && <VoiceCallHeader title={title} />}

      <CallBannerStack
        error={error}
        showErrorBanner={showErrorBanner}
        showAudioBlockedBanner={showAudioBlockedBanner}
        onDismissError={onDismissError}
        onDismissAudioBlocked={onDismissAudioBlocked}
        compact={compactBanners}
      />

      <VoiceCallControlDock {...controlProps} />
    </div>
  );
}
