/**
 * A mech's chassis controls in Edit:
 *
 *   - `ChangeChassis`: the chassis swap, the sheet header's one button (r6 E7).
 *     The picker names what will not fit; Choose keeps it, over the slots, or
 *     "Leave them off" drops it (`CHASSIS_SWAP_KEEPS_OVERFLOW`), and the toast
 *     that follows says which, its Undo putting the old chassis and loadout
 *     back. A mech still named for its chassis takes the new one's name (r5 C10).
 *   - `ChassisModderControl`: in the Chassis Ability group's head (C8), the
 *     seated pilot's Chassis Modder pick, the one
 *     Chassis Ability it adds (or changes, or removes).
 */

import type { Mech } from 'game-domain/schemas/mech'
import { lazy, Suspense, useState } from 'react'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { Button } from '../../components/index'
import { droppedNames, loadoutOnChassis, namedForChassis } from '../../lib/rules/chassisSwap'
import { useOpenedOnce } from '../../lib/useOpenedOnce'
import { mechCopy } from '../../messages/build-mech'
import { buildSheetCopy } from '../../messages/build-sheet'
import { usePatterns } from '../../replica/collections'
import { mechPatternStamp } from './bandStamps.model'
import type { MechSheetModel } from './mechSheet.model'
import type { SheetPatch } from './sheetViewProps.model'
import { undoToast } from './undoToast.model'

// Each picker is a chunk of its own, fetched when it first opens (`useOpenedOnce`).
const MechChassisPickerModal = lazy(() =>
  import('../mech/MechChassisPickerModal').then((m) => ({ default: m.MechChassisPickerModal }))
)
const ChassisModderPickerModal = lazy(() =>
  import('./ChassisModderPickerModal').then((m) => ({ default: m.ChassisModderPickerModal }))
)

export function ChangeChassis({ mech, patch }: { mech: Mech; patch: SheetPatch }) {
  const [open, setOpen] = useState(false)
  const mounted = useOpenedOnce(open)
  const saved = usePatterns((s) => s.mechPatterns)
  // The pattern the band names: a new chassis unlinks it, and the picker says so (r8 E3).
  const pattern = mechPatternStamp(mech, (id) => saved.find((each) => each.id === id)?.name)?.name
  return (
    <>
      <Button size="compact" onClick={() => setOpen(true)}>
        {/* A mech made blank has none to change yet. */}
        {mech.chassisRef === '' ? buildSheetCopy('chooseChassis') : buildSheetCopy('changeChassis')}
      </Button>
      {mounted && (
        <Suspense fallback={null}>
          <MechChassisPickerModal
            open={open}
            currentChassisRef={mech.chassisRef}
            onOpenChange={setOpen}
            loadout={mech}
            pattern={pattern}
            onConfirm={(chassisRef, keep = false) => {
              const before = {
                name: mech.name,
                chassisRef: mech.chassisRef,
                systems: mech.systems,
                modules: mech.modules,
              }
              const name = resolveChassisRef(chassisRef)?.name ?? chassisRef
              // A mech still named for its chassis is named for the new one (r5 C10).
              const renamed = namedForChassis(mech) ? { name } : {}
              const swap = loadoutOnChassis(chassisRef, mech)
              // Keep everything: the loadout stays whole, over the slots (r5 C10).
              const wrote = keep
                ? { chassisRef, ...renamed }
                : { chassisRef, systems: swap.systems, modules: swap.modules, ...renamed }
              patch(wrote)
              const left = keep ? [] : droppedNames(swap.dropped)
              undoToast(
                keep && swap.dropped.length > 0
                  ? mechCopy('chassisChangedKeptAll', { name })
                  : left.length === 0
                    ? mechCopy('chassisChanged', { name })
                    : mechCopy('chassisChangedLeftOff', { name, names: left.join(', ') }),
                () => patch(before),
                mech.id,
                { wrote }
              )
            }}
          />
        </Suspense>
      )}
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
  const mounted = useOpenedOnce(open)
  const added = chassisModder.current
  return (
    <>
      <Button size="compact" onClick={() => setOpen(true)}>
        {added ? buildSheetCopy('changeAddedChassisAbility') : buildSheetCopy('addChassisAbility')}
      </Button>
      {mounted && (
        <Suspense fallback={null}>
          <ChassisModderPickerModal
            open={open}
            onOpenChange={setOpen}
            options={chassisModder.options}
            current={added}
            onApply={onModChassis}
          />
        </Suspense>
      )}
    </>
  )
}
