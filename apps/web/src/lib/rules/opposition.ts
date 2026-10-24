/**
 * The Opposition's rules: what an NPC tracks (HP or SP), when it is down, the
 * Morale roll (Core Book p.268), and what an important NPC adds (p.255).
 *
 * Pure apart from the reference lookups, and the die is injected, so tests
 * pick the roll. The Mediator's Opposition reads its rows through these
 * (`play/mediator/opposition.model.ts`).
 */

import type { EncounterNpc } from 'game-domain/schemas/encounterNpc'
import type { RefEntity } from 'salvageunion-reference'
import {
  NO_EFFECT,
  resultForTable,
  rollOnTable,
  SalvageUnionReference,
} from 'salvageunion-reference'
import type { Roll } from 'salvageunion-reference/rules'
import { performHeatCheck } from 'salvageunion-reference/rules'

/** One Morale roll, as an encounter NPC stores its last one. */
export type MoraleRoll = NonNullable<EncounterNpc['lastMediatorRoll']>

/** A reference entity's HP or SP, whichever it tracks. */
export function trackOf(entity: RefEntity): { maxHp: number; statKind: 'hp' | 'sp' } {
  if ('structurePoints' in entity && typeof entity.structurePoints === 'number') {
    return { maxHp: entity.structurePoints, statKind: 'sp' }
  }
  if ('hitPoints' in entity && typeof entity.hitPoints === 'number') {
    return { maxHp: entity.hitPoints, statKind: 'hp' }
  }
  return { maxHp: 0, statKind: 'hp' }
}

/**
 * At 0 HP or SP an NPC is down. Shown as down, never removed for you
 * (ADR-007). A row with no tracked maximum is never down.
 */
export function isDown(currentHp: number, maxHp: number): boolean {
  return maxHp > 0 && currentHp <= 0
}

/**
 * Roll Morale: a d20 on the reference "Morale" table (Core Book p.268). Null
 * when the table cannot be read, so the button says so rather than inventing a
 * result; a roll that lands on no row reads `NO_EFFECT`, as everywhere else.
 */
export function rollMorale(rollD20: () => number, now: string): MoraleRoll | null {
  const table = SalvageUnionReference.RollTables.getByName('Morale')
  const outcome = rollOnTable(table?.table, rollD20)
  if (!outcome.success || outcome.kind === 'columns') return null
  if (outcome.kind === 'no-effect') {
    return { table: 'morale', roll: outcome.roll, value: NO_EFFECT, rolledAt: now }
  }
  return {
    table: 'morale',
    roll: outcome.roll,
    ...(outcome.label === undefined ? {} : { label: outcome.label }),
    value: outcome.value,
    rolledAt: now,
  }
}

/**
 * What marking an NPC important adds (Workshop Manual p.254-255): a mech
 * tracks its chassis's EP and Heat, and any of them may roll its Critical
 * table at 0, Critical Damage for SP and Critical Injury for HP. Bio-Titans
 * and Meld have their own rules at 0 SP, so they are never marked.
 */
export type ImportantTrack = {
  reactor: { maxEp: number; heatCap: number } | null
  critical: 'critical-damage' | 'critical-injury'
}

/** Null when the NPC cannot be marked important. */
export function importantTrackOf(
  schema: string | null,
  entity: RefEntity | null,
  statKind: 'hp' | 'sp'
): ImportantTrack | null {
  if (schema === 'bio-titans' || schema === 'meld') return null
  const reactor =
    entity !== null &&
    'energyPoints' in entity &&
    typeof entity.energyPoints === 'number' &&
    'heatCapacity' in entity &&
    typeof entity.heatCapacity === 'number'
      ? { maxEp: entity.energyPoints, heatCap: entity.heatCapacity }
      : null
  return { reactor, critical: statKind === 'sp' ? 'critical-damage' : 'critical-injury' }
}

/** The tables only an important NPC rolls, by their stored ids. */
export const IMPORTANT_TABLES = ['critical-damage', 'critical-injury', 'heat-check'] as const

/** A table only an important NPC rolls. */
export type ImportantTable = (typeof IMPORTANT_TABLES)[number]

/** A stored roll on one of them. */
export type ImportantRoll = MoraleRoll & { table: ImportantTable }

/** Whether a stored roll reads as one (an older or odd row may not). */
export function isImportantRoll(value: unknown): value is ImportantRoll {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.roll === 'number' && (IMPORTANT_TABLES as readonly unknown[]).includes(v.table)
}

/** The reference roll table a Critical id names: its slug is the id. */
export function criticalTable(table: ImportantTrack['critical']) {
  return SalvageUnionReference.RollTables.getBySlug(table)
}

/** A Critical roll: the row it landed on, and the HP or SP it sets (1 on a 20). */
export type NpcCritical = { result: ImportantRoll; nextHp: number | null }

/**
 * Roll an important NPC's Critical table at 0 (Workshop Manual p.255): the
 * book's row, verbatim. Only a Miraculous Survival changes a number, to 1, the
 * one result that applies itself (play.md §14.3); the rest are the Mediator's
 * to narrate. Null when the table cannot be read.
 */
export function rollNpcCritical(
  table: ImportantTrack['critical'],
  rollD20: () => number,
  now: string
): NpcCritical | null {
  const outcome = rollOnTable(criticalTable(table)?.table, rollD20)
  if (!outcome.success || outcome.kind !== 'flat') return null
  return {
    result: {
      table,
      roll: outcome.roll,
      ...(outcome.label === undefined ? {} : { label: outcome.label }),
      value: outcome.value,
      rolledAt: now,
    },
    nextHp: outcome.roll === 20 ? 1 : null,
  }
}

/** The Reactor Overload table, by its slug. */
export const REACTOR_OVERLOAD = 'reactor-overload'

/**
 * A Heat Check as it fell: the check's d20 against the Heat, and on an
 * overload the Reactor Overload row it landed on, verbatim. `nextSp` is the
 * SP an overheat leaves.
 */
export type NpcHeatCheck = {
  roll: number
  heat: number
  overload: { roll: number; label: string | null; value: string } | null
  nextSp: number
}

/**
 * An important mech's Heat Check (Core Book p.234), the pilot's own rule
 * (`performHeatCheck`): a d20 at or under its Heat overloads, and the
 * Reactor Overload row is read. An overheat's SP damage applies, as it does
 * to a pilot's mech; a destroyed System or Module, a meltdown and a shutdown
 * are the Mediator's to narrate (ADR-007). Null when the table cannot be read.
 */
export function npcHeatCheck(
  heat: number,
  currentSp: number,
  roll: Roll,
  now: string
): NpcHeatCheck | null {
  const effect = performHeatCheck({ heat, currentSP: currentSp, roll, now: () => new Date(now) })
  const { heatCheckRoll, overloaded, overloadRoll } = effect.result
  if (!overloaded || overloadRoll === undefined) {
    return { roll: heatCheckRoll, heat, overload: null, nextSp: currentSp }
  }
  const row = resultForTable(
    SalvageUnionReference.RollTables.getBySlug(REACTOR_OVERLOAD)?.table,
    overloadRoll
  )
  if (!row.success) return null
  return {
    roll: heatCheckRoll,
    heat,
    overload: { roll: overloadRoll, label: row.result.label ?? null, value: row.result.value },
    nextSp: effect.nextSP,
  }
}
