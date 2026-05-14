import React from 'react';
import { AppProviders } from './app/providers';
import { AppRouter } from './app/router';
import { GlobalCallManager } from './shared/ui/organisms';
import { ElectronHotkeysBridge } from './shared/lib/hooks/ElectronHotkeysBridge';
import { useGlobalTextScramble } from './shared/lib/hooks/useGlobalTextScramble';
import './App.css';

function App() {
  useGlobalTextScramble({
    duration: 700,
    fps: 30
  });

  return (
    <AppProviders>
      <ElectronHotkeysBridge />
      <AppRouter />
      <GlobalCallManager />
    </AppProviders>
  );
}

export default App;
