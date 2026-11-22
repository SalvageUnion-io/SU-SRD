/**
 * A vital that reaches 0 says what happens next (r4 A5): a Mech at 0 SP rolls
 * on Critical Damage (a Bio-Chassis on its own Damage table), a Pilot at 0 HP
 * on Critical Injury. The change is written to the Feed (`recordPlayChange`),
 * and a toast carries a "Roll Critical Damage" button that rolls the table in
 * the Tables section in one press (r5 A1; `askPlayTable`, which `PlayTables`
 * and the Cockpit hear). The roll lands on the Feed, its row marked in the
 * table; the unit's card names it, a press away from that row (`downResult`,
 * r6 A4), until its SP or HP rises.
 *
 * A unit at 0 is Down (`isDown`): every screen at the table marks it. Nothing
 * in the result is applied for the player (ADR-007): the press is theirs, and
 * what the result does is the table's to play. Outside Play, where no Tables
 * section is listening, the toast says what is due without the button.
 */

import { pilotCallsign } from 'game-domain/pilotLabel'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import { useSyncExternalStore } from 'react'
import { damageTableName, overloadTableOf, resolveChassisRef } from 'salvageunion-reference/rules'
import { toast } from '../components/index'
import { playCopy } from '../messages/play'
import { onPlayRoll, recordPlayChange } from './playRolls.model'
import { CRITICAL_INJURY_TABLE } from './tables.model'

type TableListener = (name: string, ask: { roll: boolean }) => void

const listeners = new Set<TableListener>()

/** Hear a table asked for by name: the Tables section opens it, the Cockpit shows the section. */
export function onPlayTableAsked(listener: TableListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Ask Play to open a roll table by its name; with `roll`, to roll it too (the player's press). */
export function askPlayTable(name: string, roll = false): void {
  for (const listener of [...listeners]) listener(name, { roll })
}

/** Whether a vital stands at 0: a unit Down (r5 A1). An unset one reads full. */
export function isDown(current: number | null | undefined): boolean {
  return current === 0
}

/** What each Down unit's Critical roll came to, by unit id, until it rises (r5 A1). */
const results = new Map<string, DownResult>()
const resultWatchers = new Set<() => void>()
/** The unit whose Critical table the toast's press rolled, while its roll is awaited. */
let awaited: { unitId: string; table: string; toastId: string } | null = null

/** A kept Critical result: what the unit's card names, its table to open. */
export type DownResult = { table: string; text: string }

function keepResult(unitId: string, result: DownResult | null): void {
  if (result === null) results.delete(unitId)
  else results.set(unitId, result)
  for (const watch of resultWatchers) watch()
}

/** A row's name, never its whole text: "Core Damage: …" names "Core Damage" (r6 A4). */
function rowName(outcome: string | undefined): string | null {
  if (outcome === undefined) return null
  const colon = outcome.indexOf(': ')
  if (colon > 0) return outcome.slice(0, colon)
  return outcome.length <= 40 ? outcome : null
}

onPlayRoll((roll) => {
  if (awaited === null || roll.tableName !== awaited.table || roll.rolls.length === 0) return
  const name = rowName(roll.outcome)
  const text = [roll.tableName, roll.rolls.join(', '), ...(name === null ? [] : [name])]
  keepResult(awaited.unitId, { table: awaited.table, text: text.join(' · ') })
  // Rolled: the marked row is the result, and the toast has said its piece.
  toast.dismiss(awaited.toastId)
  awaited = null
})

/** The last Critical result rolled for a Down unit, by name, or null. */
export function downResult(unitId: string): string | null {
  return results.get(unitId)?.text ?? null
}

/** The kept result and its table, kept current. */
export function useDownResult(unitId: string | null): DownResult | null {
  const read = () => (unitId === null ? null : (results.get(unitId) ?? null))
  return useSyncExternalStore(
    (watch) => {
      resultWatchers.add(watch)
      return () => {
        resultWatchers.delete(watch)
      }
    },
    read,
    read
  )
}

/** Forget every kept result (tests). */
export function clearDownResults(): void {
  results.clear()
  awaited = null
  for (const watch of resultWatchers) watch()
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
  if (at.kind === 'pilot' && field === 'currentHP')
    return { label: 'HP', table: CRITICAL_INJURY_TABLE }
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
    // Undone, or healed: the notice has nothing left to say, nor the result kept.
    if (to > 0) {
      toast.dismiss(id)
      keepResult(at.unit.id, null)
    }
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
            // One press rolls it (r5 A1): the press is the player's own.
            onClick: () => {
              awaited = { unitId: at.unit.id, table: due.table, toastId: id }
              askPlayTable(due.table, true)
            },
          },
        }
      : {}),
  })
}
