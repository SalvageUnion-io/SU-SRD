import type { CSSProperties } from 'react'
import type { SURefObjectAnyPattern } from 'salvageunion-reference'
import { extractPatternActions, normalizePatternName } from 'salvageunion-reference'
import { space } from '../../../design/tokens'
import { cardKey } from './cardHelpers'
import { LoadoutToken } from './PatternLoadout'
import type { NestedCard } from './referenceEntityCardTypes'
import { resolvePatternGroups } from './resolveNestedEntities'

const CARDS: CSSProperties = { display: 'flex', flexDirection: 'column', gap: space[8] }

/**
 * `PatternUniques` — what makes ONE pattern itself, shown under its row in a
 * host's pattern list so the list compares patterns at a glance instead of
 * only naming them. The host's own stats and abilities are shared by every
 * pattern and already on the page; a row carries only the difference:
 *
 * - a MECH pattern's loadout — every system, module and drone it installs, as
 *   the pattern view's full-width Token a line (`LoadoutToken`), multiples repeated
 *   as the pattern view prints them;
 * - a BIO-TITAN pattern's added actions, as embedded action cards — there is
 *   no loadout, and an added rule is the whole of the difference, so it is
 *   printed in full rather than compressed to a name.
 *
 * Read off the pattern's shape (`resolvePatternGroups` / `extractPatternActions`
 * each answer empty for the other kind), never the host's schema. Renders
 * nothing when the pattern adds nothing.
 */
export function PatternUniques({
  pattern,
  depth,
  hostDown,
  hostName,
  chassisName,
  NestedCard,
  className,
  loadout: showLoadout = true,
}: {
  pattern: SURefObjectAnyPattern
  /** The depth the embedded cards render at. */
  depth: number
  hostDown?: boolean
  hostName: string
  chassisName?: string
  NestedCard: NestedCard
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
        <div style={CARDS}>
          {actions.map((action, index) => (
            <NestedCard
              key={cardKey(action, index)}
              data={action}
              size="medium"
              depth={depth}
              hostDown={hostDown}
              hostName={hostName}
              chassisName={chassisName}
            />
          ))}
        </div>
      )}
    </div>
  )
}
