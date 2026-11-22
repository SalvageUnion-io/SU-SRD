/**
 * A vital that reaches 0 says what happens next (r4 A5): a Mech at 0 SP rolls
 * on Critical Damage (a Bio-Chassis on its own Damage table), a Pilot at 0 HP
 * on Critical Injury. The change is written to the Feed (`recordPlayChange`),
 * and a toast carries a "Roll Critical Damage" button that opens the table in
 * the Tables section (`askPlayTable`, which `PlayTables` and the Cockpit hear).
 *
 * Nothing is rolled or applied for the player (ADR-007): the button only opens
 * the table, whose stamp is theirs to press. Outside Play, where no Tables
 * section is listening, the toast says what is due without the button.
 */

import { pilotCallsign } from 'game-domain/pilotLabel'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import { damageTableName, overloadTableOf, resolveChassisRef } from 'salvageunion-reference/rules'
import { toast } from '../components/index'
import { playCopy } from '../messages/play'
import { recordPlayChange } from './playRolls.model'

type TableListener = (name: string) => void

const listeners = new Set<TableListener>()

/** Hear a table asked for by name: the Tables section opens it, the Cockpit shows the section. */
export function onPlayTableAsked(listener: TableListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Ask Play to open a roll table by its name. */
export function askPlayTable(name: string): void {
  for (const listener of [...listeners]) listener(name)
}

/** The unit a vital belongs to, as far as the notice needs it. */
type ZeroUnit =
  | { kind: 'mech'; unit: Pick<Mech, 'id' | 'name' | 'chassisRef'> }
  | { kind: 'pilot'; unit: Pick<Pilot, 'id' | 'name' | 'callsign'> }

/** The unit of `kind` and `id` as a store holds it, for the notice; null for a crawler or a unit not held. */
export function zeroUnit(
  store: { get: (kind: 'pilot' | 'mech', id: string) => Pilot | Mech | null | undefined },
  kind: string,
  id: string
): ZeroUnit | null {
  if (kind !== 'pilot' && kind !== 'mech') return null
  const unit = store.get(kind, id)
  if (!unit) return null
  return kind === 'mech' ? { kind, unit: unit as Mech } : { kind, unit: unit as Pilot }
}

/** The table a vital at 0 rolls on, and the vital's name; null for any other field. */
export function zeroVitalTable(
  at: ZeroUnit,
  field: string
): { label: string; table: string } | null {
  if (at.kind === 'mech' && field === 'currentSP')
    return {
      label: 'SP',
      table: damageTableName(overloadTableOf(resolveChassisRef(at.unit.chassisRef))),
    }
  if (at.kind === 'pilot' && field === 'currentHP') return { label: 'HP', table: 'Critical Injury' }
  return null
}

const toastId = (unitId: string, field: string) => `zero:${unitId}:${field}`

/**
 * Say a vital has just reached 0: the Feed line, and the toast with its
 * button. A change that does not end at 0, or started there, says nothing.
 */
export function zeroVitalNotice(
  at: ZeroUnit | null,
  field: string,
  from: number,
  to: number
): void {
  const due = at === null ? null : zeroVitalTable(at, field)
  if (at === null || due === null) return
  const id = toastId(at.unit.id, field)
  if (to !== 0 || from <= 0) {
    // Undone, or healed: the notice has nothing left to say.
    if (to > 0) toast.dismiss(id)
    return
  }
  const name = at.kind === 'pilot' ? pilotCallsign(at.unit) : at.unit.name
  recordPlayChange(playCopy('reachedZeroFeed', { name, label: due.label, from, table: due.table }))
  toast(playCopy('reachedZero', { name, label: due.label, table: due.table }), {
    id,
    duration: 20000,
    ...(listeners.size > 0
      ? {
          action: {
            label: playCopy('rollTable', { table: due.table }),
            onClick: () => askPlayTable(due.table),
          },
        }
      : {}),
  })
}
