/**
 * UnknownItemLine — the Live Sheet's one fallback for an item the reference
 * does not know (hard rule R11): a stored slug that resolves to nothing (an
 * ability, a piece of equipment, a system or module, a mounted weapon, a bay)
 * still shows, as a Token named by its slug and stamped "Unknown", on the
 * sheet's item line (`SheetItemLine`): its condition where it has one, and in
 * Edit the one remove control. Never a crash, never a hand-built chit.
 */

import type { ItemCondition } from 'game-domain/schemas/itemCondition'
import type { EntitySchemaName } from 'salvageunion-reference'
import type { EntityRowModel } from '../../components/index'
import { Entity } from '../../components/index'
import { SheetItemLine } from './SheetItemLine'

/** The Token's model: the slug as its name, ink, stamped "Unknown"; it links nowhere. */
function unknownItemModel(slug: string, schemaName: EntitySchemaName): EntityRowModel {
  return {
    ref: { schemaName, id: `unknown/${schemaName}/${slug}`, slug, name: slug, synthetic: true },
    title: slug,
    kind: { stamp: 'Unknown', type: 'Unknown', domain: 'gear', nature: 'have', note: 'Unknown' },
    tone: 'ink',
    facts: [],
    traits: [],
    art: { kind: 'none' },
  }
}

type UnknownItemLineProps = {
  slug: string
  /** The catalog it was looked up in: the Token's kind for screen readers. */
  schemaName: EntitySchemaName
  readOnly: boolean
  /** Its condition, where the item has one (equipment, a system, a module, a bay). */
  condition?: ItemCondition
  onConditionCycle?: () => void
  /** Remove it (Edit only); omitted where it cannot be removed here. */
  onRemove?: () => void
}

export function UnknownItemLine({
  slug,
  schemaName,
  readOnly,
  condition,
  onConditionCycle,
  onRemove,
}: UnknownItemLineProps) {
  return (
    <SheetItemLine
      token={
        <Entity
          form="token"
          context="loadout"
          model={unknownItemModel(slug, schemaName)}
          mode={{ kind: 'read' }}
        />
      }
      name={slug}
      condition={condition}
      readOnly={readOnly}
      onConditionCycle={onConditionCycle}
      onRemove={readOnly ? undefined : onRemove}
    />
  )
}
