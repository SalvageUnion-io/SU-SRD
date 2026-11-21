/**
 * What a mech moves by: a fitted Locomotion System, or one its chassis has
 * built in. A chassis says so in its Chassis Ability, by name (`Integrated
 * Wader Locomotion System`) or in its text (the Mazona's Hover Drone), and
 * that locomotion is part of its profile, never a System to install.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { readReference } from '../readReference'

/** A Locomotion System, by its own name. */
export const LOCOMOTION = /locomotion/i
const INTEGRATED = /integrated\b[^.]*\blocomotion/i

/** Whether the chassis carries its own locomotion in a Chassis Ability. */
export function hasIntegratedLocomotion(chassisRef: string): boolean {
  return readReference(
    'locomotion.integrated',
    () =>
      (resolveChassisRef(chassisRef)?.chassisAbilities ?? []).some(
        (name) =>
          INTEGRATED.test(name) ||
          INTEGRATED.test(JSON.stringify(SalvageUnionReference.Actions.getByName(name) ?? ''))
      ),
    false
  )
}
