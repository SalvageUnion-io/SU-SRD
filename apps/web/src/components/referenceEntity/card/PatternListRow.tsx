import type { CSSProperties, ElementType } from 'react'
import { useMemo } from 'react'
import type { RefEntity, RefMetaEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import {
  entityRef,
  firstParagraphText,
  isBioTitanPattern,
  normalizePatternName,
  toEntityModel,
} from 'salvageunion-reference'
import { cn } from '../../../lib/cn'
import { capsLabel } from '../../atoms/capsLabel'
import { FOCUS_RING } from '../../atoms/interaction'
import { Box } from '../../containers/Box'
import { SlabSection } from '../../containers/SlabSection'
import { Head, paintFor } from '../../entity'
import { useEntitySurface } from '../../entity/entitySurfaceContext'
import { CardLabels } from './CardLabels'
import type { Down } from './cardChrome'
import { isLegalStartingPatternOf } from './legalStartingPattern'
import { PatternLoadout } from './PatternLoadout'
import { PatternUniques } from './PatternUniques'
import type { NestedCard, ReferenceCardEntity } from './referenceEntityCardTypes'
import { resolvePatternDrones, resolvePatternGroups } from './resolveNestedEntities'

/**
 * A pattern's page, where the surface has routes (srd's `hrefFor`): the
 * pattern's ref is its host's under the host's own schema, read off the
 * pattern's shape, so a host handed across an island boundary without its
 * `schemaName` still links. Undefined elsewhere (the app's patterns have no
 * pages), so the row stays inert rather than linking to nowhere.
 */
function usePatternHref(chassis: ReferenceCardEntity, pattern: RefObjectAnyPattern) {
  const { hrefFor } = useEntitySurface()
  const host = entityRef(chassis as RefMetaEntity)
  const schemaName = isBioTitanPattern(pattern) ? 'bio-titans' : 'chassis'
  return hrefFor({ ...host, schemaName, pattern: pattern.name })
}

/** The anchor around a pattern's Token fills its line, as the Token does (N4). */
const LINK = { display: 'block', flex: '1 1 auto', minWidth: 0 } satisfies CSSProperties

/**
 * `PatternListRow` — one entry of a host card's (a chassis's or a
 * Bio-Titan's) Patterns list: the pattern's TOKEN (inside a card it is named
 * by its head alone, EDL N2), linking to the pattern's own page. A Token
 * nests nothing (E6): what the pattern changes (its loadout, a Bio-Titan
 * pattern's actions) is its Peek's and its Page's, never drawn under it here.
 *
 * A real `<a>`, not a click handler: a pattern page is a page like any other
 * entity's, so the entry has to open in a new tab on middle-click, show its
 * destination on hover, and be followable by a crawler. The anchor carries the
 * interaction; the Token inside it takes `cardClickable` for the hover
 * affordance ONLY, which is why it doesn't also become a `role=button` nested
 * inside a link.
 *
 * On a surface with no routes (any app whose patterns have no pages) the row
 * renders inert, not a link to nowhere.
 */
function PatternListRow({
  chassis,
  chassisName,
  pattern,
  depth,
  hostDown,
  NestedCard,
}: {
  chassis: ReferenceCardEntity
  chassisName: string
  pattern: RefObjectAnyPattern
  depth: number
  hostDown?: Down
  NestedCard: NestedCard
}) {
  const href = usePatternHref(chassis, pattern)
  const card = (
    <NestedCard
      data={chassis}
      pattern={pattern}
      size="mini"
      extent="head"
      depth={depth}
      hostDown={hostDown}
      cardClickable={!!href}
    />
  )
  return href ? (
    <a
      href={href}
      aria-label={`${normalizePatternName(pattern.name)} — ${chassisName} pattern`}
      className={FOCUS_RING}
      style={LINK}
    >
      {card}
    </a>
  ) : (
    card
  )
}

/** BASIC HOST CARD → the list of its patterns, each its Token. A Page lists
 * them as its own pattern rows instead (`PatternLinkRows`, level 1). */
export function PatternList({
  chassis,
  chassisName,
  patterns,
  depth,
  hostDown,
  NestedCard,
}: {
  chassis: ReferenceCardEntity
  chassisName: string
  patterns: RefObjectAnyPattern[]
  /** The depth the Tokens render at (the host's + 1). */
  depth: number
  hostDown: Down
  NestedCard: NestedCard
}) {
  return (
    <ul className="su-entity-token-list">
      {patterns.map((pat) => (
        <li key={pat.name}>
          <PatternListRow
            chassis={chassis}
            chassisName={chassisName}
            pattern={pat}
            depth={depth}
            hostDown={hostDown}
            NestedCard={NestedCard}
          />
        </li>
      ))}
    </ul>
  )
}

/**
 * PAGE view — one pattern at level 1, through the forms (EDL E15, hard rule
 * R7): the Row's frame (`Box`, which stands in `RowFrame`) under the Row's
 * `Head` in the host's tone, the pattern's quoted name on its cut-out as the
 * link, then the paper body: the pattern's opening paragraph as prose (a lead
 * is an index's, E11), and under it what the pattern changes: its loadout,
 * Systems beside Modules, one full-width Token a line with its TL at the
 * column's edge (`PatternLoadout`), or the actions a Bio-Titan pattern adds
 * (`PatternUniques`). The HEAD is the link to the pattern's page; the body
 * cannot be, because its names are links of their own.
 */
function PatternLinkRow({
  chassis,
  chassisName,
  pattern,
  host,
}: {
  chassis: ReferenceCardEntity
  chassisName: string
  pattern: RefObjectAnyPattern
  host: PatternRowsHost
}) {
  const href = usePatternHref(chassis, pattern)
  const surface = useEntitySurface()
  const model = useMemo(
    () => toEntityModel(chassis as RefEntity, undefined, { pattern }),
    [chassis, pattern]
  )
  const name = normalizePatternName(pattern.name)
  const description = firstParagraphText(pattern.content)
  // Its drones leave the groups: each carries its own loadout, listed under it.
  const loadout = useMemo(
    () => resolvePatternGroups(pattern).filter((group) => group.label !== 'Drones'),
    [pattern]
  )
  const drones = useMemo(() => resolvePatternDrones(pattern), [pattern])
  const paint = paintFor(model.tone, { down: host.hostDown, texture: surface.texture })
  // The book's starting builds wear their stamp on the row, as on the card.
  const labels = isLegalStartingPatternOf(pattern) ? (
    <CardLabels seal={undefined} axisMarkers={[]} legalStartingPattern />
  ) : undefined
  // The name on the paper cut-out (Head's `notch`): the body below is paper.
  const head = <Head title={`“${name}”`} notch paint={paint} labels={labels} />
  return (
    <li>
      <Box
        head={
          href ? (
            <a
              href={href}
              aria-label={`${name} — ${chassisName} pattern`}
              className={cn('su-pattern-rows__head', FOCUS_RING)}
            >
              {head}
            </a>
          ) : (
            head
          )
        }
      >
        {description && <p className="su-pattern-rows__prose">{description}</p>}
        {(loadout.length > 0 || drones.length > 0) && (
          <PatternLoadout
            groups={loadout}
            drones={drones}
            sectionAs={undefined}
            hostDown={host.hostDown}
            owner={name}
          />
        )}
        <PatternUniques
          className="su-pattern-rows__unique"
          pattern={pattern}
          hostDown={host.hostDown}
          hostName={chassisName}
          chassisName={host.chassisName}
        />
      </Box>
    </li>
  )
}

/** What a page's pattern rows need to render each pattern's uniques. */
type PatternRowsHost = {
  hostDown: Down
  chassisName: string | undefined
}

/** How many patterns a phone shows before "Show all N patterns". */
const PATTERNS_ON_A_PHONE = 2

/**
 * PAGE view — a basic host's patterns under an ink section stamp with its
 * count (boards 07, 08). A phone shows the first two and a "Show all" link;
 * the link targets the list (`#patterns`) and `:target` opens the rest, so
 * the reveal ships no JavaScript and the static page stays static.
 */
export function PatternLinkRows({
  chassis,
  chassisName,
  patterns,
  sectionAs,
  host,
}: {
  chassis: ReferenceCardEntity
  chassisName: string
  patterns: RefObjectAnyPattern[]
  /** A real heading on the page (`sectionHeadingLevel`). */
  sectionAs?: ElementType
  host: PatternRowsHost
}) {
  if (patterns.length === 0) return null
  const count = patterns.length
  return (
    <SlabSection
      as={sectionAs}
      id="patterns"
      title="Patterns"
      page
      className="su-pattern-rows"
      bodyClassName="su-pattern-rows__body"
    >
      <ul className="su-pattern-rows__list">
        {patterns.map((pat) => (
          <PatternLinkRow
            key={pat.name}
            chassis={chassis}
            chassisName={chassisName}
            pattern={pat}
            host={host}
          />
        ))}
      </ul>
      {count > PATTERNS_ON_A_PHONE && (
        <a href="#patterns" className={cn('su-pattern-rows__more', capsLabel(), FOCUS_RING)}>
          Show all {count} patterns
        </a>
      )}
    </SlabSection>
  )
}
