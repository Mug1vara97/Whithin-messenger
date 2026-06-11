import { useEffect } from 'react';
import { runAppLifecycleCleanup, resetAppLifecycleCleanupGuard } from '../utils/appLifecycleCleanup';

export const useAppLifecycleCleanup = () => {
  useEffect(() => {
    const handleAppExit = () => {
      runAppLifecycleCleanup();
    };

    window.addEventListener('pagehide', handleAppExit);
    window.addEventListener('beforeunload', handleAppExit);

    return () => {
      window.removeEventListener('pagehide', handleAppExit);
      window.removeEventListener('beforeunload', handleAppExit);
      resetAppLifecycleCleanupGuard();
    };
  }, []);
};
