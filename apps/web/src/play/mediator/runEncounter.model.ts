/**
 * Run an encounter's words (play.md §10, ADR-059), pure: how an encounter
 * reads in the dialog's list, and the choice that clears the tray first.
 */

import type { Encounter } from 'game-domain/schemas/encounter'
import { mediatorCopy } from '../../messages/play-mediator'

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** "4 opposition · 3 tables": what running it brings. */
export function encounterLine(encounter: Pick<Encounter, 'opposition' | 'tables'>): string {
  return [
    count(encounter.opposition.length, 'opposition', 'opposition'),
    count(encounter.tables.length, 'table', 'tables'),
  ].join(' · ')
}

/** One encounter in the dialog's list, and the other Game it was prepared for. */
export type RunChoice<E> = {
  encounter: E
  /** The other Game it is prepared for, named; null for this Game's and the Kit's. */
  otherGame: string | null
}

/**
 * The dialog's list (MD2-17): this Game's encounters first, then the Kit's,
 * then those prepared for another Game, each of which names that Game so it
 * is never run here by mistake. Each band keeps the order it came in.
 */
export function runChoices<E extends Pick<Encounter, 'gameId'>>(
  encounters: readonly E[],
  gameId: string,
  gameName: (gameId: string) => string | null
): RunChoice<E>[] {
  const band = (e: E) => (e.gameId === gameId ? 0 : e.gameId === undefined ? 1 : 2)
  return [0, 1, 2].flatMap((n) =>
    encounters
      .filter((e) => band(e) === n)
      .map((encounter) => ({
        encounter,
        otherGame:
          n === 2 ? (gameName(encounter.gameId ?? '') ?? mediatorCopy('anotherGame')) : null,
      }))
  )
}

/** The line under a choice: what it brings, and the other Game it is for. */
export function choiceLine(choice: RunChoice<Pick<Encounter, 'opposition' | 'tables'>>): string {
  const line = encounterLine(choice.encounter)
  return choice.otherGame === null
    ? line
    : `${line} · ${mediatorCopy('preparedFor', { game: choice.otherGame })}`
}

/** "1 unit", "4 units": what is on the field, counted. A mech or a Bio-Titan is no NPC (MD3-15). */
export function fieldCount(onTray: number): string {
  return count(onTray, 'unit', 'units')
}

/** The clear-first choice, naming what it removes. */
export function trayChoiceLabel(onTray: number): string {
  return mediatorCopy('clearItFirst', { count: fieldCount(onTray) })
}
