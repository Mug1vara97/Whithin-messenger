import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { applySavedTheme } from './shared/lib/theme/appTheme'
import App from './App.jsx'

applySavedTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
