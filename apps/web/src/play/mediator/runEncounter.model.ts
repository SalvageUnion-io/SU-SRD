/**
 * Run an encounter's words (play.md §10, ADR-053), pure: how an encounter
 * reads in the dialog's list, and the choice that clears the tray first.
 */

import type { Encounter } from 'game-domain/schemas/encounter'

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** "4 opposition · 3 tables": what running it brings. */
export function encounterLine(encounter: Pick<Encounter, 'opposition' | 'tables'>): string {
  return [
    count(encounter.opposition.length, 'opposition', 'opposition'),
    count(encounter.tables.length, 'table', 'tables'),
  ].join(' · ')
}

/** The clear-first choice, naming what it removes. */
export function trayChoiceLabel(onTray: number): string {
  return `Clear it first (removes ${count(onTray, 'NPC', 'NPCs')} on the tray)`
}
