// MOCK (Working Manual, A): a chassis page's patterns as the app lists
// patterns (`PatternList`, `CrewPatterns`): header-only Compacts in an entity
// grid (E2), each the link to its pattern's Page, its Starting stamp and its
// source the chips. Not shipped code.
import type { RefMetaEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import { normalizePatternName } from 'salvageunion-reference'
import { Stat } from '../../atoms/Stat'
import { Entity } from '../../entity/Entity'
import { quotePatternName } from '../pattern/quotePatternName'
import { isLegalStartingPatternOf, LEGAL_STARTING_PATTERN_NOTE } from './legalStartingPattern'
import { usePatternHref } from './PatternListRow'
import type { ReferenceCardEntity } from './referenceEntityCardTypes'

/**
 * What every pattern of one chassis shares with it, so its Compact leaves
 * out: the kind, the art and the chassis's own stats.
 */
const OMIT = [
  'kind',
  'art',
  'tech-level',
  'ref-stat-salvageValue',
  'ref-stat-structurePoints',
  'ref-stat-energyPoints',
  'ref-stat-systemSlots',
  'ref-stat-moduleSlots',
  'ref-stat-heatCapacity',
  'ref-stat-cargoCapacity',
] as const

const READ = { kind: 'read' } as const

function PatternCompact({
  chassis,
  pattern,
}: {
  chassis: ReferenceCardEntity
  pattern: RefObjectAnyPattern
}) {
  const href = usePatternHref(chassis, pattern)
  const book = 'source' in pattern && pattern.source ? String(pattern.source) : undefined
  const page = 'page' in pattern && pattern.page != null ? `p.${pattern.page}` : undefined
  const labels = [
    isLegalStartingPatternOf(pattern) && (
      <Stat key="starting" label="Starting" hoverText={LEGAL_STARTING_PATTERN_NOTE} size="mini" />
    ),
    book && (
      <Stat
        key="source"
        label={book.replace(/^Salvage Union /, '')}
        // A phone reads the book's initials ("WM"), so Starting and the source both fit.
        shortLabel={book
          .replace(/^Salvage Union /, '')
          .split(/\s+/)
          .map((word) => word.charAt(0))
          .join('')}
        value={page}
        size="mini"
      />
    ),
  ]
  return (
    <Entity
      size="compact"
      entity={chassis as RefMetaEntity}
      pattern={pattern}
      instance={{ title: quotePatternName(pattern.name) }}
      omit={OMIT}
      labels={labels}
      mode={
        href
          ? {
              kind: 'link',
              href,
              attrs: { 'aria-label': `${normalizePatternName(pattern.name)} pattern` },
            }
          : READ
      }
    />
  )
}

export function PatternCompacts({
  chassis,
  patterns,
}: {
  chassis: ReferenceCardEntity
  patterns: RefObjectAnyPattern[]
}) {
  return (
    <ul className="su-manual__patterns" data-entity-grid="">
      {patterns.map((pattern) => (
        <li key={pattern.name}>
          <PatternCompact chassis={chassis} pattern={pattern} />
        </li>
      ))}
    </ul>
  )
}
