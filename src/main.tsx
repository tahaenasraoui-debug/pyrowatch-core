import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PyroWatchCore from './PyroWatchCore'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PyroWatchCore />
  </StrictMode>,
)
