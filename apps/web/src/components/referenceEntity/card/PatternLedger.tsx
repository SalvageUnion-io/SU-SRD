// A host's patterns on its Page as one Ledger (ledger.md L1): a line a
// pattern, its name the link to its Page, Starting its only stamp, what it
// changes said whole (a mech's loadout, each drone by the name the pattern
// gives it; the actions a Bio-Titan's pattern adds: rules text is never cut,
// only a name may end in "…"), and the patterns' sources once, on the foot's
// cut-out (a citation is text, never a chip: E9). Its title tab names the
// section and carries the count, so no Slab heads it.
import type { RefMetaEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import { entityRef, isBioTitanPattern, toEntityModel } from 'salvageunion-reference'
import { referenceEntityCopy } from '../../../messages/components-reference-entity'
import { CiteLine } from '../../atoms/CiteLine'
import { Stat } from '../../atoms/Stat'
import { paintFor } from '../../entity'
import { useEntitySurface } from '../../entity/entitySurfaceContext'
import type { LedgerColumn } from '../../entity/Ledger'
import { Ledger } from '../../entity/Ledger'
import { quotePatternName } from '../pattern/quotePatternName'
import { isLegalStartingPatternOf, LEGAL_STARTING_PATTERN_NOTE } from './legalStartingPattern'
import type { ReferenceCardEntity } from './referenceEntityCardTypes'

const LOADOUT: readonly LedgerColumn[] = [
  { key: 'loadout', label: referenceEntityCopy('loadout'), kind: 'line' },
]
const ACTIONS: readonly LedgerColumn[] = [
  { key: 'actions', label: referenceEntityCopy('actions'), kind: 'line' },
]

/** Installed parts as running text, a multiple counted: "Escape Hatch, Rigging Arm ×2". */
function partsOf(list: readonly { name: string; count?: number }[] | undefined): string[] {
  return (list ?? []).map((part) =>
    part.count && part.count > 1 ? `${part.name} ×${part.count}` : part.name
  )
}

/** What a pattern changes on its host, as one line. */
function changesOf(pattern: RefObjectAnyPattern): string {
  if (isBioTitanPattern(pattern)) return (pattern.actions ?? []).join(', ')
  return [
    ...partsOf(pattern.systems),
    ...partsOf(pattern.modules),
    ...(pattern.drones ?? []).map((drone) => drone.name),
  ].join(', ')
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
      label={referenceEntityCopy('patternsOf', { name: model.title })}
      paint={paintFor(model.tone, { texture: surface.texture })}
      nameLabel={referenceEntityCopy('patterns')}
      count={patterns.length}
      columns={patterns.every(isBioTitanPattern) ? ACTIONS : LOADOUT}
      rows={patterns.map((pattern) => ({
        id: pattern.name,
        name: quotePatternName(pattern.name),
        entityRef: {
          ...host,
          schemaName: isBioTitanPattern(pattern) ? 'bio-titans' : 'chassis',
          pattern: pattern.name,
        },
        stamp: isLegalStartingPatternOf(pattern) ? (
          <Stat
            label={referenceEntityCopy('starting')}
            hoverText={LEGAL_STARTING_PATTERN_NOTE}
            size="mini"
          />
        ) : undefined,
        cells: [changesOf(pattern)],
      }))}
      foot={<CiteLine text={cites.join(' // ')} />}
    />
  )
}
