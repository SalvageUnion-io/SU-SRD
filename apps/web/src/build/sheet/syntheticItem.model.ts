/**
 * syntheticItem.model — the Mini model of a carried thing the reference does
 * not hold (ruleset §6.6: a carried thing, entity or not, is a Mini in
 * `SheetItemLine`): an unknown slug, a pilot's generic inventory entry, a cargo
 * lot. Its name, its facts as label-first chips in the stat order (so they
 * take the list's R2 lanes), its note as the stamp before the name; ink, as
 * the sheet's unknown items always were, and linked nowhere (`synthetic`).
 */

import type { EntitySchemaName } from 'salvageunion-reference'
import type { EntityFormModel } from '../../components/index'
import { syntheticModel } from '../../lib/units/syntheticModel'

/** One label-first fact (`SLOTS | 3`): `TL` is the rank, `Slots` and `Units` what it takes. */
type SyntheticFact = { label: 'TL' | 'Slots' | 'Units'; value: number | string }

export type SyntheticItem = {
  name: string
  /** Its line's identity, unique in its list (a lot's or an entry's id; an unknown slug). */
  id: string
  /** The catalog it stands in: its kind for screen readers. */
  schemaName: EntitySchemaName
  /** What screen readers hear after the name ("Unknown", "Item", "Cargo"). */
  kind: string
  facts?: readonly SyntheticFact[]
  /** The stamp before the name: "Unknown", an entry's own note. */
  note?: string
}

/** A fact's model key: the Tech Level is the rank (`tech-level`), as every model's is. */
const KEY: Record<SyntheticFact['label'], string> = {
  TL: 'tech-level',
  Slots: 'slots',
  Units: 'units',
}

export function syntheticItemModel(item: SyntheticItem): EntityFormModel {
  return syntheticModel({
    schemaName: item.schemaName,
    id: `synthetic/${item.schemaName}/${item.id}`,
    slug: item.id,
    name: item.name,
    kind: { label: item.kind, domain: 'gear', note: item.note },
    tone: 'ink',
    facts: (item.facts ?? []).map((fact) => ({
      key: KEY[fact.label],
      label: fact.label,
      short: fact.label,
      value: String(fact.value),
      group: fact.label === 'TL' ? 'provenance' : 'capacity',
    })),
  })
}
