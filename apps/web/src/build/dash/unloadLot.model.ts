/**
 * unloadLot — the mech's Hold unloading a lot, with its Undo (r4 E10).
 */

import type { CargoLot } from 'game-domain/schemas/cargoLot'
import { perUnitCost } from '../../lib/cargo/cargoTransfer'
import { reportCargo } from '../../lib/cargo/reportCargo'
import type { UseCargoResult } from '../../lib/cargo/useCargo'
import { buildSheetCopy } from '../../messages/build-sheet'
import { undoToast } from '../sheet/undoToast.model'

/**
 * Unload a lot, or `qty` of a stack, and leave the way back (r4 E10): the
 * same count rejoins the lot, or the lot returns whole.
 */
export function unloadLot(
  cargo: UseCargoResult,
  lot: CargoLot,
  qty: number | undefined,
  mechId: string
) {
  const part = qty !== undefined && lot.qty !== undefined && qty < lot.qty
  const done = cargo.removeMechLot(lot.id, part ? qty : undefined)
  reportCargo(done)
  void done.then((result) => {
    if (!result.ok) return
    const back: CargoLot = part ? { ...lot, qty, units: qty * perUnitCost(lot) } : lot
    undoToast(
      part
        ? buildSheetCopy('unloadedCount', { count: qty, name: lot.name })
        : buildSheetCopy('unloadedName', { name: lot.name }),
      () => reportCargo(cargo.addMechLot(back)),
      mechId,
      { stack: true }
    )
  })
}
