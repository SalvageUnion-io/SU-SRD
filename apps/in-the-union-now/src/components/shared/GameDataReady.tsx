import { Suspense, use, type ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntityExternalLinkProvider } from 'suref-react'

import { srdEntityExternalLink } from '../contextual/srdEntityExternalLink'

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

/**
 * Branded full-viewport loading fallback (design-spec brand chrome): SU mark
 * on the su-ink-dark ground with an indeterminate rust loader bar. The status
 * text stays in the accessibility tree for screen readers.
 */
function GameDataFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-su-ink-dark px-6"
    >
      <img
        src="/logos/su-cargo-dark.svg"
        alt=""
        width={96}
        height={96}
        className="size-20 rounded-xl sm:size-24"
      />
      <p className="font-cond text-sm font-semibold uppercase tracking-[0.22em] text-su-paper">
        Loading reference data…
      </p>
      <div aria-hidden="true" className="h-1 w-56 overflow-hidden rounded-full bg-su-paper/20">
        <div className="animate-loader-slide h-full w-1/3 rounded-full bg-rust" />
      </div>
    </div>
  )
}

export function GameDataReady({ children }: { children: ReactNode }) {
  // App-wide "View in SRD →" cross-link injection (design review P-3): full
  // entity cards and detail modals render srdEntityExternalLink in their foot
  // band. Provided here — beside the preload gate that already wraps every
  // route — so the builder only runs once the reference dataset is loaded.
  return (
    <Suspense fallback={<GameDataFallback />}>
      <PreloadGate>
        <EntityExternalLinkProvider value={srdEntityExternalLink}>
          {children}
        </EntityExternalLinkProvider>
      </PreloadGate>
    </Suspense>
  )
}
