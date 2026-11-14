import { createRoot } from 'react-dom/client';
import { initTheme } from '../src/lib/theme';
import { MiniPlayer } from './MiniPlayer';
import '../src/elastic-slider.css';
import './mini.css';

initTheme();
createRoot(document.getElementById('root')).render(<MiniPlayer />);
