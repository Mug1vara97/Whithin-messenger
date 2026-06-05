import React, { useEffect } from 'react';
import { AppProviders } from './app/providers';
import { AppRouter } from './app/router';
import { GlobalCallManager } from './shared/ui/organisms';
import { ElectronHotkeysBridge } from './shared/lib/hooks/ElectronHotkeysBridge';
import { useGlobalTextScramble } from './shared/lib/hooks/useGlobalTextScramble';
import { setupThemeWindowSync } from './shared/lib/theme/appTheme';
import './App.css';

const isThemeColorsWindow =
  typeof window !== 'undefined' && window.location.pathname === '/theme-colors';

function App() {
  useGlobalTextScramble({
    duration: 700,
    fps: 30
  });

  useEffect(() => setupThemeWindowSync(), []);

  return (
    <AppProviders>
      {!isThemeColorsWindow && <ElectronHotkeysBridge />}
      <AppRouter />
      {!isThemeColorsWindow && <GlobalCallManager />}
    </AppProviders>
  );
}

export default App;
