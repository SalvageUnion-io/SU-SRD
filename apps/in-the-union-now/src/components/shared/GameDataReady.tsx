import { Suspense, use, type ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'

/**
 * Suspends until the full SalvageUnionReference dataset is loaded, then sets
 * `body[data-game-data-ready="true"]` so E2E tests can latch onto a stable
 * "ready" signal across every route.
 *
 * Why preload everything: the entity-display layer pulls trait keywords,
 * actions, and other cross-schema references inline. Routes used to preload
 * only what their wizard needed (classes/abilities/equipment for /pilots/new)
 * which left ReferenceEntityDisplay throwing "Schema 'traits' not loaded"
 * when it rendered a chosen entity. A single root-level preload removes the
 * matrix of per-route preload lists and matches the local-first MVP model
 * (the dataset is ~1-2 MB JSON; loading it up front is fine).
 */

let preloadPromise: Promise<unknown> | null = null

function getPreloadPromise(): Promise<unknown> {
  if (!preloadPromise) {
    preloadPromise = SalvageUnionReference.preload('all').then(() => {
      if (typeof document !== 'undefined') {
        document.body.dataset.gameDataReady = 'true'
      }
    })
  }
  return preloadPromise
}

function PreloadGate({ children }: { children: ReactNode }) {
  use(getPreloadPromise())
  return <>{children}</>
}

export function GameDataReady({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-live="polite"
          className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground"
        >
          Loading reference data…
        </div>
      }
    >
      <PreloadGate>{children}</PreloadGate>
    </Suspense>
  )
}
