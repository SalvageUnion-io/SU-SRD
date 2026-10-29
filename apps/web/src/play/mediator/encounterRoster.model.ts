/**
 * An encounter table's roster read for the Mediator (play.md §15): each
 * rolled row's lines (`game-domain/rules/encounterRoster`) against the
 * Opposition's schemas in the picker's order, so the Mediator can field the
 * row in one press.
 */

import type { RosterLine } from 'game-domain/rules/encounterRoster'
import { readRoster as readRosterIn, rosterIndex } from 'game-domain/rules/encounterRoster'
import { OPPOSITION_SCHEMAS } from './opposition.model'

/** Read every line of a row's roster; lines that are no roster line are dropped. */
export function readRoster(lines: readonly string[]): RosterLine[] {
  return readRosterIn(lines, rosterIndex(OPPOSITION_SCHEMAS.map((s) => s.schema)))
}
