import type { ElementType } from 'react'
import { useMemo } from 'react'
import type { RefEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import { firstParagraphText, normalizePatternName, toEntityModel } from 'salvageunion-reference'
import { space } from '../../../design/tokens'
import { useEntitySurface } from '../../../entity/entitySurfaceContext'
import { Head } from '../../../entity/parts/Head'
import { Lead } from '../../../entity/parts/Lead'
import { paintFor } from '../../../entity/parts/paint'
import { cn } from '../../../utils/cn'
import { FOCUS_RING } from '../../atoms/interaction'
import { Slab } from '../../atoms/Slab'
import { usePatternHref } from '../entityHrefContext'
import { CardLabels } from './CardLabels'
import type { Down } from './cardChrome'
import { isLegalStartingPatternOf } from './legalStartingPattern'
import { PatternLoadout } from './PatternLoadout'
import { PatternUniques } from './PatternUniques'
import type { NestedCard, ReferenceCardEntity } from './referenceEntityCardTypes'
import { resolvePatternGroups } from './resolveNestedEntities'

/**
 * `PatternListRow` — one row of a host's (a chassis's or a Bio-Titan's)
 * Patterns list, linking to the pattern's own page, with what the pattern
 * changes beneath it (`PatternUniques`).
 *
 * A real `<a>`, not a click handler: a pattern page is a page like any other
 * entity's, so the row has to open in a new tab on middle-click, show its
 * destination on hover, and be followable by a crawler. The anchor carries the
 * interaction; the card inside it takes `cardClickable` for the hover-lift
 * affordance ONLY, which is why it doesn't also become a `role=button` nested
 * inside a link.
 *
 * With no `PatternHrefProvider` above it (any app whose patterns have no pages)
 * the row renders exactly as it always did — inert, not a link to nowhere.
 *
 * The uniques sit OUTSIDE the anchor: their names and cards are links and
 * controls of their own, which cannot nest inside another link.
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
  const href = usePatternHref(chassis as RefEntity, pattern)
  const card = (
    <NestedCard
      data={chassis}
      pattern={pattern}
      size="medium"
      extent="head"
      depth={depth}
      hostDown={hostDown}
      cardClickable={!!href}
    />
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[6] }}>
      {href ? (
        <a
          href={href}
          aria-label={`${normalizePatternName(pattern.name)} — ${chassisName} pattern`}
          className={FOCUS_RING}
          style={{ display: 'block' }}
        >
          {card}
        </a>
      ) : (
        card
      )}
      <PatternUniques
        pattern={pattern}
        depth={depth + 1}
        hostDown={hostDown}
        hostName={chassisName}
        NestedCard={NestedCard}
      />
    </div>
  )
}

/** BASIC HOST → the list of its patterns, as LISTING rows. The card puts
 * them in a "Patterns" tray, the same device as every other nested group. */
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
  /** The depth the rows render at (the host's + 1). */
  depth: number
  hostDown: Down
  NestedCard: NestedCard
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[14] }}>
      {patterns.map((pat) => (
        <PatternListRow
          key={pat.name}
          chassis={chassis}
          chassisName={chassisName}
          pattern={pat}
          depth={depth}
          hostDown={hostDown}
          NestedCard={NestedCard}
        />
      ))}
    </div>
  )
}

/**
 * PAGE view — one pattern as a CARD in the Row's language (entity display
 * language, Row): the host's tone in the head with the pattern's quoted name
 * as the link, then a paper body with the pattern's opening paragraph
 * clamped as a lead, and under it what the pattern changes: its loadout,
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
  const href = usePatternHref(chassis as RefEntity, pattern)
  const surface = useEntitySurface()
  const model = useMemo(
    () => toEntityModel(chassis as RefEntity, undefined, { pattern }),
    [chassis, pattern]
  )
  const name = normalizePatternName(pattern.name)
  const description = firstParagraphText(pattern.content)
  const loadout = useMemo(() => resolvePatternGroups(pattern), [pattern])
  const paint = paintFor(model.tone, { down: host.hostDown, texture: surface.texture })
  // The book's starting builds wear their stamp on the row, as on the card.
  const labels = isLegalStartingPatternOf(pattern) ? (
    <CardLabels seal={undefined} axisMarkers={[]} legalStartingPattern onInk={paint.ink} />
  ) : undefined
  // The name on the paper cut-out (Head's `notch`): the body below is paper.
  const head = <Head title={`“${name}”`} notch paint={paint} labels={labels} />
  return (
    <li className="su-pattern-rows__item">
      {href ? (
        <a
          href={href}
          aria-label={`${name} — ${chassisName} pattern`}
          className={cn('su-pattern-rows__head', FOCUS_RING)}
        >
          {head}
        </a>
      ) : (
        head
      )}
      <div className="su-pattern-rows__body">
        {/* Wrapped: the lead's 100% basis is for a Row's wrapping body, and in
            this column it would stretch the clamp's box past its three lines. */}
        {description && (
          <div>
            <Lead text={description} />
          </div>
        )}
        {loadout.length > 0 && (
          <PatternLoadout
            groups={loadout}
            sectionAs={undefined}
            hostDown={host.hostDown}
            owner={name}
          />
        )}
        <PatternUniques
          className="su-pattern-rows__unique"
          pattern={pattern}
          depth={1}
          hostDown={host.hostDown}
          hostName={chassisName}
          chassisName={host.chassisName}
          NestedCard={host.NestedCard}
          loadout={false}
        />
      </div>
    </li>
  )
}

/** What a page's pattern rows need to render each pattern's uniques. */
type PatternRowsHost = {
  NestedCard: NestedCard
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
    <section id="patterns" className="su-pattern-rows">
      <Slab as={sectionAs} variant="solid" label="Patterns" />
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
        <a href="#patterns" className={cn('su-pattern-rows__more', FOCUS_RING)}>
          Show all {count} patterns
        </a>
      )}
    </section>
  )
}
