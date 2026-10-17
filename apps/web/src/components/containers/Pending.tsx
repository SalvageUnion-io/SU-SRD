import { Text } from '../atoms/Text'

type PendingProps = {
  /** What is loading, e.g. `the crew` → "Loading the crew…". Omit it for the
   * bare "Loading…" where the surrounding section already names the subject. */
  label?: string
}

/**
 * Pending — the one "Loading X…" line, for data that resolves inside an
 * already-rendered screen (a Convex `useQuery` still `undefined`, a store
 * still hydrating, the reference index still loading).
 *
 * The muted hint treatment (`Text variant="hint"`), announced politely as a
 * status, and the copy assembled from the subject so every screen says it the
 * same way. A route whose loader is still running gets `RoutePending` /
 * `SheetSkeleton` instead; a list whose shape is known gets a `Skeleton`.
 */
export function Pending({ label }: PendingProps) {
  return (
    <Text variant="hint" role="status" aria-live="polite">
      {label === undefined ? 'Loading…' : `Loading ${label}…`}
    </Text>
  )
}
