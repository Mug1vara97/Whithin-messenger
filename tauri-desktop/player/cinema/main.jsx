import { createRoot } from 'react-dom/client';
import { initTheme } from '../src/lib/theme';
import { App } from './App';
import '../src/styles.css';
import '../src/elastic-slider.css';
import './cinema.css';

initTheme();
createRoot(document.getElementById('root')).render(<App />);
