/**
 * A mech's chassis controls in Edit, in its Chassis Ability group's head (C8):
 *
 *   - `ChangeChassis`: the chassis swap. Destructive (it clears the installed
 *     loadout), so its picker keeps its own confirm step.
 *   - `ChassisModderControl`: the seated pilot's Chassis Modder pick, the one
 *     Chassis Ability it adds (or changes, or removes).
 */

import type { Mech } from 'game-domain/schemas/mech'
import { useState } from 'react'
import { Button } from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'
import { MechChassisPickerModal } from '../mech/MechChassisPickerModal'
import { ChassisModderPickerModal } from './ChassisModderPickerModal'
import type { MechSheetModel } from './mechSheet.model'
import type { SheetPatch } from './sheetViewProps.model'

export function ChangeChassis({ mech, patch }: { mech: Mech; patch: SheetPatch }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="compact" onClick={() => setOpen(true)}>
        {buildSheetCopy('changeChassis')}
      </Button>
      <MechChassisPickerModal
        open={open}
        currentChassisRef={mech.chassisRef}
        onOpenChange={setOpen}
        onConfirm={(chassisRef) => patch({ chassisRef, systems: [], modules: [] })}
      />
    </>
  )
}

export function ChassisModderControl({
  chassisModder,
  onModChassis,
}: {
  chassisModder: NonNullable<MechSheetModel['chassisModder']>
  /** Write the added Chassis Ability (null removes it). */
  onModChassis: (slug: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const added = chassisModder.current
  return (
    <>
      <Button size="compact" onClick={() => setOpen(true)}>
        {added ? buildSheetCopy('changeAddedChassisAbility') : buildSheetCopy('addChassisAbility')}
      </Button>
      <ChassisModderPickerModal
        open={open}
        onOpenChange={setOpen}
        options={chassisModder.options}
        current={added}
        onApply={onModChassis}
      />
    </>
  )
}
