import { EntityExternalLinkProvider } from 'component-lib'
import type { ReactNode } from 'react'
import { Suspense, use } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
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

/**
 * Kicked off at MODULE SCOPE, not on first render.
 *
 * It used to be created lazily inside `PreloadGate`, which meant the dataset
 * fetch did not start until React had booted, mounted the provider tree and
 * rendered down to this component. Everything before that was dead time on the
 * critical path: the network was idle while the app was starting up.
 *
 * Hoisting it here starts the load during module evaluation instead, so it
 * overlaps with React bootstrap and the rest of the entry chunk. This is the
 * pattern `apps/srd/src/lib/gameData.ts` already uses, and module-scope
 * `preload()` is explicitly sanctioned — `tools/check-architecture.ts` exempts
 * `.preload()` / `.isLoaded()` from the no-module-scope-ORM-access rule,
 * calling them "the documented, correct way to eagerly bootstrap data loading".
 *
 * NOTE what this deliberately does NOT change: it still preloads `'all'` behind
 * a SINGLE gate. Narrowing that to a per-route schema list is the footgun this
 * file's doc comment above warns about (`ReferenceEntityCard` pulls traits and
 * actions inline across schemas, so a partial preload throws "Schema not
 * loaded" from an unrelated card), and making the preload non-blocking would
 * require every ORM-touching component — not just this gate — to tolerate a
 * not-ready state. Both remain out of scope; this is purely an earlier start.
 */
const preloadPromise: Promise<unknown> = SalvageUnionReference.preload('all').then(() => {
  if (typeof document !== 'undefined') {
    document.body.dataset.gameDataReady = 'true'
  }
})

function PreloadGate({ children }: { children: ReactNode }) {
  use(preloadPromise)
  return <>{children}</>
}

/**
 * Branded full-viewport loading fallback (design-spec brand chrome): SU mark
 * on the ink-deep ground with an indeterminate rust loader bar. The status
 * text stays in the accessibility tree for screen readers.
 */
function GameDataFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-ink-deep px-6"
    >
      <img
        src="/logos/su-cargo-dark.svg"
        alt=""
        width={96}
        height={96}
        className="size-20 rounded-md sm:size-24"
      />
      <p className="font-cond text-sm font-semibold uppercase tracking-eyebrow text-paper">
        Loading reference data…
      </p>
      {/* motion-safe: prefers-reduced-motion users get a static bar instead
          of the infinite translateX sweep (matches the heat-pulse guard). */}
      <div aria-hidden="true" className="h-1 w-56 overflow-hidden rounded-full bg-paper/20">
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
