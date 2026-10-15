/**
 * An entity's stats as the card's `StatItem`s and the page's stat column.
 *
 * WHICH stats an entity carries, in what order, under which names and with
 * what tooltip is the entity model's (`entityStats` / `bookStats` in
 * `salvageunion-reference`, `lib/view/parts/facts.ts`); this module only
 * shapes those facts for `Stat`.
 */

import type {
  RefEnumSchemaName,
  RefMetaEntity,
  RefObjectBonusPerTechLevel,
} from 'salvageunion-reference'
import { entityStats } from 'salvageunion-reference'
import type { StatColumnCell } from '../atoms/StatColumn'
import type { StatItem } from '../containers/statsBarTypes'

type BuildReferenceEntityStatsOptions = {
  compact: boolean
  techLevel?: number | 'B' | 'N'
  /** Schema name of the entity — used to scope schema-specific stat derivations. */
  schemaName?: RefEnumSchemaName
}

/**
 * The entity's stats as `StatItem`s, zero and absent ones dropped. Compact
 * shows ONE label, the stat's short form (SP / HP / EP / SV); full size sets
 * the full name on two lines ("Structure" / "Points").
 */
export function buildReferenceEntityStats(
  data: RefMetaEntity | RefObjectBonusPerTechLevel,
  options: BuildReferenceEntityStatsOptions
): StatItem[] {
  const { compact, techLevel, schemaName } = options
  return entityStats(data as RefMetaEntity, { schemaName, techLevel }).map((fact) => {
    const [top = fact.label, ...rest] = fact.label.split(' ')
    return {
      key: fact.key,
      label: compact ? fact.short : top,
      bottomLabel: compact ? undefined : rest.join(' '),
      value: fact.value,
      ...(fact.group ? { group: fact.group } : {}),
      hoverText: fact.hint,
    }
  })
}

/** One cell of the book's stat column: `STRUCTURE POINTS | 14` */
export type BookStat = StatColumnCell
