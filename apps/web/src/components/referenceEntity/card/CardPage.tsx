import type { ElementType, ReactNode } from 'react'
import type { RefMetaEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import { cn } from '../../../lib/cn'
import { itemHref } from '../../../lib/entityHref'
import { Slab } from '../../atoms/Slab'
import { StatColumn } from '../../atoms/StatColumn'
import { SlabSection } from '../../containers/SlabSection'
import { Entity } from '../../entity/Entity'
import { abilityTreeNeighbours } from './abilityTreeRelations'
import type { Down } from './cardChrome'
import { cardKey, nestedTitleLevel } from './cardHelpers'
import { pageBodyStats } from './entityPage'
import { PatternLinkRows } from './PatternListRow'
import type { NestedCard, ReferenceCardEntity } from './referenceEntityCardTypes'

/**
 * CardPage — the card when it IS the page (`presentation="page"`, boards 07
 * and 08). No frame, header or footer: the page's `ChapterBand` carries
 * the title and stamps, its `ChapterFoot` the citation. The line art is the
 * hero on the left; beside it a chassis's stats, inline and first, then the
 * prose and the chassis ability (every other entity's stats ride the band:
 * `EntityPageStamps`); then everything
 * the entity carries, full width — its table, its other actions, its nested cards and its patterns as
 * link rows. A pattern page leads the right column with the pattern itself
 * (`opening`), then the base chassis's prose under its own slab.
 *
 * The card decides what each part is (`ReferenceEntityCardInner`); this lays
 * the parts out as a page. Layout is `index.css`'s `.su-entity-page*`, which
 * keeps this DOM order at every width, so tab order matches what you see.
 */

/** A neighbour's Section names its relation, so its Mini drops the type stamp. */
const NEIGHBOUR_OMIT = ['kind'] as const

type CardPageProps = {
  entity: RefMetaEntity
  /** The artwork, as `CardImage hero`. */
  hero: ReactNode
  /** Chassis abilities: framed cards in the right column, beneath the prose. */
  leadActions: ReferenceCardEntity[]
  /** Every other action: framed cards under an "Actions" stamp, full width. */
  otherActions: ReferenceCardEntity[]
  /**
   * What the page leads with, above the entity's own prose: a pattern page's
   * pattern prose, before the base chassis it is built on.
   */
  opening?: ReactNode
  /** A pattern page's loadout (`PatternLoadoutRows`, nothing when empty), under the chassis ability. */
  loadout?: ReactNode
  /** A solid slab naming the prose when something else leads ("Mazona chassis"). */
  bodyLabel?: string
  /** The "//" line and any `subtitleExtra`. */
  subLine: ReactNode
  /** The prose body (`bodyContent`), or null when there is none. */
  body: ReactNode
  /** The entity's own roll table, framed on the page. */
  table: ReactNode
  /** A guide's steps (`GuideSteps`): on a page they follow the prose, full section. */
  guide?: ReactNode
  /** The nested cards. */
  sections: ReactNode
  /** A basic host's patterns, as full-width link rows. */
  patterns: RefObjectAnyPattern[]
  /** `afterExtraContent` and `expand`. */
  after: ReactNode
  sectionAs?: ElementType
  /** How each action card renders: the card itself, at depth 1. */
  action: {
    NestedCard: NestedCard
    hostDown: Down
    hostName: string
    chassisName: string | undefined
  }
}

export function CardPage({
  entity,
  hero,
  leadActions,
  otherActions,
  opening,
  loadout,
  bodyLabel,
  subLine,
  body,
  table,
  guide,
  sections,
  patterns,
  after,
  sectionAs,
  action,
}: CardPageProps) {
  const { NestedCard } = action
  // A chassis's stats lead its body, a pattern page's too (they are the chassis's).
  const stats = pageBodyStats(entity)
  // `titleAs` is the card title's element: an `h3` only where a section band's
  // `h2` holds the card (`nestedTitleLevel`), else the header's `span`.
  const actionCard = (data: ReferenceCardEntity, index: number, titleAs: 'h3' | undefined) => (
    <NestedCard
      key={cardKey(data, index)}
      data={data}
      size="compact"
      depth={1}
      titleAs={titleAs}
      // Every action on a page reads at the regular size (14px), the chassis
      // ability's and the rest alike.
      readable
      hostDown={action.hostDown}
      hostName={action.hostName}
      chassisName={action.chassisName}
    />
  )

  // A page with nothing to lead with (a guide whose words are all in its steps,
  // "Salvaging") opens on its sections, not on an empty row and its gap.
  const hasMain =
    !!hero || stats.length > 0 || !!opening || !!subLine || !!body || leadActions.length > 0

  return (
    <div
      className={cn(
        'su-entity-page',
        !!hero && 'su-entity-page--flow',
        !!guide && 'su-entity-page--guide'
      )}
    >
      {hasMain && (
        <div className={cn('su-entity-page__main', !!hero && 'su-entity-page__main--art')}>
          {hero && <div className="su-entity-page__art">{hero}</div>}
          <div className="su-entity-page__side">
            {stats.length > 0 && (
              <div className="su-entity-page__stats">
                <StatColumn stats={stats} label={`${action.hostName} stats`} />
              </div>
            )}
            {opening && <div className="su-entity-page__opening">{opening}</div>}
            {(subLine || body) && (
              <div className="su-entity-page__prose">
                {bodyLabel && <Slab as={sectionAs} label={bodyLabel} flush />}
                {subLine}
                {body}
              </div>
            )}
            {leadActions.length > 0 && (
              <div className="su-entity-page__lead">
                {/* No band holds the chassis ability (the page's h1 is the
                    ChapterBand above), so its title stays a span: an h3 here
                    would skip a level. */}
                {leadActions.map((data, index) => actionCard(data, index, undefined))}
              </div>
            )}
            {/* A pattern page's Systems and Modules follow its chassis
                ability: pattern → chassis ability → Systems → Modules. */}
            {loadout}
          </div>
        </div>
      )}
      {table && <div className="su-entity-page__table">{table}</div>}
      {otherActions.length > 0 && (
        <SlabSection
          as={sectionAs}
          title="Actions"
          page
          className="su-entity-page__section"
          bodyClassName="su-entity-page__section-body"
        >
          {otherActions.map((data, index) =>
            actionCard(data, index, nestedTitleLevel(!!sectionAs))
          )}
        </SlabSection>
      )}
      {guide}
      {sections}
      {/* An ability's neighbours in its tree, under the rest (owner, 2026-10-20),
          each a collapsed header: a header-only Mini a line wide that links
          to its Page (owner, 2026-10-20: "should just be a collapsed header
          not the full content"; N2: a head alone is a Mini), a named N8
          exception (`.su-entity-page__neighbours`). */}
      {abilityTreeNeighbours(entity).map(({ label, abilities }) => (
        <SlabSection
          key={label}
          as={sectionAs}
          title={label}
          page
          className="su-entity-page__section"
          bodyClassName="su-entity-page__section-body su-entity-page__neighbours"
        >
          {abilities.map((ability) => (
            <Entity
              key={ability.id}
              size="mini"
              context="play"
              entity={ability}
              mode={{ kind: 'link', href: itemHref('abilities', getEntitySlug(ability)) }}
              omit={NEIGHBOUR_OMIT}
            />
          ))}
        </SlabSection>
      ))}
      <div className="su-entity-page__wide">
        <PatternLinkRows
          chassis={entity}
          chassisName={action.hostName}
          patterns={patterns}
          sectionAs={sectionAs}
          host={{
            hostDown: action.hostDown,
            chassisName: action.chassisName,
          }}
        />
      </div>
      <div className="su-entity-page__wide">{after}</div>
    </div>
  )
}
