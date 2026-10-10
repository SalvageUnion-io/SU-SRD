import type { SURefEntity, SURefObjectPattern } from 'salvageunion-reference'
import { normalizePatternName } from 'salvageunion-reference'
import { space } from '../../../design/tokens'
import { cn } from '../../../utils/cn'
import { FOCUS_RING } from '../../chrome/interaction'
import { usePatternHref } from '../entityHrefContext'
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
