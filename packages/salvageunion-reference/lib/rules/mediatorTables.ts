/**
 * Mediator tables — Reaction / Morale / Retreat rolls (design-review R-5).
 *
 * Salvage Union Workshop Manual p.268:
 * - **Reaction Roll**: rolled when the Pilots meet a group of NPCs, to set
 *   their initial disposition (Actively Hostile … Actively Helpful).
 * - **Morale**: rolled when an NPC Mech/Creature drops to 50% or less of its
 *   SP/HP (or a group suffers 50%+ losses) to see if it stays in the fight.
 *   Pilots never roll Morale.
 * - **Retreat**: rolled when a group (Pilots or NPCs) chooses to retreat, to
 *   find out how the escape goes.
 *
 * This module is PURE: no React, no IndexedDB, no real randomness. The d20 is
 * injected via the shared `Roll` seam (./types.ts) and the table lookup via
 * `findTable`, so every function is deterministic in tests. The outcome text
 * is read verbatim from the reference roll-table data (roll-tables.json) via
 * `resultForTable` — never duplicated here.
 *
 * ADR-007 boundary: these tables have no mechanical bookkeeping to apply —
 * the result is narrative guidance for the Mediator. The roll is recorded;
 * acting on it (fleeing, surrendering, marking losses) stays a table call.
 */

import type { SURefRollTable } from '../types/index.js'
import { resultForTable } from '../utils/resultForTable.js'
import type { MediatorRollResult, MediatorTableId, Roll } from './types.js'

/** Reference roll-table `name` for each Mediator table id. */
export const MEDIATOR_TABLE_NAMES: Record<MediatorTableId, string> = {
  reaction: 'Reaction Roll',
  morale: 'Morale',
  retreat: 'Retreat',
}

/** Short UI label for each Mediator table id. */
export const MEDIATOR_TABLE_LABEL: Record<MediatorTableId, string> = {
  reaction: 'Reaction',
  morale: 'Morale',
  retreat: 'Retreat',
}

/**
 * Looks up a reference roll table by its `name`. Injectable for tests —
 * `table` is structurally loose so fake tables don't have to satisfy the full
 * reference union; performMediatorRoll narrows it for resultForTable.
 */
export type FindRollTable = (name: string) => { table?: unknown } | undefined

type MediatorRollInput = {
  /** Which Mediator table to roll. */
  table: MediatorTableId
  /** Injectable d20 roller. */
  roll: Roll
  /** Injectable table lookup (production: SalvageUnionReference.RollTables). */
  findTable: FindRollTable
  /** Injectable clock for the recorded timestamp. */
  now?: () => Date
}

/**
 * Rolls a d20 on the given Mediator table and returns the recorded result,
 * with `label`/`value` copied verbatim from the reference table entry.
 * Returns null when the table cannot be found or the roll fails to resolve
 * (missing/drifted reference data) — callers surface that as a no-op.
 */
export function performMediatorRoll({
  table,
  roll,
  findTable,
  now,
}: MediatorRollInput): MediatorRollResult | null {
  const clock = now ?? (() => new Date())
  const refTable = findTable(MEDIATOR_TABLE_NAMES[table])
  if (!refTable) return null

  const d20 = roll(20)
  // Single structural assertion: FindRollTable is deliberately loose so test
  // fakes don't need the full reference table union (see the type's doc).
  const resolved = resultForTable(refTable.table as SURefRollTable['table'] | undefined, d20)
  if (!resolved.success) return null

  return {
    table,
    roll: d20,
    ...(resolved.result.label !== undefined ? { label: resolved.result.label } : {}),
    value: resolved.result.value,
    rolledAt: clock().toISOString(),
  }
}

/** One-line readout for a recorded Mediator roll (HeatCheckControl style). */
export function describeMediatorRoll(result: MediatorRollResult): string {
  const band = result.label ? ` — ${result.label}` : ''
  return `${MEDIATOR_TABLE_LABEL[result.table]}: rolled ${result.roll}${band}. ${result.value}`
}
