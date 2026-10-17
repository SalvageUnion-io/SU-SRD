import type { CSSProperties } from 'react'
import type { RefEntity } from 'salvageunion-reference'
import {
  getChassisAbilities,
  replaceChassisPlaceholder,
  SalvageUnionReference,
  toEntityModel,
} from 'salvageunion-reference'
import { space } from '../../design/tokens'
import type { Down } from '../referenceEntity/card/cardChrome'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import { Entity } from './Entity'
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

const ABILITY_ROWS = {
  display: 'grid',
  gap: space[8],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

/**
 * A chassis's Peek reads its chassis ability, not its patterns (owner's call,
 * 2026-10-14): the ability as a library Row with its lead, as the mech
 * sheet's hero shows it, its `[(CHASSIS)]` naming this chassis ("The Mule").
 */
function peekChassisAbilities(entity: RefEntity) {
  const abilities = getChassisAbilities(entity) ?? []
  return abilities.length > 0 ? (
    <ul aria-label="Chassis ability" style={ABILITY_ROWS}>
      {abilities.map((ability) => {
        const model = toEntityModel(ability)
        const lead = model.lead && replaceChassisPlaceholder(model.lead, entity.name)
        return (
          <li key={ability.id}>
            <Entity form="row" model={{ ...model, ...(lead ? { lead } : {}) }} lead />
          </li>
        )
      })}
    </ul>
  ) : undefined
}

/**
 * The PEEK's card (E16): the entity read-only and terminal. It is
 * `ReferenceEntityCard` small, at full extent, flat (no
 * speckle, ruleset §3.5), inside `InsidePeekContext`, which makes everything
 * in it act on nothing: no links (Mentions and Tags go inert), no roll-table
 * controls, no actions chip, children as Tokens, and no Peek inside it. A
 * chassis ability names its chassis (`peekChassisName`), never the raw token. A
 * chassis shows its chassis ability (`peekChassisAbilities`), never its patterns. A
 * `down` Peek (its trigger damaged or destroyed) paints its band as the trigger does.
 */
export function PeekCard({ entity, down = false }: { entity: RefEntity; down?: Down }) {
  const chassis = 'schemaName' in entity && entity.schemaName === 'chassis'
  return (
    <InsidePeekContext.Provider value={true}>
      <ReferenceEntityCard
        data={entity}
        size="mini"
        extent="full"
        texture={false}
        chassisName={peekChassisName(entity)}
        hostDown={down}
        hide={chassis ? { patterns: true } : undefined}
        afterExtraContent={chassis ? peekChassisAbilities(entity) : undefined}
      />
    </InsidePeekContext.Provider>
  )
}
