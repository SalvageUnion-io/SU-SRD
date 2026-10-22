import type { ReactNode } from 'react'
import { useLayoutEffect } from 'react'
import { preloadGameData } from '../../lib/useGameData'
import { sharedCopy } from '../../messages/components-shared'
import { GameDataGate } from '../GameDataGate'
import type { EntitySurfaceValue } from '../index'
import { EntitySurfaceProvider } from '../index'
import { RoutePending } from './RouteFallbacks'
import { srdEntityExternalLink } from './srdEntityExternalLink'

/*
 * The full dataset's preload, started at MODULE SCOPE, not on first render.
 *
 * Started inside a component, the fetch would wait for React to boot, mount
 * the provider tree and render down to the gate: dead time on the critical
 * path. At module scope it overlaps React's bootstrap and the rest of the
 * entry chunk. It is the gate's own keyed preload (`useGameData`), so the gate
 * and the bar's controls (`useGameData().ready`) share this one request.
 */
void preloadGameData('all', 'full')

/** The app's "View in the Reference" cross-link, on the surface (E13). */
const REFERENCE_LINK: Partial<EntitySurfaceValue> = { externalLink: srdEntityExternalLink }

/**
 * Marks `body[data-game-data-ready="true"]` once the gate has opened, so E2E
 * tests can latch onto one "ready" signal across every route.
 */
function ReadyMarker() {
  useLayoutEffect(() => {
    document.body.dataset.gameDataReady = 'true'
  }, [])
  return null
}

/**
 * Holds every route behind `GameDataGate` until the full SalvageUnionReference
 * dataset is loaded, a route's wait (`RoutePending`) while it loads.
 *
 * Everything, not a per-route list: the entity-display layer pulls trait
 * keywords, actions and other cross-schema references inline, so a preload of
 * only what a wizard needs leaves ReferenceEntityCard throwing "Schema 'traits'
 * not loaded" when it renders a chosen entity. The dataset is ~1-2 MB of static
 * JSON; docs/ARCHITECTURE.md#data-flow has the fuller rationale.
 *
 * Off the critical rendering path: this wraps only `<Outlet />` in
 * routes/__root.tsx; the bar's search reads its own compact index. The Union bar (brand chrome, no
 * reference data) is the shell's, outside the app's root altogether, so it
 * paints before the app boots. A non-blocking preload would need every
 * ORM-touching component to tolerate a not-ready state. One trade-off: the
 * wait sizes itself to the full dynamic viewport height, so while the bar
 * shows it overshoots by the bar's height for the brief loading window, rather
 * than measuring the bar for a cosmetic fix.
 */
export function GameDataReady({ children }: { children: ReactNode }) {
  // App-wide "View in the Reference" cross-link injection: full
  // entity cards and detail modals render srdEntityExternalLink in their foot
  // band. Provided here — beside the preload gate that already wraps every
  // route — so the builder only runs once the reference dataset is loaded.
  return (
    <GameDataGate fallback={<RoutePending label={sharedCopy('referenceData')} />}>
      <ReadyMarker />
      <EntitySurfaceProvider value={REFERENCE_LINK}>{children}</EntitySurfaceProvider>
    </GameDataGate>
  )
}
