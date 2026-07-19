import { Suspense, use, type ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntityExternalLinkProvider } from 'component-lib'

import { srdEntityExternalLink } from '../contextual/srdEntityExternalLink'

/**
 * Suspends until the full SalvageUnionReference dataset is loaded, then sets
 * `body[data-game-data-ready="true"]` so E2E tests can latch onto a stable
 * "ready" signal across every route.
 *
 * Why preload everything (still true — this is the "everything" half of the
 * middle path, see below): the entity-display layer pulls trait keywords,
 * actions, and other cross-schema references inline. Routes used to preload
 * only what their wizard needed (classes/abilities/equipment for /pilots/new)
 * which left ReferenceEntityCard throwing "Schema 'traits' not loaded"
 * when it rendered a chosen entity. A single preload of the full dataset
 * removes the matrix of per-route preload lists and matches the local-first
 * MVP model (the dataset is ~1-2 MB JSON; loading it up front is fine) — see
 * docs/architecture/data-flow.md for the fuller rationale.
 *
 * Off the critical rendering path (the "deprioritized after first paint"
 * half): this component only wraps `<Outlet />` + `<GlobalSearch />` in
 * routes/__root.tsx — `<AppHeader />` (brand chrome, touches no reference
 * data) now renders as a SIBLING one level up, outside this Suspense
 * boundary, so it paints on the very first frame instead of sitting behind
 * the full preload like every other route. This is deliberately the
 * smallest useful cut, not per-route preload lists (which would reintroduce
 * exactly the "Schema 'traits' not loaded" footgun the full-preload model
 * above exists to avoid) and not an app-wide non-blocking preload (which
 * would need every ORM-touching component, not just this one gate, to
 * tolerate a not-ready state — a much larger change). One known trade-off:
 * `GameDataFallback` below still sizes itself to `min-h-dvh`, so while
 * `AppHeader` is also visible the fallback overshoots the remaining viewport
 * by the header's height for the brief loading window — acceptable given
 * it's transient and avoids threading `showAppHeader` through as a prop for
 * a purely cosmetic fix.
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
        className="size-20 rounded-md sm:size-24"
      />
      <p className="font-cond text-sm font-semibold uppercase tracking-eyebrow text-su-paper">
        Loading reference data…
      </p>
      {/* motion-safe: prefers-reduced-motion users get a static bar instead
          of the infinite translateX sweep (matches the heat-pulse guard). */}
      <div aria-hidden="true" className="h-1 w-56 overflow-hidden rounded-full bg-su-paper/20">
        <div className="h-full w-1/3 rounded-full bg-rust motion-safe:animate-loader-slide" />
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
