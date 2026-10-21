import type { FacetCell, RefEnumSchemaName } from 'salvageunion-reference'
import { glossaryRef } from 'salvageunion-reference'
import type { StatItem } from '../../containers/statsBarTypes'
import type { TagItem } from '../../entity'
import { actionTypeStamps } from '../../entity'

/**
 * One facet of the card — an action's type, range or damage, a trait, a
 * datavalue — as the entity model states it (`facetCells`), with what a
 * choice or the Tech Level changed marked. E17 splits these three ways
 * (`splitFacets`); there is no "//" line.
 */
export type CardFacetCell = {
  key: string
  label: string
  value?: string | number
  /** Marks a stat a choice or the Tech Level changed (the modified-stats language). */
  borderColor?: string
  /** The rules entity the cell names (a trait, a keyword), for its hovercard. */
  entityRef?: { schemaName: RefEnumSchemaName; name: string }
  /** The entity model's facet this cell is. */
  facet?: Pick<
    FacetCell,
    'kind' | 'short' | 'shortValue' | 'group' | 'actionType' | 'mention' | 'modified'
  >
}

/** The facets, split (E17): the head's action-type stamps, the Stat cells, the Tags. */
export type SplitFacets = { stamps: string[]; facts: StatItem[]; tags: TagItem[] }

export function splitFacets(cells: readonly CardFacetCell[]): SplitFacets {
  const typeOf = (key: string) => cells.find((c) => c.key === key)?.facet?.actionType
  const stamps = actionTypeStamps(typeOf('action-type'), typeOf('action-type-mech'))
  const facts: StatItem[] = []
  const tags: TagItem[] = []
  for (const cell of cells) {
    const kind = cell.facet?.kind ?? (cell.entityRef ? 'trait' : 'fact')
    const value = cell.value == null || cell.value === '' ? undefined : String(cell.value)
    const modified = !!cell.facet?.modified || !!cell.borderColor
    if (kind === 'fact') {
      facts.push({
        key: cell.key,
        label: cell.facet?.short ?? cell.label,
        // A Card is no Page: its range is the book's code (`RNG | C`, ruleset §2.6).
        value: cell.facet?.shortValue ?? value,
        group: cell.facet?.group ?? 'action',
        ...(modified ? { state: 'modified' as const } : {}),
      })
    } else if (kind === 'trait') {
      const mention = cell.facet?.mention
      const ref = mention ? glossaryRef(mention.schemaName, mention.name) : undefined
      tags.push({
        key: cell.key,
        name: cell.label,
        ...(value !== undefined ? { param: value } : {}),
        ...(ref ? { ref } : {}),
        ...(modified ? { modified: true } : {}),
      })
    }
  }
  return { stamps, facts, tags }
}
