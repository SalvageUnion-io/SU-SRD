import { EntityExternalLinkProvider } from 'component-lib'
import { color, font, fontSize, radius, space, tracking, weight } from 'component-lib/design/tokens'
import type { CSSProperties, ReactNode } from 'react'
import { Suspense, use, useEffect, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { srdEntityExternalLink } from '../contextual/srdEntityExternalLink'

/**
 * Suspends until the full SalvageUnionReference dataset is loaded, then sets
 * `body[data-game-data-ready="true"]` so E2E tests can latch onto a stable
 * "ready" signal across every route.
 *
 * Why preload everything (the "everything" half of the middle path, see
 * below): the entity-display layer pulls trait keywords, actions, and other
 * cross-schema references inline, so a per-route preload of only what a wizard
 * needs leaves ReferenceEntityCard throwing "Schema 'traits' not loaded" when it
 * renders a chosen entity. A single preload of the full dataset
 * removes the matrix of per-route preload lists and is cheap (the dataset is
 * ~1-2 MB of static JSON, loaded up front) — see
 * docs/ARCHITECTURE.md#areas for the fuller rationale.
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
 * `GameDataFallback` below still sizes itself to the full dynamic viewport height, so while
 * `AppHeader` is also visible the fallback overshoots the remaining viewport
 * by the header's height for the brief loading window — acceptable given
 * it's transient and avoids threading `showAppHeader` through as a prop for
 * a purely cosmetic fix.
 */

/**
 * Kicked off at MODULE SCOPE, not on first render.
 *
 * Created lazily inside `PreloadGate`, the fetch would not start until React
 * had booted, mounted the provider tree and rendered down to this component —
 * dead time on the critical path. At module scope the load starts during module
 * evaluation, so it overlaps with React bootstrap and the rest of the entry chunk. This is the
 * pattern `apps/srd/src/lib/gameData.ts` already uses, and module-scope
 * `preload()` is explicitly sanctioned — `packages/gates/biome/noModuleScopeReferenceCall.grit`
 * exempts `.preload()` / `.isLoaded()` from the no-module-scope-ORM-access rule
 * as the lifecycle calls the preload contract exists to make eagerly.
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

/**
 * Whether the dataset has loaded — for the controls that live in the bar, which
 * paints above the gate and so cannot suspend on it.
 */
export function useGameDataLoaded(): boolean {
  const [loaded, setLoaded] = useState(() => SalvageUnionReference.isLoaded('chassis'))
  useEffect(() => {
    let live = true
    void preloadPromise.then(() => {
      if (live) setLoaded(true)
    })
    return () => {
      live = false
    }
  }, [])
  return loaded
}

function PreloadGate({ children }: { children: ReactNode }) {
  use(preloadPromise)
  return <>{children}</>
}

const FALLBACK = {
  alignItems: 'center',
  backgroundColor: color.inkDeep,
  display: 'flex',
  flexDirection: 'column',
  gap: space[24],
  justifyContent: 'center',
  minHeight: '100dvh',
  paddingInline: space[24],
} satisfies CSSProperties

/** The SU mark; its size steps up from `sm` (routeStates.css). */
const MARK = { borderRadius: '0.375rem' } satisfies CSSProperties

const STATUS = {
  color: color.paper,
  fontFamily: font.cond,
  fontSize: fontSize.sm,
  fontWeight: weight.semibold,
  letterSpacing: tracking.eyebrow,
  lineHeight: '1.25rem',
  textTransform: 'uppercase',
} satisfies CSSProperties

const TRACK = {
  backgroundColor: `color-mix(in oklab, ${color.paper} 20%, transparent)`,
  borderRadius: radius.full,
  height: space[4],
  overflow: 'hidden',
  width: '14rem',
} satisfies CSSProperties

/** The sweeping third; its motion is routeStates.css's, under motion-safe. */
const BAR = {
  backgroundColor: color.paper,
  borderRadius: radius.full,
  height: '100%',
  width: 'calc(1 / 3 * 100%)',
} satisfies CSSProperties

/**
 * Branded full-viewport loading fallback (design-spec brand chrome): SU mark
 * on the ink-deep ground with an indeterminate paper loader bar. The status
 * text stays in the accessibility tree for screen readers.
 */
function GameDataFallback() {
  return (
    <div role="status" aria-live="polite" style={FALLBACK}>
      <img
        src="/logos/su-cargo-dark.svg"
        alt=""
        width={96}
        height={96}
        className="game-data-fallback__mark"
        style={MARK}
      />
      <p style={STATUS}>Loading reference data…</p>
      {/* motion-safe: prefers-reduced-motion users get a static bar instead
          of the infinite translateX sweep (matches the heat-pulse guard). */}
      <div aria-hidden="true" style={TRACK}>
        <div className="game-data-fallback__bar" style={BAR} />
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
