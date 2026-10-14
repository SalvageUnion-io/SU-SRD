import type { Fact } from 'salvageunion-reference'
import type { StatItem } from '../../components/containers/statsBarTypes'

/**
 * The model's facts as Stat cells (E9, E17): the entity's own facts first
 * (TL, then its stats), then its facets (RNG, DMG, a datavalue), each value
 * in its short form where it has one (`RNG | C`). A fact the context already
 * states is omitted by key (`tech-level` under a TL slab).
 */
export function factCells(
  facts: readonly Fact[],
  omit: readonly string[] = [],
  /** `full` keeps every value whole, as a Page's band prints it (`RNG | Close`). */
  values: 'short' | 'full' = 'short'
): StatItem[] {
  return facts
    .filter((fact) => !omit.includes(fact.key))
    .map((fact) => ({
      key: fact.key,
      label: fact.short,
      value: values === 'short' ? (fact.shortValue ?? fact.value) : fact.value,
      ...(fact.group ? { group: fact.group } : {}),
      ...(fact.hint ? { hoverText: fact.hint } : {}),
    }))
}
