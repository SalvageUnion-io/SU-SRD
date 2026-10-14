/**
 * The Discord card's chips, label first (ruleset §3.7) and spelled out, as a
 * full-size value box prints it: Discord has the room the web's compact cells
 * lack. A fact as `**Structure Points** 12`, lines of three, and the cost's
 * pointy box.
 */

import { STAT_LABELS } from './parts/facts'
import type { EntityModel, Fact } from './types'

/** The pool a damage comes off, spelled out: `9 SP` → `9 Structure Points`. */
const DAMAGE_POOL: Record<string, string> = {
  SP: STAT_LABELS.structurePoints.label,
  HP: STAT_LABELS.hitPoints.label,
}

/** A fact as a chip, its full label first: `**Structure Points** 12`. */
function factChip(fact: Fact): string {
  const value =
    fact.key === 'damage'
      ? fact.value.replace(/ (SP|HP)$/, (_, pool: string) => ` ${DAMAGE_POOL[pool]}`)
      : fact.value
  return `**${fact.label}** ${value}`
}

/** The facts that have a value, as chips: `**Range** Long`, `**Damage** 9 Structure Points`. */
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

/** A cost's currency spelled out, singular: `AP` is Ability Point. */
const CURRENCY: Record<string, string> = { AP: 'Ability Point', EP: 'Energy Point' }

/** The cost as the book's pointy box, spelled out: `` `1 Ability Point` ``, `` `2 Energy Points` ``. */
export function costChip(model: EntityModel): string | undefined {
  if (!model.cost) return undefined
  const cost = model.cost.replace(/^(\S+) (AP|EP)$/, (_, amount: string, currency: string) => {
    const name = CURRENCY[currency]
    return `${amount} ${name}${amount === '1' ? '' : 's'}`
  })
  return `\`${cost}\``
}
