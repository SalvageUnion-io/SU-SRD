/**
 * The Opposition's rules: what an NPC tracks (HP or SP), when it is down, and
 * the Morale roll (Core Book p.268).
 *
 * Pure apart from the reference lookups, and the die is injected, so tests
 * pick the roll. The Mediator Dashboard's tray reads its rows through these
 * (`apps/web/src/components/mediator/opposition.model.ts`).
 */

import type { RefEntity } from 'salvageunion-reference'
import { NO_EFFECT, rollOnTable, SalvageUnionReference } from 'salvageunion-reference'
import type { EncounterNpc } from '../schemas/encounterNpc'

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
