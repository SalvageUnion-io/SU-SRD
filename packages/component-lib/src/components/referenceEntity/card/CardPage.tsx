import type { ElementType, ReactNode } from 'react'
import type {
  SURefEnumSchemaName,
  SURefMetaEntity,
  SURefObjectAnyPattern,
} from 'salvageunion-reference'
import { cn } from '../../../utils/cn'
import { Slab } from '../../chrome/Slab'
import { StatColumn } from '../../shared/StatColumn'
import { buildBookStats } from '../referenceEntityStatsConfig'
import { cardKey } from './cardHelpers'
import { PatternLinkRows } from './PatternListRow'
import type { NestedCard, ReferenceCardEntity } from './referenceEntityCardTypes'

/**
 * CardPage — the card when it IS the page (`presentation="page"`, boards 07
 * and 08). No frame, seam, header or footer: the page's `ChapterBand` carries
 * the title and stamps, its `ChapterFoot` the citation. The line art is the
 * hero on the left; beside it the prose, the book's stat column and, beneath
 * the stats, the chassis ability; then everything the entity carries, full
 * width — its table, its other actions, its nested trays and its patterns as
 * link rows. A pattern page leads the right column with the pattern itself
 * (`opening`), then the base chassis's prose under its own slab.
 *
 * The card decides what each part is (`ReferenceEntityCardInner`); this lays
 * the parts out as a page. Layout is `index.css`'s `.su-entity-page*`, which
 * keeps this DOM order at every width, so tab order matches what you see.
 */

type CardPageProps = {
  entity: SURefMetaEntity
  /** The title, for the stat column's name. */
  name: string
  /** The artwork, as `CardImage hero`. */
  hero: ReactNode
  /** Chassis abilities: framed cards in the right column, beneath the stats. */
  leadActions: ReferenceCardEntity[]
  /** Every other action: framed cards under an "Actions" stamp, full width. */
  otherActions: ReferenceCardEntity[]
  /**
   * What the page leads with, above the entity's own prose: a pattern page's
   * pattern prose, before the base chassis it is built on.
   */
  opening?: ReactNode
  /** A pattern page's loadout (`PatternLoadoutRows`, nothing when empty), under the stat column. */
  loadout?: ReactNode
  /** A solid slab naming the prose when something else leads ("Mazona chassis"). */
  bodyLabel?: string
  /** The "//" line and any `subtitleExtra`. */
  subLine: ReactNode
  /** The prose body (`bodyContent`), or null when there is none. */
  body: ReactNode
  /** The stat column's source; `null` hides it (`hide.stats`). */
  stats: { techLevel?: number | 'B' | 'N'; schemaName?: SURefEnumSchemaName } | null
  /** The entity's own roll table, framed on the page. */
  table: ReactNode
  /** A consumer's replacement for the actions (`abilitiesSection`). */
  abilitiesSection: ReactNode
  /** A guide's steps (`GuideSteps`): on a page they follow the prose, full section. */
  guide?: ReactNode
  /** The nested trays. */
  sections: ReactNode
  /** A basic host's patterns, as full-width link rows. */
  patterns: SURefObjectAnyPattern[]
  /** `afterExtraContent` and `expand`. */
  after: ReactNode
  sectionAs?: ElementType
  /** How each action card renders: the card itself, at depth 1. */
  action: {
    NestedCard: NestedCard
    hostDown: boolean
    hostName: string
    chassisName: string | undefined
  }
}

export function CardPage({
  entity,
  name,
  hero,
  leadActions,
  otherActions,
  opening,
  loadout,
  bodyLabel,
  subLine,
  body,
  stats,
  table,
  abilitiesSection,
  guide,
  sections,
  patterns,
  after,
  sectionAs,
  action,
}: CardPageProps) {
  // The page's band carries the Tech Level at full size (srd's
  // `EntityPageStamps`), so the column does not print it twice.
  const bookStats = stats
    ? buildBookStats(entity, stats).filter((stat) => stat.key !== 'tech-level')
    : []
  const { NestedCard } = action
  const actionCard = (data: ReferenceCardEntity, index: number, seal?: string) => (
    <NestedCard
      key={cardKey(data, index)}
      data={data}
      size="medium"
      depth={1}
      readable={!!seal}
      hostDown={action.hostDown}
      hostName={action.hostName}
      chassisName={action.chassisName}
      parentSeal={seal ? { label: seal, tone: 'var(--color-ink)' } : undefined}
    />
  )

  // A page with nothing to lead with (a guide whose words are all in its steps,
  // "Salvaging") opens on its sections, not on an empty row and its gap.
  const hasMain =
    !!hero || !!opening || !!subLine || !!body || bookStats.length > 0 || leadActions.length > 0

  return (
    <div className={cn('su-entity-page', !!hero && 'su-entity-page--flow')}>
      {hasMain && (
        <div className={cn('su-entity-page__main', !!hero && 'su-entity-page__main--art')}>
          {hero && <div className="su-entity-page__art">{hero}</div>}
          <div className="su-entity-page__side">
            {opening && <div className="su-entity-page__opening">{opening}</div>}
            {(subLine || body) && (
              <div className="su-entity-page__prose">
                {bodyLabel && <Slab as={sectionAs} variant="solid" label={bodyLabel} />}
                {subLine}
                {body}
              </div>
            )}
            {bookStats.length > 0 && (
              <div className="su-entity-page__stats">
                <StatColumn stats={bookStats} label={`${name} stats`} />
              </div>
            )}
            {loadout}
            {leadActions.length > 0 && (
              <div className="su-entity-page__lead">
                {leadActions.map((data, index) => actionCard(data, index, 'Chassis Ability'))}
              </div>
            )}
          </div>
        </div>
      )}
      {table && <div className="su-entity-page__table">{table}</div>}
      {abilitiesSection && <div className="su-entity-page__wide">{abilitiesSection}</div>}
      {!abilitiesSection && otherActions.length > 0 && (
        <section className="su-entity-page__section">
          <Slab as={sectionAs} variant="solid" label="Actions" count={otherActions.length} />
          {otherActions.map((data, index) => actionCard(data, index))}
        </section>
      )}
      {guide}
      {sections}
      <div className="su-entity-page__wide">
        <PatternLinkRows
          chassis={entity}
          chassisName={action.hostName}
          patterns={patterns}
          sectionAs={sectionAs}
          host={{
            NestedCard,
            hostDown: action.hostDown,
            chassisName: action.chassisName,
          }}
        />
      </div>
      <div className="su-entity-page__wide">{after}</div>
    </div>
  )
}
