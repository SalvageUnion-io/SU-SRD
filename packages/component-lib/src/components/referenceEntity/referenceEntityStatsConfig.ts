/**
 * An entity's stats as the card's `StatItem`s and the page's stat column.
 *
 * WHICH stats an entity carries, in what order, under which names and with
 * what tooltip is the entity model's (`entityStats` / `bookStats` in
 * `salvageunion-reference`, `lib/view/parts/facts.ts`); this module only
 * shapes those facts for `Stat`.
 */

import type {
  SURefEnumSchemaName,
  SURefMetaEntity,
  SURefObjectBonusPerTechLevel,
} from 'salvageunion-reference'
import { bookStats, entityStats } from 'salvageunion-reference'
import type { StatItem } from '../containers/statsBarTypes'

type BuildReferenceEntityStatsOptions = {
  compact: boolean
  primaryOnly?: boolean
  techLevel?: number | 'B' | 'N'
  /** Schema name of the entity — used to scope schema-specific stat derivations. */
  schemaName?: SURefEnumSchemaName
}

/**
 * The entity's stats as `StatItem`s, zero and absent ones dropped. Compact
 * shows ONE label, the stat's short form (SP / HP / EP / SV); full size sets
 * the full name on two lines ("Structure" / "Points").
 */
export function buildReferenceEntityStats(
  data: SURefMetaEntity | SURefObjectBonusPerTechLevel,
  options: BuildReferenceEntityStatsOptions
): StatItem[] {
  const { compact, primaryOnly = false, techLevel, schemaName } = options
  return entityStats(data as SURefMetaEntity, { schemaName, techLevel })
    .filter((fact) => !primaryOnly || fact.primary)
    .map((fact) => {
      const [top = fact.label, ...rest] = fact.label.split(' ')
      return {
        key: fact.key,
        label: compact ? fact.short : top,
        bottomLabel: compact ? undefined : rest.join(' '),
        value: fact.value,
        hoverText: fact.hint,
      }
    })
}

/** One cell of the book's stat column: `14 | STRUCTURE PTS.` */
export type BookStat = {
  key: string
  label: string
  value: string
  hoverText?: string
}

/**
 * The entity page's stat column: every stat the entity carries, in the book's
 * order and the book's own words (Tech Level between Cargo Cap. and Salvage
 * Value). The same facts as the card's header cells, so the two never disagree
 * on a value.
 */
export function buildBookStats(
  data: SURefMetaEntity,
  options: { techLevel?: number | 'B' | 'N'; schemaName?: SURefEnumSchemaName }
): BookStat[] {
  return bookStats(data, options).map((fact) => ({
    key: fact.key,
    label: fact.label,
    value: fact.value,
    ...(fact.hint ? { hoverText: fact.hint } : {}),
  }))
}
