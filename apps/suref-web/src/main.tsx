import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-start/client'
import './index.css'

hydrateRoot(
  document,
  <StrictMode>
    <StartClient />
  </StrictMode>
)
