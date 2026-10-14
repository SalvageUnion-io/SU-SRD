import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../components/referenceEntity/card/ReferenceEntityCard'
import { InsidePeekContext } from './peekContext'

/** What `[(CHASSIS)]` reads when more than one chassis shares the ability. */
const ANY_CHASSIS = 'Mech'

/**
 * The chassis a chassis ability's `[(CHASSIS)]` names, for a Peek, which has
 * no host to thread it down: the one chassis that has the ability ("The
 * Mule", as its chassis page prints it), or "The Mech" for an ability several
 * share. Undefined for anything that is not an action with the placeholder.
 */
function peekChassisName(entity: SURefEntity): string | undefined {
  if (!('schemaName' in entity) || entity.schemaName !== 'actions') return undefined
  if (!JSON.stringify(entity).includes('[(CHASSIS)]')) return undefined
  try {
    const owners = SalvageUnionReference.findAllIn('chassis', (chassis) =>
      (chassis.chassisAbilities ?? []).includes(entity.name)
    )
    return owners.length === 1 && owners[0] ? owners[0].name : ANY_CHASSIS
  } catch {
    // The chassis schema is not loaded (an app that loads schemas lazily):
    // the generic name still reads as prose, where the raw token would not.
    return ANY_CHASSIS
  }
}

/**
 * The PEEK's card (E16): the entity read-only and terminal. It is
 * `ReferenceEntityCard` small, at full extent, flat (no
 * speckle, ruleset §3.5), inside `InsidePeekContext`, which makes everything
 * in it act on nothing: no links (Mentions and Tags go inert), no roll-table
 * controls, no actions chip, children as Tokens, and no Peek inside it. A
 * chassis ability names its chassis (`peekChassisName`), never the raw token.
 */
export function PeekCard({ entity }: { entity: SURefEntity }) {
  return (
    <InsidePeekContext.Provider value={true}>
      <ReferenceEntityCard
        data={entity}
        size="small"
        extent="full"
        texture={false}
        chassisName={peekChassisName(entity)}
      />
    </InsidePeekContext.Provider>
  )
}
