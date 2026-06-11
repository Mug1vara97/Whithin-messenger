import { useEffect, useState } from 'react';

export const BANNER_AUTO_DISMISS_MS = 3 * 60 * 1000;

export function useDismissibleCallBanners(error, audioBlocked) {
  const [dismissedError, setDismissedError] = useState(false);
  const [dismissedAudioBlocked, setDismissedAudioBlocked] = useState(false);

  useEffect(() => {
    setDismissedError(false);
  }, [error]);

  useEffect(() => {
    setDismissedAudioBlocked(false);
  }, [audioBlocked]);

  useEffect(() => {
    if (!error || dismissedError) return undefined;
    const timer = setTimeout(() => setDismissedError(true), BANNER_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [error, dismissedError]);

  useEffect(() => {
    if (!audioBlocked || dismissedAudioBlocked) return undefined;
    const timer = setTimeout(() => setDismissedAudioBlocked(true), BANNER_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [audioBlocked, dismissedAudioBlocked]);

  return {
    showErrorBanner: Boolean(error) && !dismissedError,
    showAudioBlockedBanner: Boolean(audioBlocked) && !dismissedAudioBlocked,
    setDismissedError,
    setDismissedAudioBlocked
  };
}

export async function enableCallAudioPlayback() {
  const audioElements = document.querySelectorAll('audio');
  for (const audio of audioElements) {
    try {
      await audio.play();
    } catch (e) {
      console.log('Failed to play audio:', e);
    }
  }
}
