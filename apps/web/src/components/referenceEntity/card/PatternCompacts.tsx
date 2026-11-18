// MOCK (Working Manual, A): a chassis page's patterns as the app lists
// patterns (`PatternList`, `CrewPatterns`): header-only Compacts in an entity
// grid (E2), each the link to its pattern's Page. Starting is a pattern's only
// stamp; the source is said once, as a line of small text over the patterns
// that share it (a citation is text, never a chip: E9). Not shipped code.
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

/** "Workshop Manual · p.101": the book's name less the game's, and the page. */
function citeOf(pattern: RefObjectAnyPattern): string {
  const book = 'source' in pattern && pattern.source ? String(pattern.source) : ''
  const page = 'page' in pattern && pattern.page != null ? ` · p.${pattern.page}` : ''
  return `${book.replace(/^Salvage Union /, '')}${page}`
}

function PatternCompact({
  chassis,
  pattern,
}: {
  chassis: ReferenceCardEntity
  pattern: RefObjectAnyPattern
}) {
  const href = usePatternHref(chassis, pattern)
  return (
    <Entity
      size="compact"
      entity={chassis as RefMetaEntity}
      pattern={pattern}
      instance={{ title: quotePatternName(pattern.name) }}
      omit={OMIT}
      labels={
        isLegalStartingPatternOf(pattern) ? (
          <Stat label="Starting" hoverText={LEGAL_STARTING_PATTERN_NOTE} size="mini" />
        ) : undefined
      }
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
  // The patterns in the book's order, each run of one printing under its line.
  const runs: { cite: string; patterns: RefObjectAnyPattern[] }[] = []
  for (const pattern of patterns) {
    const cite = citeOf(pattern)
    const last = runs.at(-1)
    if (last && last.cite === cite) last.patterns.push(pattern)
    else runs.push({ cite, patterns: [pattern] })
  }
  return (
    <div className="su-manual__pattern-runs">
      {runs.map((run) => (
        <div key={run.cite} className="su-manual__pattern-run">
          <ul className="su-manual__patterns" data-entity-grid="">
            {run.patterns.map((pattern) => (
              <li key={pattern.name}>
                <PatternCompact chassis={chassis} pattern={pattern} />
              </li>
            ))}
          </ul>
          {run.cite && <p className="su-manual__pattern-cite">{run.cite}</p>}
        </div>
      ))}
    </div>
  )
}
