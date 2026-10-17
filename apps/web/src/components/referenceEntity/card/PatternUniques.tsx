import type { RefObjectAnyPattern } from 'salvageunion-reference'
import { extractPatternActions, normalizePatternName } from 'salvageunion-reference'
import type { Down } from './cardChrome'
import { cardKey } from './cardHelpers'
import { ActionTokens } from './NestedCards'
import { LoadoutToken } from './PatternLoadout'
import { resolvePatternGroups } from './resolveNestedEntities'

/**
 * `PatternUniques` — what makes ONE pattern itself, shown under its row in a
 * host's pattern list so the list compares patterns at a glance instead of
 * only naming them. The host's own stats and abilities are shared by every
 * pattern and already on the page; a row carries only the difference:
 *
 * - a MECH pattern's loadout — every system, module and drone it installs, as
 *   the pattern view's full-width Token a line (`LoadoutToken`), multiples repeated
 *   as the pattern view prints them;
 * - a BIO-TITAN pattern's added actions, as contentful Tokens (N3,
 *   `ActionTokens`): the pattern is level 1 at most, so they are level 2 —
 *   there is no loadout, and an added rule is the whole of the difference, so
 *   it is printed in full rather than compressed to a name.
 *
 * Read off the pattern's shape (`resolvePatternGroups` / `extractPatternActions`
 * each answer empty for the other kind), never the host's schema. Renders
 * nothing when the pattern adds nothing.
 */
export function PatternUniques({
  pattern,
  hostDown,
  hostName,
  chassisName,
  className,
  loadout: showLoadout = true,
}: {
  pattern: RefObjectAnyPattern
  hostDown?: Down
  hostName: string
  chassisName?: string
  className?: string
  /** `false` when the caller draws the loadout itself (a page's pattern cards, as Rows). */
  loadout?: boolean
}) {
  const loadout = showLoadout
    ? resolvePatternGroups(pattern).flatMap((group) => group.entities)
    : []
  const actions = extractPatternActions(pattern)
  if (loadout.length === 0 && actions.length === 0) return null
  const name = normalizePatternName(pattern.name)
  return (
    <div className={className}>
      {loadout.length > 0 && (
        <ul aria-label={`${name} loadout`} className="su-entity-token-list">
          {loadout.map((item, index) => (
            <li key={cardKey(item, index)}>
              <LoadoutToken data={item} hostDown={hostDown} />
            </li>
          ))}
        </ul>
      )}
      {actions.length > 0 && (
        <ActionTokens
          actions={actions}
          size="compact"
          hostName={hostName}
          chassisName={chassisName}
          hostDown={hostDown}
        />
      )}
    </div>
  )
}
