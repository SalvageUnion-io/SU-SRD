import type { CSSProperties, ReactNode } from 'react'
import { useLayoutEffect } from 'react'
import { color, font, fontSize, radius, space, tracking, weight } from '../../design/tokens'
import { MARK_SRC } from '../../lib/documentHead'
import { preloadGameData } from '../../lib/useGameData'
import { srdEntityExternalLink } from '../contextual/srdEntityExternalLink'
import { GameDataGate } from '../GameDataGate'
import { EntityExternalLinkProvider } from '../index'

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
        src={MARK_SRC}
        alt=""
        width={96}
        height={96}
        className="su-game-data-fallback__mark"
        style={MARK}
      />
      <p style={STATUS}>Loading reference data…</p>
      {/* motion-safe: prefers-reduced-motion users get a static bar instead
          of the infinite translateX sweep (matches the heat-pulse guard). */}
      <div aria-hidden="true" style={TRACK}>
        <div className="su-game-data-fallback__bar" style={BAR} />
      </div>
    </div>
  )
}

/**
 * Holds every route behind `GameDataGate` until the full SalvageUnionReference
 * dataset is loaded, with the branded fallback while it loads.
 *
 * Everything, not a per-route list: the entity-display layer pulls trait
 * keywords, actions and other cross-schema references inline, so a preload of
 * only what a wizard needs leaves ReferenceEntityCard throwing "Schema 'traits'
 * not loaded" when it renders a chosen entity. The dataset is ~1-2 MB of static
 * JSON; docs/ARCHITECTURE.md#data-flow has the fuller rationale.
 *
 * Off the critical rendering path: this wraps only `<Outlet />` and
 * `<GlobalSearch />` in routes/__root.tsx. The Union bar (brand chrome, no
 * reference data) is the shell's, outside the app's root altogether, so it
 * paints before the app boots. A non-blocking preload would need every
 * ORM-touching component to tolerate a not-ready state. One trade-off:
 * `GameDataFallback` sizes itself to the full dynamic viewport height, so while
 * the bar shows it overshoots by the bar's height for the brief loading
 * window, rather than measuring the bar for a cosmetic fix.
 */
export function GameDataReady({ children }: { children: ReactNode }) {
  // App-wide "View in SRD" cross-link injection: full
  // entity cards and detail modals render srdEntityExternalLink in their foot
  // band. Provided here — beside the preload gate that already wraps every
  // route — so the builder only runs once the reference dataset is loaded.
  return (
    <GameDataGate fallback={<GameDataFallback />}>
      <ReadyMarker />
      <EntityExternalLinkProvider value={srdEntityExternalLink}>
        {children}
      </EntityExternalLinkProvider>
    </GameDataGate>
  )
}
