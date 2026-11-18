// MOCK (Working Manual, A): a chassis page's patterns as one Ledger: a line
// per pattern, its name the link to its Page, Starting its only stamp, its
// loadout one quiet line, and the patterns' sources once, in the foot (a
// citation is text, never a chip: E9). Not shipped code.
import type { RefMetaEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import { entityRef, isBioTitanPattern, toEntityModel } from 'salvageunion-reference'
import { CiteLine } from '../../atoms/CiteLine'
import { Stat } from '../../atoms/Stat'
import { useEntitySurface } from '../../entity/entitySurfaceContext'
import type { LedgerColumn } from '../../entity/Ledger'
import { Ledger } from '../../entity/Ledger'
import { paintFor } from '../../entity/parts/paint'
import { quotePatternName } from '../pattern/quotePatternName'
import { isLegalStartingPatternOf, LEGAL_STARTING_PATTERN_NOTE } from './legalStartingPattern'
import type { ReferenceCardEntity } from './referenceEntityCardTypes'

const COLUMNS: readonly LedgerColumn[] = [{ key: 'loadout', label: 'Loadout', kind: 'quiet' }]

type Named = { name: string; quantity?: number }

/** A loadout's names as running text: "Escape Hatch, Rigging Arm ×2". */
function namesOf(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  return (list as Named[]).map((entry) =>
    entry.quantity && entry.quantity > 1 ? `${entry.name} ×${entry.quantity}` : entry.name
  )
}

/** "Workshop Manual · p.101": the book's name less the game's, and the page. */
function citeOf(pattern: RefObjectAnyPattern): string {
  const book = 'source' in pattern && pattern.source ? String(pattern.source) : ''
  const page = 'page' in pattern && pattern.page != null ? ` · p.${pattern.page}` : ''
  return `${book.replace(/^Salvage Union /, '')}${page}`
}

export function PatternLedger({
  chassis,
  patterns,
}: {
  chassis: ReferenceCardEntity
  patterns: RefObjectAnyPattern[]
}) {
  const surface = useEntitySurface()
  const model = toEntityModel(chassis as RefMetaEntity)
  const host = entityRef(chassis as RefMetaEntity)
  const cites = [...new Set(patterns.map(citeOf).filter(Boolean))]
  return (
    <Ledger
      label={`${model.title} patterns`}
      paint={paintFor(model.tone, { texture: surface.texture })}
      nameLabel="Pattern"
      columns={COLUMNS}
      rows={patterns.map((pattern) => ({
        id: pattern.name,
        name: quotePatternName(pattern.name),
        entityRef: {
          ...host,
          schemaName: isBioTitanPattern(pattern) ? 'bio-titans' : 'chassis',
          pattern: pattern.name,
        },
        stamp: isLegalStartingPatternOf(pattern) ? (
          <Stat label="Starting" hoverText={LEGAL_STARTING_PATTERN_NOTE} size="mini" />
        ) : undefined,
        cells: [
          [
            ...namesOf('systems' in pattern ? pattern.systems : undefined),
            ...namesOf('modules' in pattern ? pattern.modules : undefined),
          ].join(', '),
        ],
      }))}
      foot={<CiteLine text={cites.join(' // ')} />}
    />
  )
}
