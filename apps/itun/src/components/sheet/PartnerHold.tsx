/**
 * PartnerHold — the partner's cargo hold and its boundary with the crawler
 * Storage Bay.
 *
 * A deliberately smaller surface than `StorageManifest`, which renders the
 * mech⇄crawler boundary. That component is built around two named sides, a
 * counterpart panel and a scrap-pool round trip; a partner carries between 1
 * and 3 slots, so a third side there would have cost far more than it
 * returned. The transfer semantics
 * are not duplicated — both go through the same `cargoTransfer` reducer — and
 * nor is the lot: every lot is the one `CargoLotRow`.
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

import { Button, EmptyState, Stat, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import { reportCargo } from '../../lib/cargo/reportCargo'
import type { UsePartnerCargoResult } from '../../lib/cargo/usePartnerCargo'
import { CargoLotRow } from '../shared/CargoLotRow'

type PartnerHoldProps = {
  cargo: UsePartnerCargoResult
  /** Whether a crawler is linked — gates the two BOUNDARY moves only. */
  crawlerLinked: boolean
  readOnly?: boolean
}

const HOLD = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
} satisfies CSSProperties

const SIDE_HEADING = {
  color: tokens.color.wkMuted,
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.caption,
  fontWeight: tokens.weight.bold,
  letterSpacing: tokens.tracking.caps,
  marginBottom: tokens.space[4],
  textTransform: 'uppercase',
} satisfies CSSProperties

const LOCKED_NOTE = {
  color: tokens.color.wkMuted,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  marginBottom: tokens.space[4],
} satisfies CSSProperties

const LOT_LIST = { listStyleType: 'none' } satisfies CSSProperties

export function PartnerHold({ cargo, crawlerLinked, readOnly = false }: PartnerHoldProps) {
  const { state, usage, crawlerLocked } = cargo
  const editable = !readOnly
  // Stow and Load both write the crawler; a player in a Game may not (ADR-038 §5).
  const stowBlocked = crawlerLinked ? crawlerLocked : 'No crawler is assigned.'
  const loadBlocked = crawlerLocked ?? (usage.free <= 0 ? 'The hold is full.' : null)

  return (
    <div style={HOLD}>
      {/* Over-capacity is shown honestly rather than clamped — same rule the
          mech Hold follows. */}
      <Stat label="Cargo" value={usage.used} max={usage.cap} />

      <div>
        <h4 style={SIDE_HEADING}>Carried</h4>
        {state.carrierLots.length === 0 ? (
          <EmptyState variant="quiet" body="Nothing carried." />
        ) : (
          <ul style={LOT_LIST}>
            {state.carrierLots.map((lot) => (
              <CargoLotRow key={lot.id} lot={lot}>
                {editable && (
                  <>
                    <Button
                      variant="ghost"
                      size="compact"
                      disabled={stowBlocked !== null}
                      title={stowBlocked ?? undefined}
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
              </CargoLotRow>
            ))}
          </ul>
        )}
      </div>

      {/* The Storage Bay side appears only when there is one to move against —
          an empty "no crawler" panel would be noise on a partner sheet. */}
      {crawlerLinked && (
        <div>
          <h4 style={SIDE_HEADING}>Storage Bay</h4>
          {editable && crawlerLocked !== null && <p style={LOCKED_NOTE}>{crawlerLocked}</p>}
          {state.depotLots.length === 0 ? (
            <EmptyState variant="quiet" body="The Storage Bay is empty." />
          ) : (
            <ul style={LOT_LIST}>
              {state.depotLots.map((lot) => (
                <CargoLotRow key={lot.id} lot={lot}>
                  {editable && (
                    <Button
                      variant="ghost"
                      size="compact"
                      disabled={loadBlocked !== null}
                      title={loadBlocked ?? undefined}
                      onClick={() => reportCargo(cargo.load(lot.id))}
                    >
                      ← Load
                    </Button>
                  )}
                </CargoLotRow>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
