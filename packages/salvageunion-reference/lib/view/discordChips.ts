/**
 * The Discord card's chips, label first as the web cards print them (ruleset
 * §3.7): a fact as `**SP** 12`, lines of three, and the cost's pointy box.
 */

import type { EntityModel, Fact } from './types'

/** A fact as a chip, label first in the web cards' short label: `**SP** 12`. */
function factChip(fact: Fact): string {
  return `**${fact.short}** ${fact.value}`
}

/** The facts that have a value, as chips: `**RNG** Long`, `**DMG** 9 SP`. */
export function factChips(facts: Fact[]): string[] {
  return facts.filter((fact) => fact.value !== '').map(factChip)
}

/** Chips, three to a line: `**TL** 1 · **SP** 12 · **EP** 4`. */
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
