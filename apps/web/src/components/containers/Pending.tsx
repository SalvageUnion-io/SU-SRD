import { Text } from '../atoms/Text'
import { loadingCopy } from './loadingCopy'

type PendingProps = {
  /** What is loading, e.g. `the crew` → "Loading the crew…". Omit it for the
   * bare "Loading…" where the surrounding section already names the subject. */
  label?: string
}

/**
 * Pending — the loading line inside an already-rendered screen (chrome.md K6):
 * a muted hint announced politely as a status, in `loadingCopy`'s words. A
 * shape known ahead is a `Skeleton`; a route's wait is `RoutePending`.
 */
export function Pending({ label }: PendingProps) {
  return (
    <Text variant="hint" role="status" aria-live="polite">
      {loadingCopy(label)}
    </Text>
  )
}
