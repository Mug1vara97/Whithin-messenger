import React, { useEffect } from 'react';
import { AppProviders } from './app/providers';
import { AppRouter } from './app/router';
import ThemeAppRouter from './app/router/ThemeAppRouter';
import { GlobalCallManager } from './shared/ui/organisms';
import { ElectronHotkeysBridge } from './shared/lib/hooks/ElectronHotkeysBridge';
import { ElectronTitlebar } from './shared/ui/molecules/ElectronTitlebar';
import { useGlobalTextScramble } from './shared/lib/hooks/useGlobalTextScramble';
import { useAppLifecycleCleanup } from './shared/lib/hooks/useAppLifecycleCleanup';
import { setupThemeWindowSync } from './shared/lib/theme/appTheme';
import { applyAppBackgroundSettings } from './shared/lib/theme/appBackgroundSettings';
import { applyInterfaceDesign } from './shared/lib/theme/interfaceDesignSettings';
import { isThemeColorsWindow } from './shared/lib/theme/themeWindow';
import { AppBadgeSync } from './shared/lib/hooks/AppBadgeSync';
import './shared/lib/styles/profileOpenTrigger.css';
import './App.css';

function MainApp() {
  useGlobalTextScramble({
    duration: 700,
    fps: 30
  });

  useEffect(() => setupThemeWindowSync(), []);
  useEffect(() => {
    const refreshGlass = () => applyAppBackgroundSettings();
    const refreshDesign = () => {
      applyInterfaceDesign();
      applyAppBackgroundSettings();
    };
    window.addEventListener('themePresetChanged', refreshGlass);
    window.addEventListener('themeColorsChanged', refreshGlass);
    window.addEventListener('interfaceDesignChanged', refreshDesign);
    return () => {
      window.removeEventListener('themePresetChanged', refreshGlass);
      window.removeEventListener('themeColorsChanged', refreshGlass);
      window.removeEventListener('interfaceDesignChanged', refreshDesign);
    };
  }, []);
  useAppLifecycleCleanup();

  return (
    <AppProviders>
      <AppBadgeSync />
      <ElectronTitlebar />
      <ElectronHotkeysBridge />
      <AppRouter />
      <GlobalCallManager />
    </AppProviders>
  );
}

function ThemeColorsApp() {
  useEffect(() => setupThemeWindowSync(), []);
  useEffect(() => {
    const refreshGlass = () => applyAppBackgroundSettings();
    window.addEventListener('themePresetChanged', refreshGlass);
    window.addEventListener('themeColorsChanged', refreshGlass);
    return () => {
      window.removeEventListener('themePresetChanged', refreshGlass);
      window.removeEventListener('themeColorsChanged', refreshGlass);
    };
  }, []);

  return (
    <>
      <ElectronTitlebar showNotifications={false} />
      <ThemeAppRouter />
    </>
  );
}

function App() {
  if (isThemeColorsWindow()) {
    return <ThemeColorsApp />;
  }

  return <MainApp />;
}

export default App;
