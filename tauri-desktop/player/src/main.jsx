import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initRemote } from './lib/remote';
import { initSnow } from './lib/snow';
import { initTheme } from './lib/theme';
import './elastic-slider.css';
import './styles.css';

initTheme();
initRemote();
initSnow();
createRoot(document.getElementById('root')).render(<App />);
