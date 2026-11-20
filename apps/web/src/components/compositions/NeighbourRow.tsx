import type { ElementType } from 'react'
import type { RefMetaEntity } from 'salvageunion-reference'
import { cn } from '../../lib/cn'
import { SlabSection } from '../containers/SlabSection'
import { Entity } from '../entity/Entity'

/** A neighbour's Section names its relation, so its Compact drops the type stamp. */
const NEIGHBOUR_OMIT = ['kind'] as const
/** A neighbour opens its Page where the surface keeps it: the SRD's route, the app's dialog. */
const LINK = { kind: 'link' } as const

export type Neighbour = {
  label: string
  entities: readonly RefMetaEntity[]
  /** The forward side (Next): its name sits at its end. */
  end?: boolean
}

/**
 * NeighbourRow — the one way a Page shows what comes before and after it, at
 * the foot of its main column (level 1, ruleset N1: its Compacts are the
 * Page's, never nested in an entity): an ability's Preceding and Next in its tree,
 * a reference entry's Previous and Next in its list. Two half-width Sections
 * side by side where the column has room (stacked where it has not), each a
 * linked Compact under its relation's name; the forward side's name sits at
 * its end, so the pair reads back and forward.
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
          title={label}
          page
          className={cn('su-entity-page__section', end && 'su-entity-page__section--end')}
          bodyClassName={cn('su-entity-page__section-body', 'su-entity-page__neighbours')}
        >
          {entities.map((entity) => (
            <Entity
              key={entity.id}
              size="compact"
              context="play"
              entity={entity}
              mode={LINK}
              omit={NEIGHBOUR_OMIT}
            />
          ))}
        </SlabSection>
      ))}
    </div>
  )
}
