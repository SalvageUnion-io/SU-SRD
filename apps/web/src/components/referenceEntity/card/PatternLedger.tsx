// A host's patterns on its Page as one Ledger (ledger.md L1): a line a
// pattern, its name the link to its Page, Starting its only stamp, what it
// changes said whole (a mech's loadout, each drone by the name the pattern
// gives it; the actions a Bio-Titan's pattern adds: rules text is never cut,
// only a name may end in "…"), each part a Mention of its entry (L4), whose
// Page lists the pattern back (EDL E26). It draws no foot (L6): each pattern's Page
// cites it. Its title tab names the section and carries the count, so no Slab
// heads it.
import type { ReactNode } from 'react'
import { Fragment } from 'react'
import type { RefMetaEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import {
  entityRef,
  isBioTitanPattern,
  SalvageUnionReference,
  toEntityModel,
} from 'salvageunion-reference'
import { referenceEntityCopy } from '../../../messages/components-reference-entity'
import { Stat } from '../../atoms/Stat'
import { paintFor } from '../../entity'
import { useEntitySurface } from '../../entity/entitySurfaceContext'
import { Mention } from '../../entity/forms/Mention'
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

type Part = { name: string; count?: number; schema: 'systems' | 'modules' | 'drones'; ref?: string }

/** A part as the line names it, a multiple counted ("Rigging Arm ×2"), its entry a Mention. */
function partOf({ name, count, schema, ref }: Part): ReactNode {
  const label = count && count > 1 ? `${name} ×${count}` : name
  const entry = SalvageUnionReference.isLoaded(schema)
    ? SalvageUnionReference.getByNameIn(schema, ref ?? name)
    : undefined
  return entry ? <Mention entityRef={entityRef(entry as RefMetaEntity)}>{label}</Mention> : label
}

/** What a pattern changes on its host, as one line: "Escape Hatch, Rigging Arm ×2". */
function changesOf(pattern: RefObjectAnyPattern): ReactNode {
  if (isBioTitanPattern(pattern)) return (pattern.actions ?? []).join(', ')
  const parts: Part[] = [
    ...(pattern.systems ?? []).map((part) => ({ ...part, schema: 'systems' as const })),
    ...(pattern.modules ?? []).map((part) => ({ ...part, schema: 'modules' as const })),
    ...(pattern.drones ?? []).map((drone) => ({
      name: drone.name,
      schema: 'drones' as const,
      ...(drone.ref ? { ref: drone.ref } : {}),
    })),
  ]
  if (parts.length === 0) return ''
  return parts.map((part, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: a fixed line; position is identity
    <Fragment key={index}>
      {index > 0 && ', '}
      {partOf(part)}
    </Fragment>
  ))
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
    />
  )
}
