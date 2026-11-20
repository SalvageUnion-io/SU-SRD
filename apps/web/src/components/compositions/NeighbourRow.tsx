import type { ElementType } from 'react'
import type { RefMetaEntity } from 'salvageunion-reference'
import { entityRef } from 'salvageunion-reference'
import { cn } from '../../lib/cn'
import { SlabSection } from '../containers/SlabSection'
import { Mention } from '../entity/forms/Mention'

export type Neighbour = {
  label: string
  entities: readonly RefMetaEntity[]
  /** The forward side (Next): its cut-out sits at its end. */
  end?: boolean
}

/**
 * NeighbourRow — the one way a Page shows what comes before and after it: an
 * ability's Preceding and Next in its tree, a reference entry's Previous and
 * Next in its list. Two half-width strips side by side where there is room
 * (stacked where there is not), each only its cut-out: the relation and the
 * neighbour's name, linked, with no body under it. The forward side's cut-out
 * sits at its end, so the pair reads back and forward. On the SRD a Page draws
 * it at its foot, under the body and the sidebar (`EntityPageFrame`'s `foot`).
 */
export function NeighbourRow({
  neighbours,
  as,
}: {
  neighbours: readonly Neighbour[]
  as?: ElementType
}) {
  const shown = neighbours.filter(({ entities }) => entities.length > 0)
  if (shown.length === 0) return null
  return (
    <div className="su-grid su-entity-page__neighbour-row">
      {shown.map(({ label, entities, end }) => (
        <SlabSection
          key={label}
          as={as}
          title={
            <>
              {/* The cut-out's line trims plain spaces: a fixed one keeps the gap. */}
              {label}:{'\u00a0'}
              {entities.map((entity, index) => (
                <span key={entity.id}>
                  {index > 0 && ', '}
                  <Mention entityRef={entityRef(entity)}>{entity.name}</Mention>
                </span>
              ))}
            </>
          }
          page
          className={cn('su-entity-page__section', end && 'su-entity-page__section--end')}
        />
      ))}
    </div>
  )
}
