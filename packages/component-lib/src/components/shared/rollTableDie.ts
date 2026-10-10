import { rollDie } from 'salvageunion-reference/rules'

/**
 * The d20 every banded roll table rolls (`RollTable`, `CardRollTable`).
 *
 * ONE place owns the die, so the dice migration to `@randsum/roller` is a
 * one-line change here rather than a hunt through the components.
 */
export const rollTableDie = (): number => rollDie(20)
