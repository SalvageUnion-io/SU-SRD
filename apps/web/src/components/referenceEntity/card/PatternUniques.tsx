import type { RefObjectAnyPattern } from 'salvageunion-reference'
import { extractPatternActions } from 'salvageunion-reference'
import type { Down } from './cardChrome'
import { ActionMinis } from './NestedCards'

/**
 * `PatternUniques` — what makes ONE pattern itself, shown in its card
 * (`PatternListing`). The host's own stats and abilities are shared by every
 * pattern, and a mech pattern's loadout is drawn by the card itself, so this
 * is a BIO-TITAN pattern's added actions, as contentful Minis (N3,
 * `ActionMinis`): the pattern is level 1 at most, so they are level 2 — there
 * is no loadout, and an added rule is the whole of the difference, so it is
 * printed in full rather than compressed to a name.
 *
 * Read off the pattern's shape (`extractPatternActions` answers empty for a
 * mech pattern), never the host's schema. Renders nothing when the pattern
 * adds nothing.
 */
export function PatternUniques({
  pattern,
  hostDown,
  hostName,
  chassisName,
  className,
}: {
  pattern: RefObjectAnyPattern
  hostDown?: Down
  hostName: string
  chassisName?: string
  className?: string
}) {
  const actions = extractPatternActions(pattern)
  if (actions.length === 0) return null
  return (
    <div className={className}>
      <ActionMinis
        actions={actions}
        size="compact"
        hostName={hostName}
        chassisName={chassisName}
        hostDown={hostDown}
      />
    </div>
  )
}
