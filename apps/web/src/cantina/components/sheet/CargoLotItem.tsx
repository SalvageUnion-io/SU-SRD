/**
 * CargoLotItem — one lot in The Hold (`StorageManifest`), on either side of the
 * mech ⇄ crawler boundary, with the cap-checked move affordance both sides
 * share.
 */

import type { CargoLot } from 'cantina-domain/schemas/cargoLot'
import { Button } from '../../../ui/index'
import { loadableQty } from '../../lib/cargo/cargoTransfer'
import { reportCargo as report } from '../../lib/cargo/reportCargo'
import type { UseCargoResult } from '../../lib/cargo/useCargo'
import { CargoLotRow } from '../shared/CargoLotRow'

export type StorageManifestSide = 'mech' | 'crawler'

/**
 * The cap-checked move affordance of both sides — the single source of the
 * button label + disabled reason for the mech Hold's and the crawler Hold's
 * lots.
 *
 *   - The boundary gate is per-`side`: the mech STOWS a lot to the crawler's
 *     Storage Bay ('Stow →', disabled when no crawler is linked), the crawler
 *     LOADS a lot onto the mech ('← Load', disabled when no mech is docked).
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
  let label = side === 'mech' ? 'Stow →' : '← Load'
  // Both moves write the crawler, so a crawler the viewer may not write closes
  // them whichever sheet they are on.
  let disabledReason: string | null = !linked
    ? side === 'mech'
      ? 'No crawler assigned — nothing to stow to.'
      : 'No mech assigned — nothing to load onto.'
    : cargo.crawlerLocked

  if (side === 'crawler' && disabledReason === null) {
    // The reducer's own fit math, so the button and the load can't disagree.
    const fitsQty = loadableQty(lot, cargo.usage.free)
    if (fitsQty <= 0) {
      disabledReason = `"${lot.name}" does not fit — ${cargo.usage.free} slots free.`
    }
    const partial = lot.kind === 'bulk' && lot.qty !== undefined && fitsQty < lot.qty
    label = partial && fitsQty > 0 ? `← Load ${fitsQty}` : '← Load'
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
   */
  onRemove?: () => void
}

/**
 * CargoLotItem — one lot, on either side of the mech ⇄ crawler boundary: the
 * one lot row (`CargoLotRow`) with this side's buttons.
 *   - `side === 'mech'`    → 'Stow →' to the crawler's Storage Bay, and 'Unload'.
 *   - `side === 'crawler'` → the cap-checked '← Load' onto the docked mech, and
 *     'Unstow'.
 * The label + disabled reason come from the shared `moveAffordance`.
 */
export function CargoLotItem({ lot, side, cargo, linked, readOnly, onRemove }: CargoLotItemProps) {
  const { label, disabledReason } = moveAffordance(lot, side, cargo, linked)

  function handleMove() {
    if (side === 'mech') report(cargo.stow(lot.id))
    else report(cargo.load(lot.id))
  }

  return (
    <CargoLotRow lot={lot}>
      {!readOnly && (
        <>
          <Button
            variant="ghost"
            size="compact"
            disabled={disabledReason !== null}
            title={disabledReason ?? undefined}
            aria-label={`${side === 'mech' ? 'Stow' : 'Load'} ${lot.name}`}
            onClick={handleMove}
            className="su-sheet-crawler-move"
          >
            {label}
          </Button>
          {onRemove && (
            <Button
              variant="ghost"
              size="compact"
              aria-label={`${side === 'mech' ? 'Unload' : 'Unstow'} ${lot.name}`}
              title={
                side === 'mech'
                  ? `Unload "${lot.name}" from the mech hold`
                  : `Unstow "${lot.name}" from the Storage Bay`
              }
              onClick={onRemove}
              className="su-sheet-crawler-remove"
            >
              {side === 'mech' ? 'Unload' : 'Unstow'}
            </Button>
          )}
        </>
      )}
    </CargoLotRow>
  )
}
