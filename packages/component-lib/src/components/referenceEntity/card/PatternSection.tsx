import type { ElementType, ReactNode } from 'react'
import type { SURefMetaAction } from 'salvageunion-reference'
import { space } from '../../../design/tokens'
import { Slab } from '../../atoms/Slab'
import { cardKey, nestedTitleLevel } from './cardHelpers'
import type { NestedCardHost } from './NestedCards'
import { PatternLoadout } from './PatternLoadout'
import type { NestedGroup } from './resolveNestedEntities'

/**
 * The PATTERN view's own section — the pattern's prose, then what it changes:
 * a mech pattern's side-by-side loadout of shortform badges, or the actions a
 * Bio-Titan pattern adds, as cards under a "Pattern Actions" stamp. The card
 * places it: after a chassis ability (a mech pattern reads chassis → chassis
 * ability → pattern → systems → modules), ahead of every other action (a
 * Bio-Titan pattern reads pattern → its added actions → the ones it inherits).
 * Renders nothing when there is nothing to show.
 */
export function PatternSection({
  prose,
  groups,
  actions,
  padding,
  sectionAs,
  host,
}: {
  /** The pattern's `PatternProse`, or null. */
  prose: ReactNode
  /** The mech loadout — empty when hidden or for a Bio-Titan pattern. */
  groups: NestedGroup[]
  /** The actions a Bio-Titan pattern adds — empty when hidden. */
  actions: SURefMetaAction[]
  padding: string
  sectionAs: ElementType | undefined
  host: NestedCardHost
}) {
  if (!prose && groups.length === 0 && actions.length === 0) return null
  const { NestedCard } = host
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[6], padding }}>
      {prose}
      {groups.length > 0 && (
        <PatternLoadout groups={groups} sectionAs={sectionAs} hostDown={host.isDown} />
      )}
      {actions.length > 0 && (
        <>
          <Slab variant="dashed" label="Pattern Actions" as={sectionAs} />
          {actions.map((action, index) => (
            <NestedCard
              key={cardKey(action, index)}
              data={action}
              size="medium"
              depth={host.depth + 1}
              hostDown={host.isDown}
              // On a page, a heading under the "Pattern Actions" band's h2.
              titleAs={nestedTitleLevel(host.onPage)}
              hostName={host.entityName}
              chassisName={host.chassisName}
            />
          ))}
        </>
      )}
    </div>
  )
}
