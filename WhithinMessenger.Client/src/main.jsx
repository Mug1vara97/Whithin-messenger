import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './shared/ui/atoms/UserAvatar/UserAvatar.css'
import './shared/lib/theme/lightTheme.css'
import { applySavedTheme } from './shared/lib/theme/appTheme'
import { applySavedAppBackgroundSettings } from './shared/lib/theme/appBackgroundSettings'
import { applySavedInterfaceDesign } from './shared/lib/theme/interfaceDesignSettings'
import './shared/lib/theme/system24Design.css'
import './shared/lib/theme/midnightDesign.css'
import './shared/lib/theme/frostedGlass.css'
import { applySiteSeo } from './shared/lib/seo/siteSeo'
import App from './App.jsx'

applySavedTheme()
applySavedInterfaceDesign()
void applySavedAppBackgroundSettings()
applySiteSeo()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
