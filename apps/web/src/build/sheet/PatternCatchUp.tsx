/**
 * Bring up to date (r5 D2): a Mech whose loadout is no longer its pattern's
 * takes the pattern's Systems and Modules back, after a preview that names
 * what it gains and loses, with the sheet's Undo line after it. Damage, Heat
 * and cargo stay.
 */

import type { Mech } from 'game-domain/schemas/mech'
import { Button } from '../../components/index'
import { useConfirm } from '../../components/shared/useConfirm'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { PatternStamp } from './bandStamps.model'
import type { SheetPatch } from './sheetViewProps.model'
import { undoToast } from './undoToast.model'

export function PatternCatchUp({
  mech,
  stamp,
  patch,
}: {
  mech: Mech
  stamp: PatternStamp & { loadout: NonNullable<PatternStamp['loadout']> }
  patch: SheetPatch
}) {
  const { confirm, dialog } = useConfirm()
  const { loadout } = stamp
  const names = { name: mech.name, pattern: stamp.name }
  return (
    <>
      <Button
        size="compact"
        onClick={() =>
          confirm({
            title: buildSheetCopy('bringUpToDateTitle', names),
            body: [
              ...(stamp.differs ? [`${stamp.differs}.`] : []),
              buildSheetCopy('bringUpToDateKeeps'),
            ],
            confirmLabel: buildSheetCopy('bringUpToDate'),
            pendingLabel: buildSheetCopy('bringUpToDate'),
            tone: 'default',
            failure: buildSheetCopy('notBroughtUpToDate', names),
            onConfirm: () => {
              const before = { systems: mech.systems, modules: mech.modules }
              patch({ systems: [...loadout.systems], modules: [...loadout.modules] })
              undoToast(buildSheetCopy('broughtUpToDate', names), () => patch(before), mech.id)
            },
          })
        }
      >
        {buildSheetCopy('bringUpToDate')}
      </Button>
      {dialog}
    </>
  )
}
