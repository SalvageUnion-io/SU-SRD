/**
 * Dashboard rolls, written to the Game's log
 * ([ADR-038](../../../../../docs/ARCHITECTURE.md#adr-038) §2;
 * docs/architecture/dashboard-redesign.md §3).
 *
 * Every die the Dashboard rolls — the core roll and its Push, a Heat Check,
 * Critical Damage and Critical Injury, a roll table, Area Salvage — becomes one
 * `changeLog` row on the Game: `entityType 'game'`, `field 'roll'`,
 * `source 'dashboard'`, the shape `botClient.recordRoll` writes for Discord.
 * `appendChangeLog` takes it from any member, and `changeLog.rolls` reads it
 * back for the Log tab, so the crew sees every roll whichever surface made it.
 *
 * The roll is a record of something that already happened on screen, so it is
 * sent and not awaited, like the rest of the change log (`commitChangeLog`).
 * A roll that fails to land is reported, never shown as a failed roll. Outside
 * a Game there is no log to write to, and nothing is sent.
 */

import type { ContainerFields } from '../../lib/container'
import { containerOf } from '../../lib/container'
import { commitChangeLog } from '../../stores/entityBackend'

/** Which roll it was. The Log tab reads `description`; `result` keeps the numbers. */
export type DashboardRollKind =
  | 'core'
  | 'push'
  | 'heat-check'
  | 'critical-damage'
  | 'critical-injury'
  | 'table'
  | 'area-salvage'

export type DashboardRoll = {
  /** The line the crew reads in the log, e.g. "Rook · Crush: 14, Success". */
  description: string
  /** The die face, where one die decided it (a table names its row in `outcome`). */
  result: { kind: DashboardRollKind; roll: number | null; outcome: string }
}

/**
 * The change-log row a Dashboard roll becomes. Pure, for the round-trip test;
 * generic so a Convex `Id<'games'>` passes through as itself.
 */
export function rollLogEntry<GameId extends string>(
  gameId: GameId,
  roll: DashboardRoll,
  ts: number
) {
  return {
    gameId,
    entityType: 'game' as const,
    entityId: gameId,
    ts,
    kind: 'transaction' as const,
    field: 'roll',
    before: null,
    after: { description: roll.description, result: roll.result },
    source: 'dashboard',
  }
}

/**
 * Write a roll to the log of the Game `owner` is in: the pilot, mech or
 * crawler the roll was made for. A shelf entity has no Game, and is skipped.
 */
export function recordRoll(owner: ContainerFields, roll: DashboardRoll): void {
  const container = containerOf(owner)
  if (container.kind !== 'game') return
  void commitChangeLog([rollLogEntry(container.gameId, roll, Date.now())])
}
