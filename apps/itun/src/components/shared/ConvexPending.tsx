/**
 * ConvexPending — the one pending readout for a Convex `useQuery` that has not
 * resolved yet (`data === undefined`).
 *
 * Convex's three-state read (`undefined` = in flight, `null` = absent,
 * otherwise the value) was being spelled out with a bespoke inline string at
 * eight call sites across `components/games/` and `components/account/`, split
 * between a bare `<Text>` and `<Text variant="hint">` for no reason anyone
 * could name. This is that element, once: the muted hint treatment, and the
 * copy assembled from the subject so every screen says the same thing the same
 * way.
 *
 * `label` names what is loading — `<ConvexPending label="the crew" />` reads
 * "Loading the crew…". Omit it for the bare "Loading…" used where the
 * surrounding section already names the subject.
 *
 * This is NOT the route-level pending state: a route whose loader is still
 * running gets `RoutePending` / `SheetSkeleton` via the router. This one covers
 * a query that resolves *inside* an already-rendered screen.
 */

import { Text } from 'component-lib'

type ConvexPendingProps = {
  /** Subject of the load, e.g. `the crew` → "Loading the crew…". */
  label?: string
  /** Layout escape hatch (e.g. `text-left` inside a left-aligned panel). */
  className?: string
}

export function ConvexPending({ label, className }: ConvexPendingProps) {
  return (
    <Text variant="hint" className={className}>
      {label === undefined ? 'Loading…' : `Loading ${label}…`}
    </Text>
  )
}
