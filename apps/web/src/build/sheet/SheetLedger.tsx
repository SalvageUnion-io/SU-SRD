/**
 * MOCK (wave 2, phone sheets): SheetLedger, a sheet's list in the Ledger form
 * (`components/entity/Ledger.tsx`): one framed table in the list's band paint,
 * its title a cut-out tab with the count, a Mini-height line per entity whose
 * name Peeks its card, its values in fixed columns, and the books it is
 * printed in on the cite foot. A phone's Systems, Modules, Abilities,
 * Equipment and Bays all read this way; what a row's own state is (Damaged,
 * Uses 3) is its one stamp.
 */

import type { ReactNode } from 'react'
import type { EntityModel, RefMetaEntity } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'
import type { LedgerColumn } from '../../components/index'
import { CiteLine, Ledger } from '../../components/index'

type Column = LedgerColumn & { value: (model: EntityModel, line: SheetLedgerLine) => string }

export type SheetLedgerLine = {
  id: string
  /** The reference entity the row names; absent, a hand-written line. */
  entity?: RefMetaEntity | null
  /** A name over the entity's own (a hand-written line's, a bay's lead). */
  name?: string
  /** The row's one stamp: its state on this sheet. */
  stamp?: ReactNode
  /** Extra cells by column key, over what the entity gives. */
  cells?: Readonly<Record<string, string>>
}

const book = (label: string, title: string, key: string): Column => ({
  key,
  label,
  title,
  kind: 'figure',
  phone: true,
  value: (model) => String(model.bookStats.find((stat) => stat.key === key)?.value ?? ''),
})

/** An action fact in its short spelling (`M`, `5 SP`). */
const fact = (label: string, title: string, key: string): Column => ({
  key,
  label,
  title,
  kind: 'figure',
  phone: true,
  value: (model) => {
    const found = model.facts.find((entry) => entry.key === key)
    return found ? String(found.shortValue ?? found.value) : ''
  },
})

const COST: Column = {
  key: 'cost',
  label: 'Cost',
  title: 'Activation cost',
  kind: 'figure',
  phone: true,
  value: (model) => model.cost ?? '',
}

const ACTION: Column = {
  key: 'action',
  label: 'Action',
  kind: 'text',
  phone: true,
  value: (model) => model.actionType ?? '',
}

/** A cell the caller writes (`cells[key]`). */
const own = (label: string, key: string, kind: Column['kind'] = 'figure'): Column => ({
  key,
  label,
  kind,
  phone: true,
  value: (_model, line) => line.cells?.[key] ?? '',
})

const COLUMNS = {
  loadout: [
    book('Slots', 'Slots Required', 'book-Slots Required'),
    COST,
    fact('RNG', 'Range', 'range'),
    fact('DMG', 'Damage', 'damage'),
  ],
  equipment: [
    book('TL', 'Tech Level', 'tech-level'),
    fact('RNG', 'Range', 'range'),
    fact('DMG', 'Damage', 'damage'),
    own('Uses', 'uses'),
  ],
  abilities: [
    {
      key: 'level',
      label: 'LVL',
      title: 'Level',
      kind: 'figure',
      phone: true,
      value: (model) => String(model.tier ?? ''),
    },
    COST,
    ACTION,
  ],
  bays: [own('Crew lead', 'lead', 'text'), own('HP', 'hp')],
} as const satisfies Record<string, readonly Column[]>

const EMPTY_MODEL = { bookStats: [], facts: [] } as unknown as EntityModel

export function SheetLedger({
  kind,
  title,
  count,
  tone,
  lines,
}: {
  kind: keyof typeof COLUMNS
  title: string
  count?: ReactNode
  /** The band's tone on the colour map; absent, the first entity's own. */
  tone?: string
  lines: readonly SheetLedgerLine[]
}) {
  const columns: readonly Column[] = COLUMNS[kind]
  const built = lines.map((line) => {
    const model = line.entity ? toEntityModel(line.entity) : undefined
    return { line, model }
  })
  const first = built.find((row) => row.model)?.model
  const books = [
    ...new Set(
      lines
        .map((line) =>
          line.entity && 'source' in line.entity && line.entity.source
            ? String(line.entity.source).replace(/^Salvage Union /, '')
            : ''
        )
        .filter(Boolean)
    ),
  ]
  if (built.length === 0) return null
  return (
    <Ledger
      label={title}
      tone={tone ?? first?.tone ?? 'ink'}
      nameLabel={title}
      count={count}
      columns={columns}
      rows={built.map(({ line, model }) => ({
        id: line.id,
        name: line.name ?? model?.title ?? line.id,
        entityRef: model?.ref,
        stamp: line.stamp,
        cells: columns.map((column) => column.value(model ?? EMPTY_MODEL, line)),
      }))}
      foot={books.length > 0 ? <CiteLine text={books.join(' // ')} /> : undefined}
    />
  )
}
