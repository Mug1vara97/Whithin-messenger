import React from 'react';
import { AppProviders } from './app/providers';
import { AppRouter } from './app/router';
import { GlobalCallManager } from './shared/ui/organisms';
import './App.css';

function App() {
  return (
    <AppProviders>
      <AppRouter />
      <GlobalCallManager />
    </AppProviders>
  );
}

export default App;
