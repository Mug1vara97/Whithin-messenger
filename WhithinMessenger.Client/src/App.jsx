import React from 'react';
import { AppProviders } from './app/providers';
import { AppRouter } from './app/router';
import { GlobalCallManager } from './shared/ui/organisms';
import { useGlobalTextScramble } from './shared/lib/hooks/useGlobalTextScramble';
import './App.css';

function App() {
  useGlobalTextScramble({
    duration: 700,
    fps: 30
  });

  return (
    <AppProviders>
      <AppRouter />
      <GlobalCallManager />
    </AppProviders>
  );
}

export default App;
