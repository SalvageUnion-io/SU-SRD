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
 * nor is the lot: every lot is the one `CargoLotLine`.
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

import type { CSSProperties } from 'react'
import { Button, EmptyState, SlabSection, Stack, Stat, tokens } from '../../components/index'
import { reportCargo } from '../../lib/cargo/reportCargo'
import type { UsePartnerCargoResult } from '../../lib/cargo/usePartnerCargo'
import { buildSheetCopy } from '../../messages/build-sheet'
import { CargoLotLine } from './CargoLotLine'

type PartnerHoldProps = {
  cargo: UsePartnerCargoResult
  /** Whether a crawler is linked — gates the two BOUNDARY moves only. */
  crawlerLinked: boolean
  readOnly?: boolean
}

const LOCKED_NOTE = {
  color: tokens.color.wkMuted,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  marginBottom: tokens.space[4],
} satisfies CSSProperties

/** One lot line a row, as a sheet's item list (`.su-entity-mini-list`). */
const LOT_LIST = 'su-entity-mini-list'

export function PartnerHold({ cargo, crawlerLinked, readOnly = false }: PartnerHoldProps) {
  const { state, usage, crawlerLocked } = cargo
  const editable = !readOnly
  // Stow and Load both write the crawler; a player in a Game may not (ADR-038 §5).
  const stowBlocked = crawlerLinked ? crawlerLocked : 'No crawler is assigned.'
  const loadBlocked = crawlerLocked ?? (usage.free <= 0 ? 'The hold is full.' : null)

  return (
    <Stack gap={16}>
      {/* Over-capacity is shown honestly rather than clamped — same rule the
          mech Hold follows. */}
      <Stat label={buildSheetCopy('cargo')} value={usage.used} max={usage.cap} />

      <SlabSection as="h4" title={buildSheetCopy('carried')}>
        {state.carrierLots.length === 0 ? (
          <EmptyState variant="quiet" body={buildSheetCopy('nothingCarried')} />
        ) : (
          <ul className={LOT_LIST}>
            {state.carrierLots.map((lot) => (
              <CargoLotLine
                key={lot.id}
                lot={lot}
                actions={
                  editable ? (
                    <>
                      <Button
                        variant="pencil"
                        size="mini"
                        disabled={stowBlocked !== null}
                        title={stowBlocked ?? undefined}
                        onClick={() => reportCargo(cargo.stow(lot.id))}
                      >
                        {buildSheetCopy('stow')}
                      </Button>
                      <Button
                        variant="pencil"
                        size="mini"
                        onClick={() => reportCargo(cargo.removeLot(lot.id))}
                      >
                        {buildSheetCopy('unload')}
                      </Button>
                    </>
                  ) : undefined
                }
              />
            ))}
          </ul>
        )}
      </SlabSection>

      {/* The Storage Bay side appears only when there is one to move against —
          an empty "no crawler" panel would be noise on a partner sheet. */}
      {crawlerLinked && (
        <SlabSection as="h4" title={buildSheetCopy('storageBay')}>
          {editable && crawlerLocked !== null && <p style={LOCKED_NOTE}>{crawlerLocked}</p>}
          {state.depotLots.length === 0 ? (
            <EmptyState variant="quiet" body={buildSheetCopy('theStorageBayIsEmpty')} />
          ) : (
            <ul className={LOT_LIST}>
              {state.depotLots.map((lot) => (
                <CargoLotLine
                  key={lot.id}
                  lot={lot}
                  actions={
                    editable ? (
                      <Button
                        variant="pencil"
                        size="mini"
                        disabled={loadBlocked !== null}
                        title={loadBlocked ?? undefined}
                        onClick={() => reportCargo(cargo.load(lot.id))}
                      >
                        {buildSheetCopy('load')}
                      </Button>
                    ) : undefined
                  }
                />
              ))}
            </ul>
          )}
        </SlabSection>
      )}
    </Stack>
  )
}
