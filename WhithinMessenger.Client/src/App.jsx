import React, { useEffect } from 'react';
import { AppProviders } from './app/providers';
import { AppRouter } from './app/router';
import ThemeAppRouter from './app/router/ThemeAppRouter';
import { GlobalCallManager } from './shared/ui/organisms';
import { ElectronHotkeysBridge } from './shared/lib/hooks/ElectronHotkeysBridge';
import { useGlobalTextScramble } from './shared/lib/hooks/useGlobalTextScramble';
import { useAppLifecycleCleanup } from './shared/lib/hooks/useAppLifecycleCleanup';
import { setupThemeWindowSync } from './shared/lib/theme/appTheme';
import { isThemeColorsWindow } from './shared/lib/theme/themeWindow';
import './App.css';

function MainApp() {
  useGlobalTextScramble({
    duration: 700,
    fps: 30
  });

  useEffect(() => setupThemeWindowSync(), []);
  useAppLifecycleCleanup();

  return (
    <AppProviders>
      <ElectronHotkeysBridge />
      <AppRouter />
      <GlobalCallManager />
    </AppProviders>
  );
}

function ThemeColorsApp() {
  useEffect(() => setupThemeWindowSync(), []);

  return <ThemeAppRouter />;
}

function App() {
  if (isThemeColorsWindow()) {
    return <ThemeColorsApp />;
  }

  return <MainApp />;
}

export default App;
