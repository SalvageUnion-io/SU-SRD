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
  nameToSlug,
  SalvageUnionReference,
  toEntityModel,
} from 'salvageunion-reference'
import { computeMechCapacity } from 'salvageunion-reference/rules'
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

/**
 * A mech pattern's line: its loadout, which is what tells a chassis's
 * patterns apart; the slot counts, the same for every book pattern of a
 * chassis, are not drawn (r8 E11). On a phone each row opens in place to its
 * loadout (`LoadoutFold`, r6 E5): comparing needs no page loads.
 */
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

/** The pattern's build, as the capacity rules read it. */
function buildOf(chassisName: string, pattern: RefObjectAnyPattern) {
  const copies = (parts: readonly { name: string; count?: number | undefined }[] = []) =>
    parts.flatMap((part) => new Array<string>(part.count ?? 1).fill(nameToSlug(part.name)))
  const mech = isBioTitanPattern(pattern) ? { systems: [], modules: [] } : pattern
  return {
    chassisRef: nameToSlug(chassisName),
    systems: copies(mech.systems),
    modules: copies(mech.modules),
  }
}

const capacityOf = (build: ReturnType<typeof buildOf>) =>
  computeMechCapacity({
    chassisRef: build.chassisRef,
    systems: build.systems.map((ref) => ({ ref })),
    modules: build.modules.map((ref) => ({ ref })),
  })

/** Whether the book prints this pattern over its chassis's slots (`AS_PRINTED_OVERFLOW`). */
function printedOver(chassisName: string, pattern: RefObjectAnyPattern): boolean {
  if (isBioTitanPattern(pattern)) return false
  const loaded = (['chassis', 'systems', 'modules'] as const).every((schema) =>
    SalvageUnionReference.isLoaded(schema)
  )
  return loaded && capacityOf(buildOf(chassisName, pattern)).asPrinted !== undefined
}

/**
 * On a phone, where the Loadout column gives way, a row's loadout opens in
 * place under its name (r6 E5): a native disclosure, no script on the page.
 * Wider, the column says it and the fold is not drawn (`.su-pattern-fold`).
 */
function LoadoutFold({ changes }: { changes: ReactNode }) {
  if (changes === '') return undefined
  return (
    <details className="su-pattern-fold">
      <summary>{referenceEntityCopy('loadout')}</summary>
      <span>{changes}</span>
    </details>
  )
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
  const titans = patterns.every(isBioTitanPattern)
  return (
    <Ledger
      label={referenceEntityCopy('patternsOf', { name: model.title })}
      paint={paintFor(model.tone, { texture: surface.texture })}
      nameLabel={referenceEntityCopy('patterns')}
      count={patterns.length}
      columns={titans ? ACTIONS : LOADOUT}
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
        // A total the book prints over its limit is the book's own: the note
        // sits on the row it describes (r4 E16), since the figure wears no
        // mark (R71) and a note at the list's foot belonged to no row. A
        // phone's fold to the loadout rides there too (r6 E5).
        ...(titans && !printedOver(model.title, pattern)
          ? {}
          : {
              under: (
                <>
                  {printedOver(model.title, pattern) && (
                    <span>{`${referenceEntityCopy('overItsLimit')} ${referenceEntityCopy('asPrintedInTheBook')}`}</span>
                  )}
                  {!titans && <LoadoutFold changes={changesOf(pattern)} />}
                </>
              ),
            }),
      }))}
    />
  )
}
