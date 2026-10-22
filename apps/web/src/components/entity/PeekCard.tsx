import type { RefEntity } from 'salvageunion-reference'
import { getChassisAbilities, SalvageUnionReference } from 'salvageunion-reference'
import type { Down } from '../referenceEntity/card/cardChrome'
import { ActionMinis } from '../referenceEntity/card/NestedCards'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import { InsidePeekContext } from './peekContext'

/** What `[(CHASSIS)]` reads when more than one chassis shares the ability. */
const ANY_CHASSIS = 'Mech'

/**
 * The chassis a chassis ability's `[(CHASSIS)]` names, for a Peek, which has
 * no host to thread it down: the one chassis that has the ability ("The
 * Mule", as its chassis page prints it), or "The Mech" for an ability several
 * share. Undefined for anything that is not an action with the placeholder.
 */
function peekChassisName(entity: RefEntity): string | undefined {
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
 * A chassis's Peek reads its chassis ability, not its patterns. The ability
 * nests in the chassis, so it is a contentful Mini
 * (N3, E19) as any nested action is (`ActionMinis`): its head, then its full
 * text, its `[(CHASSIS)]` naming this chassis ("The Mule"). In the Peek the
 * head reads and the roll table is left out (E16).
 */
function peekChassisAbilities(entity: RefEntity, down: Down) {
  const abilities = getChassisAbilities(entity) ?? []
  return abilities.length > 0 ? (
    <ActionMinis
      actions={abilities}
      size="mini"
      hostName={entity.name}
      chassisName={entity.name}
      hostDown={down}
    />
  ) : undefined
}

/** A Peek lists no host's patterns (a chassis's, a Bio-Titan's): see `PeekCard`. */
const PEEK_HIDE = { patterns: true }

/**
 * The PEEK's card (E16): the entity read-only and terminal. It is
 * `ReferenceEntityCard` small and contentful, its band speckled as every
 * brand-colour ground's is (ruleset §3.5.1, R10), inside `InsidePeekContext`, which makes everything
 * in it act on nothing: no links (Mentions and Tags go inert), no roll-table
 * controls, and no Peek inside it. Its name alone links, to the entity's Page
 * (`CardTitleLink`, R33). The card is level 1 on its plate (N1, E6),
 * so everything nested in it is a Mini: children, drones, actions (contentful,
 * `ActionMinis`), choice options and guide ladders. No host lists its
 * patterns here, a chassis's or a Bio-Titan's: each is a pattern Mini with
 * the actions it adds under it, which a Peek has no room to nest. A chassis
 * shows its chassis ability instead (`peekChassisAbilities`), its
 * `[(CHASSIS)]` naming the chassis (`peekChassisName`), never the raw token. A
 * `down` Peek (its trigger damaged or destroyed) paints its band as the trigger does.
 */
export function PeekCard({ entity, down = false }: { entity: RefEntity; down?: Down }) {
  const chassis = 'schemaName' in entity && entity.schemaName === 'chassis'
  return (
    <InsidePeekContext.Provider value={true}>
      <ReferenceEntityCard
        data={entity}
        size="mini"
        texture
        chassisName={peekChassisName(entity)}
        hostDown={down}
        hide={PEEK_HIDE}
        afterExtraContent={chassis ? peekChassisAbilities(entity, down) : undefined}
      />
    </InsidePeekContext.Provider>
  )
}
