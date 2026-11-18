import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { registerServiceWorker, requestPersistentStorage } from './app/pwa'
import './ui/styles.css'

registerServiceWorker()
// Ask the browser to keep our games and puzzle history even when space is short.
void requestPersistentStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
