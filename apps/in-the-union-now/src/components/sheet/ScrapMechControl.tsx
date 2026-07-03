/**
 * ScrapMechControl — the "Scrap this Mech" retire helper on the mech sheet
 * (design-review R-7; Core Book p.248 "Scrap" ability).
 *
 * Breaking down a retired mech destroys it and deposits the FULL Salvage
 * Value of every Intact/Damaged component — chassis, systems, modules — into
 * the linked crawler's scrap pool, each at the component's own Tech Level
 * (verified against the extract: half-SV applies only to wreck-salvage rolls
 * and Repair costs, not the Scrap ability). Destroyed components yield
 * nothing (p.245). Cargo still in the mech's hold is handed to the crawler
 * first (stow semantics) so deleting the record loses no player data.
 *
 * Uses the app's delete-confirm pattern (shared ConfirmDialog, danger): the
 * scrap deposit is part of the confirm — one click books everything, then
 * the mech entity is deleted (SoftLinks cascade in the store) and the sheet
 * navigates to the crawler that received the scrap. Requires a linked
 * crawler: without one there is no pool to deposit into.
 *
 * Pure breakdown/deposit logic lives in lib/rules/scrapMech.ts.
 */

import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Btn, toast } from 'suref-react'

import {
  depositScrapDeposits,
  handOffCargo,
  mechScrapComponents,
  scrapMechBreakdown,
} from '../../lib/rules/scrapMech'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import { useEntityStore } from '../../stores/entityStore'
import { ConfirmDialog } from '../shared/ConfirmDialog'

type ScrapMechControlProps = {
  mech: Mech
  /** The linked home crawler — the deposit target. Null = unlinked (disabled). */
  crawler: Crawler | null
  /** Injectable store — defaults to useEntityStore. */
  store?: typeof useEntityStore
}

export function ScrapMechControl({ mech, crawler, store = useEntityStore }: ScrapMechControlProps) {
  const storeState = store()
  // Router probe (AppLink pattern): tests mount sheets without a
  // RouterProvider, so navigation degrades to a no-op there.
  const router = useRouter({ warn: false })
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)

  // Preview breakdown for the dialog copy (recomputed fresh on confirm).
  // Cheap enough to derive every render — a handful of catalog lookups.
  const breakdown = scrapMechBreakdown(mechScrapComponents(mech))

  const cargoCount = mech.cargoLots.length
  const depositText =
    breakdown.deposits.map((d) => `${d.count}× T${d.tl}`).join(' + ') || 'no Scrap'

  /**
   * Confirm: deposit the breakdown + hand off cargo onto the crawler AND
   * delete the mech (SoftLinks cascade) in ONE atomic transfer — a failure
   * changes nothing on disk, so scrap value can never duplicate or vanish.
   */
  async function handleScrap() {
    if (!crawler || pending) return
    setPending(true)
    try {
      const freshMech = storeState.get('mech', mech.id) ?? mech
      const freshCrawler = storeState.get('crawler', crawler.id) ?? crawler
      const fresh = scrapMechBreakdown(mechScrapComponents(freshMech))
      const pool = depositScrapDeposits(freshCrawler.scrapPool ?? {}, fresh.deposits)
      // A destroyed mech's cargo went up with it ("all Cargo, is destroyed" —
      // p.234/p.240): nothing is handed off. Only a retired (intact) mech's
      // hold moves to the crawler.
      const handOff = freshMech.destroyed
        ? { crawlerLots: freshCrawler.cargoLots ?? [], pool }
        : handOffCargo(freshMech.cargoLots, freshCrawler.cargoLots ?? [], pool)
      await storeState.transfer({
        updates: [
          {
            type: 'crawler',
            id: crawler.id,
            patch: { scrapPool: handOff.pool, cargoLots: handOff.crawlerLots },
          },
        ],
        deletes: [{ type: 'mech', id: mech.id }],
      })
      setConfirming(false)
      void router?.navigate({ to: `/sheet/crawler/${crawler.id}` })
    } catch (err) {
      console.error('[itun] Scrap mech failed — nothing was changed.', err)
      toast.error('Scrapping failed — nothing was changed. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Btn
        size="sm"
        variant="danger"
        disabled={crawler === null}
        title={
          crawler === null
            ? 'Link this mech to a crawler first — the Scrap deposits into its pool.'
            : `Break ${mech.name} down into Scrap and retire it.`
        }
        onClick={() => setConfirming(true)}
      >
        Scrap this Mech
      </Btn>
      <p className="m-0 font-body text-xs text-wk-muted">
        Break the mech down into its full Salvage Value in Scrap (p.248). Destroyed parts yield
        nothing.
      </p>

      {crawler && (
        <ConfirmDialog
          open={confirming}
          title={`Scrap ${mech.name}?`}
          danger
          confirmLabel="Scrap it"
          pendingLabel="Scrapping…"
          pending={pending}
          onConfirm={() => {
            void handleScrap()
          }}
          onCancel={() => setConfirming(false)}
        >
          <div className="flex flex-col gap-2">
            {mech.destroyed && (
              <p className="m-0 font-bold text-rust">
                {mech.name} was destroyed — its Chassis, mounted Systems and Modules, and all Cargo
                were lost with it and yield nothing (p.240). Scrapping just clears the wreck.
              </p>
            )}
            <p className="m-0">
              Breaking down {mech.name} deposits <strong>{depositText}</strong>
              {breakdown.total > 0 && <> ({breakdown.total} Scrap total)</>} into {crawler.name}
              &rsquo;s pool — each component at its full Salvage Value and own Tech Level (Scrap
              ability, p.248).
            </p>
            {breakdown.skipped.length > 0 && (
              <p className="m-0">
                Yields nothing:{' '}
                {breakdown.skipped
                  .map(
                    (s) =>
                      `${s.name} (${s.reason === 'destroyed' ? 'destroyed' : 'no Scrap value'})`
                  )
                  .join(', ')}
                .
              </p>
            )}
            {cargoCount > 0 && !mech.destroyed && (
              <p className="m-0">
                {cargoCount} cargo {cargoCount === 1 ? 'lot' : 'lots'} still in the hold move to{' '}
                {crawler.name} (Scrap lots join the pool).
              </p>
            )}
            <p className="m-0">
              This deletes the mech — it cannot be undone. {mech.name} will be permanently removed.
            </p>
          </div>
        </ConfirmDialog>
      )}
    </div>
  )
}
