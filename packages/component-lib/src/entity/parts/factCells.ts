import type { Fact } from 'salvageunion-reference'
import type { StatItem } from '../../components/shared/statsBarTypes'

/**
 * The model's facts as Stat cells (E9, E17): the entity's own facts first
 * (TL, then its stats), then its facets (RNG, DMG, a datavalue). A fact the
 * context already states is omitted by key (`tech-level` under a TL slab).
 */
export function factCells(facts: readonly Fact[], omit: readonly string[] = []): StatItem[] {
  return facts
    .filter((fact) => !omit.includes(fact.key))
    .map((fact) => ({
      key: fact.key,
      label: fact.short,
      value: fact.value,
      ...(fact.hint ? { hoverText: fact.hint } : {}),
    }))
}
