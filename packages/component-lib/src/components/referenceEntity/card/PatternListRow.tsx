import type { ElementType } from 'react'
import type { SURefEntity, SURefObjectPattern } from 'salvageunion-reference'
import { normalizePatternName } from 'salvageunion-reference'
import { cn } from '../../../utils/cn'
import { FOCUS_RING } from '../../chrome/interaction'
import { Slab } from '../../chrome/Slab'
import { usePatternHref } from '../entityHrefContext'
import { wrapFlat } from './cardHelpers'
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

/** BASIC CHASSIS → the list of its patterns, as LISTING rows under a Patterns band. */
export function PatternList({
  chassis,
  chassisName,
  patterns,
  depth,
  hostDown,
  flat,
  sectionAs,
  NestedCard,
}: {
  chassis: ReferenceCardEntity
  chassisName: string
  patterns: SURefObjectPattern[]
  /** The depth the rows render at (the host's + 1). */
  depth: number
  hostDown: boolean
  flat: boolean
  sectionAs: ElementType | undefined
  NestedCard: NestedCard
}) {
  return (
    <div className={flat ? 'mb-1.5' : 'flex flex-col gap-1.5'}>
      <Slab variant="dashed" label="Patterns" as={sectionAs} />
      <div className={flat ? undefined : 'flex flex-col gap-1.5'}>
        {patterns.map((pat) =>
          wrapFlat(
            flat,
            pat.name,
            <PatternListRow
              key={pat.name}
              chassis={chassis}
              chassisName={chassisName}
              pattern={pat}
              depth={depth}
              hostDown={hostDown}
              NestedCard={NestedCard}
            />
          )
        )}
      </div>
    </div>
  )
}
