import { selectBackend } from '../../stores/entityBackend'
import { useEntityStore } from '../../stores/entityStore'
import { usePatternStore } from '../../stores/patternStore'

/**
 * How many builds this session holds that exist nowhere but the tab.
 *
 * Shared by `UnsavedWorkBanner` and `LegacyLocalData`; the latter stands its
 * own signed-out notice down whenever this is non-zero so the two never stack.
 */
export function useAnonymousWorkCount(): number {
  // Subscribed rather than captured: the banner has to appear the moment the
  // first build lands and disappear the moment the work is promoted, and both
  // of those are store changes.
  const pilots = useEntityStore((s) => s.list('pilot'))
  const mechs = useEntityStore((s) => s.list('mech'))
  const crawlers = useEntityStore((s) => s.list('crawler'))
  const patterns = usePatternStore((s) => s.mechPatterns)

  if (selectBackend() !== 'memory') return 0
  return pilots.length + mechs.length + crawlers.length + patterns.length
}
