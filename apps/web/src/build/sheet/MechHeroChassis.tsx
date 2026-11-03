/**
 * MechHeroChassis — the mech hero's right column (the hero is image | text |
 * ability): the chassis ability as a contentful Mini, its head and then its
 * text, Peeking its whole card (EDL E19 allows a contentful Mini anywhere).
 * No stat column: its Tech Level and Salvage Value ride the band, and the
 * rest are the gauges' maxima and the Slabs' and Hold's slot counts (C10).
 */

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { entityRef, nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import type { TagItem } from '../../components/index'
import { Button, Entity, relation, tokens } from '../../components/index'
import { CHASSIS_MODDER } from '../../lib/rules/chassisModder'
import { buildSheetCopy } from '../../messages/build-sheet'
import { ChassisModderPickerModal } from './ChassisModderPickerModal'
import type { MechSheetModel } from './mechSheet.model'

/** One track the column's width: an `auto` track would take the Mini's widest chips. */
const ABILITY = {
  display: 'grid',
  gap: tokens.space[8],
  gridTemplateColumns: 'minmax(0, 1fr)',
  listStyle: 'none',
  margin: 0,
  minWidth: 0,
  padding: 0,
} satisfies CSSProperties

const LINK = { kind: 'link' } as const

/** The added ability's relation chip: ABILITY | Chassis Modder, Peeking the ability. */
function modderRelation(): TagItem[] {
  const ability = SalvageUnionReference.Abilities.getBySlug(CHASSIS_MODDER)
  if (!ability) return []
  return [
    relation(CHASSIS_MODDER, buildSheetCopy('ability'), ability.name, { ref: entityRef(ability) }),
  ]
}

type MechHeroChassisProps = {
  abilities: MechSheetModel['chassisAbilities']
  /** The seated pilot's Chassis Modder pick; null when they are not one. */
  chassisModder?: MechSheetModel['chassisModder']
  /** Write the added Chassis Ability (null removes it); omit on read-only sheets. */
  onModChassis?: (slug: string | null) => void
}

export function MechHeroChassis({
  abilities,
  chassisModder = null,
  onModChassis,
}: MechHeroChassisProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const added = chassisModder?.current ?? null
  const canPick = chassisModder !== null && onModChassis !== undefined
  return (
    <div className="su-sheet-mech-hero-chassis">
      {abilities.length > 0 && (
        <ul aria-label={buildSheetCopy('chassisAbility')} style={ABILITY}>
          {abilities.map((ability) => (
            <li key={ability.id}>
              <Entity
                size="mini"
                context="play"
                entity={ability}
                mode={LINK}
                body={{}}
                relations={
                  added !== null && nameToSlug(ability.name) === added
                    ? modderRelation()
                    : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}
      {canPick && (
        <>
          <div>
            <Button variant="default" size="mini" onClick={() => setPickerOpen(true)}>
              {added
                ? buildSheetCopy('changeAddedChassisAbility')
                : buildSheetCopy('addChassisAbility')}
            </Button>
          </div>
          <ChassisModderPickerModal
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            options={chassisModder.options}
            current={added}
            onApply={onModChassis}
          />
        </>
      )}
    </div>
  )
}
