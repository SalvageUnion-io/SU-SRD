/**
 * Starting equipment — what a new pilot may choose two of: the Tech 1 Pilot
 * Equipment list (Core Book p.19, list pp.80-81). Gear an Ability grants
 * (a Custom Sniper Rifle, a Holo Companion; Core Book p.50, p.35) is Tech 1
 * in the data but is printed with its Ability, not in that list: it comes
 * with the Ability and is never a free pick.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import { isLegalCreationEquipment } from 'salvageunion-reference/rules'
import { readReference } from '../readReference'

type Grant = { name: string; schema?: string }

/** The names of every piece of equipment some Ability grants. */
export function abilityGrantedEquipment(): ReadonlySet<string> {
  return readReference(
    'startingEquipment.granted',
    () =>
      new Set(
        SalvageUnionReference.Abilities.all().flatMap((ability) =>
          ((ability as { grants?: readonly Grant[] }).grants ?? [])
            .filter((grant) => grant.schema === 'equipment')
            .map((grant) => grant.name)
        )
      ),
    new Set<string>()
  )
}

/** Tech 1 equipment from the list: legal at creation and granted by no Ability. */
export function isStartingEquipment(item: { name: string; techLevel?: number | string }): boolean {
  return (
    isLegalCreationEquipment(item as Parameters<typeof isLegalCreationEquipment>[0]) &&
    !abilityGrantedEquipment().has(item.name)
  )
}
