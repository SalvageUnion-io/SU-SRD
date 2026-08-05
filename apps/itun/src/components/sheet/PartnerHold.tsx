/**
 * PartnerHold — the partner's cargo hold and its boundary with the crawler
 * Storage Bay.
 *
 * A deliberately smaller surface than `StorageManifest`, which renders the
 * mech⇄crawler boundary. That component is built around two named sides with
 * two distinct presentations (a linear chit list and a poster tile grid) and a
 * scrap-pool round trip; a partner carries between 1 and 3 slots, so a third
 * side there would have cost far more than it returned. The transfer semantics
 * are not duplicated — both go through the same `cargoTransfer` reducer.
 *
 * Vocabulary matches the mech hold, because a partner "uses the same rules as
 * Mechs": Load in, Unload out, Stow across to the Storage Bay. The Bay keeps
 * its own Stow/Unstow pair on the crawler sheet.
 *
 * Every move goes through `reportCargo` — the same helper `StorageManifest`
 * uses. The disabled states below pre-empt the predictable refusals; the
 * unpredictable ones (a blocked or failed save, a second click landing after
 * the first already moved the lot) only exist in the resolved result, and
 * dropping it left the player with a button that appeared to do nothing.
 */

import { Button, EmptyState, Stat } from 'component-lib'
import type { ReactNode } from 'react'
import { reportCargo } from '../../lib/cargo/reportCargo'
import type { UsePartnerCargoResult } from '../../lib/cargo/usePartnerCargo'
import type { CargoLot } from '../../lib/schemas/cargoLot'

type PartnerHoldProps = {
  cargo: UsePartnerCargoResult
  /** Whether a crawler is linked — gates the two BOUNDARY moves only. */
  crawlerLinked: boolean
  readOnly?: boolean
}

function LotRow({ lot, children }: { lot: CargoLot; children?: ReactNode }) {
  return (
    <li className="flex items-center gap-2 border-b border-ink/10 py-1.5 last:border-b-0">
      <span className="min-w-0 flex-1 truncate font-body text-sm text-ink">{lot.name}</span>
      <span className="shrink-0 font-cond text-caption tabular-nums text-wk-muted">
        {lot.units}
      </span>
      {children}
    </li>
  )
}

export function PartnerHold({ cargo, crawlerLinked, readOnly = false }: PartnerHoldProps) {
  const { state, usage } = cargo
  const editable = !readOnly

  return (
    <div className="flex flex-col gap-4">
      {/* Over-capacity is shown honestly rather than clamped — same rule the
          mech Hold follows. */}
      <Stat label="Cargo" value={usage.used} max={usage.cap} />

      <div>
        <h4 className="mb-1 font-cond text-caption font-bold uppercase tracking-caps text-wk-muted">
          Carried
        </h4>
        {state.carrierLots.length === 0 ? (
          <EmptyState variant="quiet" body="Nothing carried." />
        ) : (
          <ul className="list-none">
            {state.carrierLots.map((lot) => (
              <LotRow key={lot.id} lot={lot}>
                {editable && (
                  <>
                    <Button
                      variant="ghost"
                      size="compact"
                      disabled={!crawlerLinked}
                      title={crawlerLinked ? undefined : 'No crawler is linked.'}
                      onClick={() => reportCargo(cargo.stow(lot.id))}
                    >
                      Stow →
                    </Button>
                    <Button
                      variant="ghost"
                      size="compact"
                      onClick={() => reportCargo(cargo.removeLot(lot.id))}
                    >
                      Unload
                    </Button>
                  </>
                )}
              </LotRow>
            ))}
          </ul>
        )}
      </div>

      {/* The Storage Bay side appears only when there is one to move against —
          an empty "no crawler" panel would be noise on a partner sheet. */}
      {crawlerLinked && (
        <div>
          <h4 className="mb-1 font-cond text-caption font-bold uppercase tracking-caps text-wk-muted">
            Storage Bay
          </h4>
          {state.depotLots.length === 0 ? (
            <EmptyState variant="quiet" body="The Storage Bay is empty." />
          ) : (
            <ul className="list-none">
              {state.depotLots.map((lot) => (
                <LotRow key={lot.id} lot={lot}>
                  {editable && (
                    <Button
                      variant="ghost"
                      size="compact"
                      disabled={usage.free <= 0}
                      title={usage.free <= 0 ? 'The hold is full.' : undefined}
                      onClick={() => reportCargo(cargo.load(lot.id))}
                    >
                      ← Load
                    </Button>
                  )}
                </LotRow>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
