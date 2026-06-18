import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './shared/ui/atoms/UserAvatar/UserAvatar.css'
import './shared/lib/theme/lightTheme.css'
import { applySavedTheme } from './shared/lib/theme/appTheme'
import { applySiteSeo } from './shared/lib/seo/siteSeo'
import App from './App.jsx'

applySavedTheme()
applySiteSeo()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
