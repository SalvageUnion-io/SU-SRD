/**
 * The Discord Activity's entry (`astro/pages/activity/index.astro`). Before
 * anything reaches the network, the frame's requests to the art host are
 * rewritten to the `/art` URL Mapping: Discord's proxy blocks every host it
 * does not map.
 */

import { patchUrlMappings } from '@discord/embedded-app-sdk'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initBrowserObservability } from '../lib/observability'
import { ActivityApp } from './ActivityApp'
import { ART_MAPPING, launchOf } from './activitySession'

initBrowserObservability()

const launch = launchOf(window.location.search)
if (launch !== null) patchUrlMappings([ART_MAPPING])

const root = document.getElementById('activity')
if (root !== null)
  createRoot(root).render(
    <StrictMode>
      <ActivityApp launch={launch} />
    </StrictMode>
  )
