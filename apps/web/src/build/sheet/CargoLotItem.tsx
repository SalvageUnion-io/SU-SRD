/**
 * CargoLotItem — one lot in a hold, on either side of the
 * mech ⇄ crawler boundary, with the cap-checked move affordance both sides
 * share.
 */

import type { CargoLot } from 'game-domain/schemas/cargoLot'
import { useState } from 'react'
import { Button } from '../../components/index'
import { loadableQty } from '../../lib/cargo/cargoTransfer'
import { reportCargo as report } from '../../lib/cargo/reportCargo'
import type { UseCargoResult } from '../../lib/cargo/useCargo'
import { buildSheetCopy } from '../../messages/build-sheet'
import { CargoLotLine } from './CargoLotLine'
import { UnloadDialog } from './UnloadDialog'
import { undoToast } from './undoToast.model'

export type StorageManifestSide = 'mech' | 'crawler'

/**
 * The cap-checked move affordance of both sides — the single source of the
 * button label + disabled reason for the mech Hold's and the crawler Hold's
 * lots.
 *
 *   - The boundary gate is per-`side`: the mech STOWS a lot to the crawler's
 *     Storage Bay ('Stow', disabled when no crawler is linked), the crawler
 *     LOADS a lot onto the mech ('Load', disabled when no mech is docked).
 *   - Only the crawler side is cap-checked (the mech Hold's Storage Bay target
 *     is unlimited), so the fit-math runs solely for `side === 'crawler'`:
 *     bulk lots partial-fill up to the free slots (dynamic 'Load N' label),
 *     unit lots move whole-or-not.
 */
function moveAffordance(
  lot: CargoLot,
  side: StorageManifestSide,
  cargo: UseCargoResult,
  linked: boolean
): { label: string; disabledReason: string | null } {
  let label = side === 'mech' ? 'Stow' : 'Load'
  // Both moves write the crawler, so a crawler the viewer may not write closes
  // them whichever sheet they are on.
  let disabledReason: string | null = !linked
    ? side === 'mech'
      ? buildSheetCopy('noCrawlerNothingToStow')
      : buildSheetCopy('noMechNothingToLoad')
    : cargo.crawlerLocked

  if (side === 'crawler' && disabledReason === null) {
    // The reducer's own fit math, so the button and the load can't disagree.
    const fitsQty = loadableQty(lot, cargo.usage.free)
    if (fitsQty <= 0) {
      disabledReason = buildSheetCopy('doesNotFit', { name: lot.name, free: cargo.usage.free })
    }
    const partial = lot.kind === 'bulk' && lot.qty !== undefined && fitsQty < lot.qty
    label = partial && fitsQty > 0 ? `Load ${fitsQty}` : 'Load'
  }

  return { label, disabledReason }
}

type CargoLotItemProps = {
  lot: CargoLot
  side: StorageManifestSide
  cargo: UseCargoResult
  /** Whether the receiving side of the boundary is linked. */
  linked: boolean
  readOnly: boolean
  /**
   * Drop the lot out of its container entirely — rendered as 'Unload' on the
   * mech chit, 'Unstow' on the Storage Bay tile. Omitted → no remove button.
   * A mech's stack asks how many first (r4 E10), and hands the count on.
   */
  onRemove?: (qty?: number) => void
}

/**
 * CargoLotItem — one lot, on either side of the mech ⇄ crawler boundary: the
 * one lot line (`CargoLotLine`) with this side's buttons in its chip group.
 *   - `side === 'mech'`    → 'Stow' to the crawler's Storage Bay, and 'Unload'.
 *   - `side === 'crawler'` → the cap-checked 'Load' onto the docked mech, and
 *     'Unstow'.
 * The label + disabled reason come from the shared `moveAffordance`.
 */
export function CargoLotItem({ lot, side, cargo, linked, readOnly, onRemove }: CargoLotItemProps) {
  return (
    <CargoLotLine
      lot={lot}
      actions={
        readOnly ? undefined : (
          <CargoLotControls
            lot={lot}
            side={side}
            cargo={cargo}
            linked={linked}
            {...(onRemove ? { onRemove } : {})}
          />
        )
      }
    />
  )
}

/**
 * A lot's Edit controls, wherever its line is drawn (its `CargoLotLine`, a
 * Ledger's row): this side's cap-checked move, and its remove.
 */
export function CargoLotControls({
  lot,
  side,
  cargo,
  linked,
  onRemove,
}: Omit<CargoLotItemProps, 'readOnly'>) {
  const { label, disabledReason } = moveAffordance(lot, side, cargo, linked)

  function handleMove() {
    if (side === 'crawler') {
      report(cargo.load(lot.id))
      return
    }
    // A stow lands at once and says so, with the way back (r3 F1): Scrap
    // stowed twice by mistake was counted twice, and nothing had said it moved.
    const stowed = cargo.stow(lot.id)
    report(stowed)
    void stowed.then((result) => {
      if (!result.ok || cargo.carrierId === null) return
      undoToast(
        buildSheetCopy('stowedName', { name: lot.name }),
        () => report(cargo.takeBack(lot)),
        cargo.carrierId
      )
    })
  }

  // Unload on a stack asks how many (r4 E10): the whole lot is one choice.
  const [asking, setAsking] = useState(false)
  const stack = side === 'mech' && lot.kind === 'bulk' && (lot.qty ?? 0) > 1

  return (
    <>
      <Button
        variant="pencil"
        size="mini"
        disabled={disabledReason !== null}
        title={disabledReason ?? undefined}
        aria-label={buildSheetCopy(side === 'mech' ? 'stowName' : 'loadName', { name: lot.name })}
        onClick={handleMove}
      >
        {label}
      </Button>
      {onRemove && (
        <Button
          variant="pencil"
          size="mini"
          aria-label={buildSheetCopy(side === 'mech' ? 'unloadName' : 'unstowName', {
            name: lot.name,
          })}
          title={
            side === 'mech'
              ? buildSheetCopy('unloadFromTheMechHold', { name: lot.name })
              : buildSheetCopy('unstowFromTheStorageBay', { name: lot.name })
          }
          onClick={() => (stack ? setAsking(true) : onRemove())}
        >
          {side === 'mech' ? buildSheetCopy('unload') : buildSheetCopy('unstow')}
        </Button>
      )}
      {onRemove && stack && asking && (
        <UnloadDialog
          lot={lot}
          onClose={() => setAsking(false)}
          onUnload={(qty) => {
            setAsking(false)
            onRemove(qty)
          }}
        />
      )}
    </>
  )
}
