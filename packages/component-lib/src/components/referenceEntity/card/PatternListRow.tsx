import { ChevronRight } from 'lucide-react'
import type { ElementType } from 'react'
import type { SURefEntity, SURefObjectPattern } from 'salvageunion-reference'
import { normalizePatternName } from 'salvageunion-reference'
import { space } from '../../../design/tokens'
import { cn } from '../../../utils/cn'
import { FOCUS_RING } from '../../chrome/interaction'
import { Slab } from '../../chrome/Slab'
import { usePatternHref } from '../entityHrefContext'
import { firstParagraphText } from './firstParagraphText'
import type { NestedCard, ReferenceCardEntity } from './referenceEntityCardTypes'

/**
 * `PatternListRow` — one row of a chassis card's Patterns list, linking to the
 * pattern's own page.
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
 */
export function PatternListRow({
  chassis,
  chassisName,
  pattern,
  depth,
  hostDown,
  NestedCard,
}: {
  chassis: ReferenceCardEntity
  chassisName: string
  pattern: SURefObjectPattern
  depth: number
  hostDown?: boolean
  NestedCard: NestedCard
}) {
  const href = usePatternHref(chassis as SURefEntity, pattern)
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
  if (!href) return card
  return (
    <a
      href={href}
      aria-label={`${normalizePatternName(pattern.name)} — ${chassisName} pattern`}
      className={cn('block rounded-card', FOCUS_RING)}
    >
      {card}
    </a>
  )
}

/** BASIC CHASSIS → the list of its patterns, as LISTING rows. The card puts
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
  patterns: SURefObjectPattern[]
  /** The depth the rows render at (the host's + 1). */
  depth: number
  hostDown: boolean
  NestedCard: NestedCard
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[6] }}>
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
 * PAGE view — one pattern as a full-width link row (boards 07, 08): the
 * pattern's quoted name, its first paragraph and an arrow, with no underline.
 * The row is the link, so the whole width opens the pattern's page.
 */
function PatternLinkRow({
  chassis,
  chassisName,
  pattern,
}: {
  chassis: ReferenceCardEntity
  chassisName: string
  pattern: SURefObjectPattern
}) {
  const href = usePatternHref(chassis as SURefEntity, pattern)
  const name = normalizePatternName(pattern.name)
  const description = firstParagraphText(pattern.content)
  const body = (
    <>
      <span className="su-pattern-rows__name">“{name}”</span>
      {description && <span className="su-pattern-rows__desc">{description}</span>}
      {href && (
        <ChevronRight
          size={18}
          strokeWidth={2.5}
          aria-hidden="true"
          className="su-pattern-rows__arrow"
        />
      )}
    </>
  )
  return (
    <li className="su-pattern-rows__item">
      {href ? (
        <a
          href={href}
          aria-label={`${name} — ${chassisName} pattern`}
          className={cn('su-pattern-rows__row', FOCUS_RING)}
        >
          {body}
        </a>
      ) : (
        <div className="su-pattern-rows__row">{body}</div>
      )}
    </li>
  )
}

/** How many patterns a phone shows before "Show all N patterns". */
const PATTERNS_ON_A_PHONE = 2

/**
 * PAGE view — a basic chassis's patterns under an ink section stamp with its
 * count (boards 07, 08). A phone shows the first two and a "Show all" link;
 * the link targets the list (`#patterns`) and `:target` opens the rest, so
 * the reveal ships no JavaScript and the static page stays static.
 */
export function PatternLinkRows({
  chassis,
  chassisName,
  patterns,
  sectionAs,
}: {
  chassis: ReferenceCardEntity
  chassisName: string
  patterns: SURefObjectPattern[]
  /** A real heading on the page (`sectionHeadingLevel`). */
  sectionAs?: ElementType
}) {
  if (patterns.length === 0) return null
  const count = patterns.length
  return (
    <section id="patterns" className="su-pattern-rows">
      <Slab
        as={sectionAs}
        variant="solid"
        label="Patterns"
        count={`${count} ${count === 1 ? 'pattern' : 'patterns'}`}
      />
      <div className="su-pattern-rows__frame">
        <ul className="su-pattern-rows__list">
          {patterns.map((pat) => (
            <PatternLinkRow
              key={pat.name}
              chassis={chassis}
              chassisName={chassisName}
              pattern={pat}
            />
          ))}
        </ul>
        {count > PATTERNS_ON_A_PHONE && (
          <a href="#patterns" className={cn('su-pattern-rows__more', FOCUS_RING)}>
            Show all {count} patterns
          </a>
        )}
      </div>
    </section>
  )
}
