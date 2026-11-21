import type { ElementType, ReactNode } from 'react'
import type { RefMetaEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import { getChoices, toEntityModel } from 'salvageunion-reference'
import { RowRules } from '../../../build/dash/RowRules'
import { cn } from '../../../lib/cn'
import { referenceEntityCopy } from '../../../messages/components-reference-entity'
import { Slab } from '../../atoms/Slab'
import { Stat } from '../../atoms/Stat'
import { StatColumn } from '../../atoms/StatColumn'
import { NeighbourRow } from '../../compositions/NeighbourRow'
import { SlabSection } from '../../containers/SlabSection'
import { ChipLink, factRef } from '../../entity'
import { useEntitySurface } from '../../entity/entitySurfaceContext'
import { Mention } from '../../entity/forms/Mention'
import { abilityTreeNeighbours } from './abilityTreeRelations'
import { splitActions } from './actionSplit'
import { ChoiceRegion } from './ChoiceRegion'
import type { Down } from './cardChrome'
import { cardKey, nestedTitleLevel, stackedTitleLevel } from './cardHelpers'
import { pageBodyStats, pageStatLine } from './entityPage'
import { ActionMinis } from './NestedCards'
import { PatternLedger } from './PatternLedger'
import type { NestedCard, ReferenceCardEntity } from './referenceEntityCardTypes'

/**
 * CardPage — the card when it IS the page (`presentation="page"`). No frame,
 * header or footer: the page's `ChapterBand` carries the title and stamps, its
 * `ChapterFoot` the citation. The card decides what each part is
 * (`ReferenceEntityCardInner`); this lays the parts out as a page.
 *
 * **Every entity's Page** (`ManualPage`, `.su-manual`, ruleset §1.7): the
 * numbers first, every book stat in the stat order (§2.6) as the book's stat
 * column, four to a row. Then the rules: the chassis ability and the actions
 * as the app's action Minis (`ActionMinis`: an action's own rules text), the
 * nested cards, the table, the patterns as one Ledger (`PatternLedger`). The
 * side column (from `lg`, floated right so the rules run the full measure
 * once it ends) is the art with the entity's own words under it, headed
 * Description; with no art it is the Description alone. Words that hold the
 * entity's choices are rules, so they lead the rules column instead. A phone
 * reads stats, art, rules, Description.
 *
 * **A pattern's page and a guide's** keep the art-led layout
 * (`.su-entity-page*`, `styles/partials/entity-page.css`): the line art as the
 * hero on the left; beside it the chassis's stats, the pattern itself
 * (`opening`), the base chassis's prose under its own slab, the chassis
 * ability and the pattern's loadout; a guide's steps follow its prose.
 *
 * Both keep their DOM order at every width, so tab order matches what you see.
 */

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
  /** The body holds the entity's choices, so it is rules, not a description: it leads the rules column. */
  bodyRules?: boolean
  /** The entity's own roll table, framed on the page. */
  table: ReactNode
  /** A guide's steps (`GuideSteps`): on a page they follow the prose, full section. */
  guide?: ReactNode
  /** The nested cards. */
  sections: ReactNode
  /**
   * A crawler type's: its actions stand bare, no "Actions" band, each wearing
   * this seal as its first chip ("Crawler Ability"; Core Book p.212: "a unique
   * Ability … as well as a special NPC").
   */
  actionSeal?: { label: string; tone: string }
  /** A basic host's patterns, as full-width link rows. */
  patterns: RefObjectAnyPattern[]
  /** `asideExtraContent`: under the art in the side track, after `after` on a phone. */
  aside?: ReactNode
  /** `afterExtraContent`. */
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
  actionSeal,
  patterns,
  after,
  aside,
  sectionAs,
  action,
}: CardPageProps) {
  const { NestedCard } = action
  // A chassis's stats lead its body, a pattern page's too (they are the chassis's).
  const stats = pageBodyStats(entity)
  // `titleAs` is the card title's element: an `h3` only where a section band's
  // `h2` holds the card (`nestedTitleLevel`), else the header's `span`.
  const actionCard = (
    data: ReferenceCardEntity,
    index: number,
    titleAs: 'h2' | 'h3' | undefined
  ) => (
    <NestedCard
      key={cardKey(data, index)}
      data={data}
      size="compact"
      depth={1}
      titleAs={titleAs}
      // Every action on a page reads at the regular size (14px), the chassis
      // ability's and the rest alike.
      readable
      parentSeal={actionSeal}
      hostDown={action.hostDown}
      hostName={action.hostName}
      chassisName={action.chassisName}
    />
  )

  // A page with nothing to lead with (a guide whose words are all in its steps,
  // "Salvaging") opens on its sections, not on an empty row and its gap.
  const hasMain =
    !!hero || stats.length > 0 || !!opening || !!subLine || !!body || leadActions.length > 0

  // With art, the page's actions and nested trays stand in the column beside
  // it: the art keeps the top left, a column
  // shorter than its art spreads its blocks evenly down it. Without art they
  // follow the main block.
  const beside = (
    <>
      {otherActions.length > 0 && actionSeal && (
        <div className="su-entity-page__section-body">
          {otherActions.map((data, index) => actionCard(data, index, stackedTitleLevel(true)))}
        </div>
      )}
      {otherActions.length > 0 && !actionSeal && (
        <SlabSection
          as={sectionAs}
          title={referenceEntityCopy('actions')}
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
    </>
  )

  // Preceding and Next side by side on one row, Next's at its end. The app's
  // Page (a dialog, `openPage`) draws them here; the SRD's Page frame draws
  // them at its foot, under the body and the sidebar (`EntityPageFrame`).
  const neighbours = useEntitySurface().openPage ? abilityTreeNeighbours(entity) : []

  // Every entity's Page is the manual's; a pattern's and a guide's keep the
  // art-led layout below.
  // A pattern's Page is the manual's too.
  if (!guide) {
    const line = pageStatLine(entity)
    // The app's action Minis (`MiniGrid`: two or three across by the room),
    // each its own rules text alone. An action's options are the Page's: they
    // stand under the list, as a choice stands in a body.
    const actionList = (list: ReferenceCardEntity[]) => (
      <>
        <ActionMinis
          actions={list}
          size="compact"
          grid={list.length > 1}
          hostName={action.hostName}
          chassisName={action.chassisName}
          hostDown={action.hostDown}
        />
        {list.flatMap((data) =>
          (getChoices(data as RefMetaEntity) ?? []).map((choice) => (
            <ChoiceRegion
              key={choice.id}
              choice={choice}
              effTechLevel={undefined}
              scalingParent={undefined}
              selections={undefined}
              onSelectionChange={undefined}
              compact={false}
              toneColor={undefined}
              depth={0}
              onPage
              chassisName={action.chassisName}
              NestedCard={NestedCard}
            />
          ))
        )}
      </>
    )
    // The words lead the main column, never the side (best, revision 8):
    // the description reads as plain prose at the head of the main column: no
    // strip, no panel. A Page whose body is named otherwise (a pattern's "Mule
    // chassis") keeps its labelled section.
    const loreOnly = !bodyLabel
    const prose = (
      <div className="su-entity-page__prose">
        {subLine}
        {body}
      </div>
    )
    const words =
      !opening &&
      (subLine || body) &&
      (loreOnly ? (
        prose
      ) : (
        <SlabSection
          as={sectionAs}
          // A pattern's Page names the chassis it is built on ("Mule chassis").
          title={bodyLabel ?? referenceEntityCopy('description')}
          page
          className="su-manual__lore"
        >
          {prose}
        </SlabSection>
      ))
    // The chassis ability stands in the side column,
    // under the Description, its tab the paper of its panel.
    // The strip reads "Chassis ability" with the ability's name in it; its
    // body is the ability's words (as a mech sheet's side cell).
    const ability =
      leadActions.length > 0 &&
      leadActions.map((data) => {
        const lead = toEntityModel(data as RefMetaEntity)
        return (
          <SlabSection
            key={lead.ref.slug}
            as={sectionAs}
            title={referenceEntityCopy('chassisAbility')}
            count={<Mention entityRef={lead.ref}>{lead.title}</Mention>}
            page
            className="su-manual__ability"
            bodyClassName={cn('su-entity-page__section-body', 'su-chassis-ability')}
          >
            <RowRules entity={data as RefMetaEntity} chassisName={action.chassisName} />
          </SlabSection>
        )
      })
    // A Page with no art (a system, a module, an
    // ability) keeps its stats in the side track; a Page with art keeps them
    // first in the main one.
    const stats = line.length > 0 && (
      <ul
        className="su-grid su-stat-column su-manual__stats"
        aria-label={`${action.hostName} stats`}
      >
        {line.map((stat) => {
          const cell = (
            <Stat
              label={stat.label}
              shortLabel={stat.shortLabel}
              value={stat.value}
              className="su-stat-column__stat"
            />
          )
          // A stat the glossary defines is a term (E27): a press, hover or
          // focus opens its entry, where a `title` says nothing on a phone.
          // One with no entry keeps its hint as a native tooltip (E23).
          const ref = factRef(stat)
          return (
            <li
              key={stat.key}
              className="su-stat-column__cell"
              title={ref ? undefined : stat.hoverText}
            >
              {ref ? (
                <ChipLink
                  tag={{ key: stat.key, name: stat.label, param: String(stat.value), ref }}
                  linkable
                >
                  {cell}
                </ChipLink>
              ) : (
                cell
              )}
            </li>
          )
        })}
      </ul>
    )
    const statsAside = !hero && line.length > 0
    // A Page with art keeps its actions in the main track, under the art's
    // column. One without holds them in the side track, beside its words; a
    // Page that is mostly actions splits them between the two (`splitActions`).
    const split = hero ? { main: otherActions, side: [] } : splitActions(entity, otherActions)
    const actionsSection = (list: ReferenceCardEntity[], className?: string) =>
      list.length > 0 && (
        // One Actions section on every Page: a crawler's ability too.
        <SlabSection
          as={sectionAs}
          title={actionSeal ? actionSeal.label : referenceEntityCopy('actions')}
          page
          className={className}
          bodyClassName="su-entity-page__section-body"
        >
          {actionList(list)}
        </SlabSection>
      )
    const side = !!hero || statsAside || split.side.length > 0 || !!aside
    return (
      <div className="su-entity-page su-manual">
        {side && (
          <div className="su-manual__side">
            {hero && <div className="su-manual__art">{hero}</div>}
            {statsAside && stats}
            {ability}
            {actionsSection(
              split.side,
              cn(
                'su-manual__side-actions',
                split.main.length > 0 && 'su-manual__side-actions--more'
              )
            )}
            {aside && <div className="su-manual__aside">{aside}</div>}
          </div>
        )}
        {/* The main track, always beside a side
            track (empty or not), so every Page's blocks share one width. */}
        <div className="su-manual__main">
          {loreOnly && words}
          {!statsAside && stats}
          {opening && <div className="su-entity-page__opening">{opening}</div>}
          {!loreOnly && words}
          {!side && ability}
          {opening && loadout}
          {actionsSection(split.main)}
          {sections}
          {table && <div className="su-entity-page__table">{table}</div>}
          {patterns.length > 0 && (
            // The Ledger's title tab names the section and keeps the count.
            <PatternLedger chassis={entity} patterns={patterns} />
          )}
          <NeighbourRow
            as={sectionAs}
            neighbours={neighbours.map(({ label, abilities }) => ({
              label,
              entities: abilities,
              end: label === 'Next',
            }))}
          />
          {after && <div className="su-manual__after">{after}</div>}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'su-entity-page',
        !!hero && 'su-entity-page--art',
        !!guide && 'su-entity-page--guide'
      )}
    >
      {hasMain && (
        <div
          className={cn(
            'su-entity-page__main',
            !!hero && 'su-entity-page__main--art',
            // Its actions wrap under the art.
            !!hero && otherActions.length > 0 && 'su-entity-page__main--wrap'
          )}
        >
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
                {/* A chassis ability is text, never a
                    box: its name, then every word of it. */}
                {leadActions.map((data) => {
                  const lead = toEntityModel(data as RefMetaEntity)
                  return (
                    <div key={lead.ref.slug} className="su-dash-item su-chassis-ability">
                      <p className="su-dash-entity__name">
                        <Mention entityRef={lead.ref}>{lead.title}</Mention>
                      </p>
                      <RowRules entity={data as RefMetaEntity} chassisName={action.chassisName} />
                    </div>
                  )
                })}
              </div>
            )}
            {/* A pattern page's Systems and Modules follow its chassis
                ability: pattern → chassis ability → Systems → Modules. */}
            {loadout}
            {hero && beside}
          </div>
        </div>
      )}
      {table && <div className="su-entity-page__table">{table}</div>}
      {!hero && beside}
      <div className="su-entity-page__wide">{after}</div>
    </div>
  )
}
