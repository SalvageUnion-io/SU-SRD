/**
 * The Discord card's chips, label first (ruleset §3.7) and spelled out, as a
 * full-size value box prints it: Discord has the room the web's compact cells
 * lack. A fact as `**Structure Points** 12`, lines of three, and the cost's
 * pointy box.
 */

import type { EntityModel, Fact } from './types'

/** A fact as a chip, its full label first: `**Structure Points** 12`. */
function factChip(fact: Fact): string {
  return `**${fact.label}** ${fact.value}`
}

/** The facts that have a value, as chips: `**Range** Long`, `**Damage** 9 SP`. */
export function factChips(facts: Fact[]): string[] {
  return facts.filter((fact) => fact.value !== '').map(factChip)
}

/** Chips, three to a line: `**Tech Level** 1 · **Structure Points** 12 · **Energy Points** 4`. */
export function chipLines(chips: string[], perLine = 3): string[] {
  const lines: string[] = []
  for (let i = 0; i < chips.length; i += perLine) {
    lines.push(chips.slice(i, i + perLine).join(' · '))
  }
  return lines
}

/** The cost as the book's pointy box: `` `1 AP` ``. */
export function costChip(model: EntityModel): string | undefined {
  return model.cost ? `\`${model.cost}\`` : undefined
}
