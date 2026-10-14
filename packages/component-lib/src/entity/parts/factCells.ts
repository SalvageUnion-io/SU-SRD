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
      ...(fact.hint ? { hoverText: fact.hint } : {}),
    }))
}

/**
 * A chassis's chips, the same in every form (the Catalog's set, owner's call):
 * TL, SP, EP, SV, SYS, MODS. Cargo and Heat are its Page's.
 */
const CHASSIS_FACT_KEYS: ReadonlySet<string> = new Set([
  'tech-level',
  'ref-stat-structurePoints',
  'ref-stat-energyPoints',
  'ref-stat-salvageValue',
  'ref-stat-systemSlots',
  'ref-stat-moduleSlots',
])

/**
 * The facts a Row, Tile or Token draws for an entity: every fact, but a
 * chassis (and its patterns) keeps its one chip set (`CHASSIS_FACT_KEYS`) in
 * the Catalog, search, a guide and a loadout alike. A player's unit (a
 * synthetic ref: a mech's live `SP | 6/9`) keeps the readings it was given.
 */
export function formFacts(model: {
  ref: { schemaName: string; synthetic?: true }
  facts: readonly Fact[]
}): readonly Fact[] {
  return model.ref.schemaName === 'chassis' && !model.ref.synthetic
    ? model.facts.filter((fact) => CHASSIS_FACT_KEYS.has(fact.key))
    : model.facts
}
