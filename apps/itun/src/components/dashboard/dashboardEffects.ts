/**
 * Activated contributions a mech/pilot can switch on (F1, ADR-029).
 *
 * `duration: 'activated'` contributions apply only while the player has them
 * on. **Manual expiry by design**: Salvage Union states real durations ("this
 * effect lasts for 1 hour"), but the app has no play clock, and inventing one
 * would put wall-time into the data layer and make a sheet's numbers change
 * while nobody is looking. The table keeps time; the app keeps state — the same
 * division ADR-001's honour system already relies on.
 *
 * Pure: this only enumerates what COULD be switched on. Whether it is on lives
 * in ephemeral play state (ADR-019), never on the entity.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import { matchesRef } from 'salvageunion-reference/rules'

import type { Mech } from '../../lib/schemas/mech'

export type ActivatableEffect = {
  /** The declaring record's ref — the key play state toggles on. */
  ref: string
  /** Display name. */
  name: string
  /** One line describing what switching it on does. */
  summary: string
}

type WithContributions = {
  name?: string
  contributions?: Array<{ stat: string; amount: unknown; duration?: string }>
}

function describe(c: { stat: string; amount: unknown }): string {
  const stat = c.stat === 'cargoCapacity' ? 'Cargo Capacity' : c.stat
  if (typeof c.amount === 'number') return `+${c.amount} ${stat}`
  if (c.amount && typeof c.amount === 'object' && 'fromStat' in c.amount) {
    return `${stat} by this Mech's ${String((c.amount as { fromStat: string }).fromStat)}`
  }
  return `changes ${stat}`
}

function activatedOf(record: WithContributions | undefined, ref: string): ActivatableEffect[] {
  return (record?.contributions ?? [])
    .filter((c) => c.duration === 'activated')
    .map((c) => ({ ref, name: record?.name ?? ref, summary: describe(c) }))
}

/**
 * Every activated contribution reachable from this mech's installed loadout and
 * its pilot's abilities, de-duplicated by ref.
 */
export function activatableEffects(
  mech: Pick<Mech, 'systems' | 'modules'>,
  pilotAbilities: string[] | undefined
): ActivatableEffect[] {
  const out = new Map<string, ActivatableEffect>()

  const installed = [...(mech.systems ?? []), ...(mech.modules ?? [])]
  for (const ref of installed) {
    const item =
      (SalvageUnionReference.Systems.find((s) => matchesRef(s, ref)) as WithContributions) ??
      (SalvageUnionReference.Modules.find((m) => matchesRef(m, ref)) as WithContributions)
    for (const e of activatedOf(item, ref)) out.set(e.ref, e)
  }

  for (const ref of pilotAbilities ?? []) {
    const ability = SalvageUnionReference.Abilities.find((a) =>
      matchesRef(a, ref)
    ) as WithContributions
    for (const e of activatedOf(ability, ref)) out.set(e.ref, e)
  }

  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name))
}
