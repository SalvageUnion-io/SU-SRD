/**
 * StorageManifest — The Hold panel.
 *
 * One component, two sides of the mech ⇄ crawler boundary:
 *   - side='mech' (mech sheet): capacity strip (the `UNITS | used/cap` chip and
 *     the canonical SlotGrid cells, over-capacity rendered honestly as red
 *     cells — never clamped), then the lots (`CargoLotItem`) with 'Stow'
 *     (whole-lot, SCRAP deposits the crawler's TL pool bucket); counterpart =
 *     the crawler's unlimited Storage Bay.
 *   - side='crawler' (crawler sheet): an unlimited strip (`UNITS` and `LOTS`
 *     chips), the same lot rows with 'Load' (cap-checked; bulk partial-fill
 *     shows a dynamic 'Load N' label); counterpart = the docked mech's
 *     capacity.
 *
 * The mech's Hold is a `TitledBox` (its name on the cut-out `Head`, the
 * mech's beside it as a chip) under the mech sheet's own "The Hold" Slab. The
 * crawler's Hold sits inside the Storage Bay's card, so it is a section of
 * that bay: a Slab over its content, never a titled box (ruleset N5). The
 * counterpart is a `Box` holding the linked unit's relation chip
 * (`LinkedUnitLink`, R5), or, with none linked, the `EmptyState` that says why
 * the move waits.
 *
 * All transfer semantics live in the useCargo reducer — this component only
 * renders its state and dispatches. Unlinked boundary = disabled move
 * buttons with a title reason (design pattern 8), and so is a crawler the
 * viewer may not write (`cargo.crawlerLocked`: a player's mech in a Game, whose
 * crawler the Mediator keeps). readOnly removes the move buttons entirely.
 *
 * Player-facing vocabulary — one verb pair per container, so membership of the
 * mech hold and membership of the Storage Bay each read the same whether the lot
 * arrived across the boundary or was entered by hand. (These do NOT line up 1:1
 * with the internal reducer verbs.)
 *
 *   Mech cargo hold:      "Load"  in  /  "Unload" out
 *   Crawler Storage Bay:  "Stow"  in  /  "Unstow" out
 *
 *   - "Load"   = add a lot INTO the mech's cargo hold — the crawler side's
 *                crawler→mech button (internal `load`) and the mech Hold's own
 *                add form (internal `add-mech-lot`).
 *   - "Unload" = drop a lot from the mech hold (internal `remove-mech-lot`).
 *   - "Stow"   = add a lot INTO the crawler's Storage Bay — the mech side's
 *                mech→crawler button (internal `stow`, disabled with a reason
 *                when no crawler is linked) and the Bay's own add form
 *                (internal `add-crawler-lot`).
 *   - "Unstow" = drop a lot from the Storage Bay (internal `remove-crawler-lot`).
 *
 * Both containers are independently usable: the mech hold needs no crawler, and
 * the Storage Bay needs no docked mech. Only the two BOUNDARY moves are gated.
 */

import { totalLotUnits } from 'game-domain/schemas/cargoLot'
import type { CSSProperties } from 'react'
import { useId } from 'react'
import {
  Box,
  Chips,
  cn,
  EmptyState,
  Eyebrow,
  SlabSection,
  SlotGrid,
  Stat,
  Text,
  TitledBox,
  tokens,
} from '../../components/index'
import { reportCargo as report } from '../../lib/cargo/reportCargo'
import type { UseCargoResult } from '../../lib/cargo/useCargo'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { StorageManifestSide } from './CargoLotItem'
import { CargoLotItem } from './CargoLotItem'
import { HoldAdder } from './HoldAdder'
import { LinkedUnitLink } from './LinkedUnitLink'

type StorageManifestProps = {
  side: StorageManifestSide
  cargo: UseCargoResult
  /** Mech name; null when no mech is docked. */
  mechName: string | null
  /** Crawler name; null when no crawler is linked. */
  crawlerName: string | null
  /** The linked counterpart unit's sheet, for its Mini; without one it only reads. */
  counterpartHref?: string
  readOnly?: boolean
}

// — The manifest —

/** The column template is `.su-sheet-crawler-manifest` (it splits at md). */
const MANIFEST = { display: 'grid', gap: tokens.space[12] } satisfies CSSProperties

const STRIP = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: tokens.space[8],
} satisfies CSSProperties

const SMALL_TEXT = {
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.xs,
  lineHeight: 1 / 0.75,
  color: tokens.color.ink,
} satisfies CSSProperties

const MUTED_TEXT = { ...SMALL_TEXT, color: tokens.color.wkMuted } satisfies CSSProperties

const OVER_TEXT = { ...SMALL_TEXT, color: tokens.color.statusBad } satisfies CSSProperties

/**
 * The hold's padding by its frame. In the titled box the flush body has none
 * of its own: the strip's top is the 12px gutter every other card's body opens
 * with, off the cut-out band. Under a Slab the host's body already pads it.
 */
const HOLD_PAD = {
  framed: {
    strip: `${tokens.space[12]} ${tokens.space[12]} ${tokens.space[8]}`,
    list: `0 ${tokens.space[12]} ${tokens.space[6]}`,
    adder: tokens.space[12],
  },
  open: {
    strip: `0 0 ${tokens.space[8]}`,
    list: `0 0 ${tokens.space[6]}`,
    adder: `${tokens.space[12]} 0 0`,
  },
} satisfies Record<string, Record<'strip' | 'list' | 'adder', string>>

/** The linked counterpart's body: its lines a step apart, its Mini filling its line (N4). */
const COUNTERPART = { gap: tokens.space[8] } satisfies CSSProperties

export function StorageManifest({
  side,
  cargo,
  mechName,
  crawlerName,
  counterpartHref,
  readOnly = false,
}: StorageManifestProps) {
  const lots = side === 'mech' ? cargo.state.carrierLots : cargo.state.depotLots
  const { used, cap, free, over } = cargo.usage
  const linkedCounterpart = side === 'mech' ? crawlerName : mechName
  // Read draws no write cue: a stow or load target with nothing wired to it is a
  // dashed drop box, so a read sheet says nothing rather than show one.
  const showCounterpart = !readOnly || linkedCounterpart !== null
  const holdId = useId()
  // The crawler's hold is inside the Storage Bay's card: a Slab over content.
  const framed = side === 'mech'
  const pad = HOLD_PAD[framed ? 'framed' : 'open']
  const targetLabel = side === 'mech' ? 'Stow target' : 'Load target'

  const holdBody = (
    <>
      {/* Capacity strip: label-first chips, as every count reads. */}
      <div style={{ ...STRIP, padding: pad.strip }}>
        {side === 'mech' ? (
          <>
            <Stat
              size="mini"
              label={buildSheetCopy('units')}
              value={used}
              max={cap}
              state={over ? 'critical' : undefined}
            />
            {/* The canonical addressable-slot cells (ruleset §5 atom 10):
                dashed = empty, cargo = filled, status-bad = over-capacity —
                never clamped. */}
            <SlotGrid
              used={used}
              cap={cap}
              readOnly={readOnly}
              label={`Hold ${used} of ${cap} slots used${over ? ' — over capacity' : ''}`}
            />
            {free > 0 && <span style={MUTED_TEXT}>{buildSheetCopy('free', { free })}</span>}
            {over && <span style={OVER_TEXT}>{buildSheetCopy('overCapacity')}</span>}
          </>
        ) : (
          <>
            <Stat size="mini" label={buildSheetCopy('units')} value={totalLotUnits(lots)} />
            <Stat size="mini" label={buildSheetCopy('lots')} value={lots.length} />
            <span style={MUTED_TEXT}>{buildSheetCopy('unlimited')}</span>
          </>
        )}
      </div>

      {lots.length === 0 ? (
        <EmptyState variant="quiet" body={buildSheetCopy('holdEmpty')} />
      ) : (
        <ul className="su-entity-mini-list" style={{ padding: pad.list }}>
          {lots.map((lot) => (
            <CargoLotItem
              key={lot.id}
              lot={lot}
              side={side}
              cargo={cargo}
              linked={linkedCounterpart !== null}
              readOnly={readOnly}
              onRemove={() =>
                report(
                  side === 'mech' ? cargo.removeMechLot(lot.id) : cargo.removeCrawlerLot(lot.id)
                )
              }
            />
          ))}
        </ul>
      )}

      {/* Each container's own intake — always available, never gated on the
          other side of the boundary: 'Load' into the mech hold (no crawler
          needed), 'Stow' into the crawler Storage Bay (no docked mech needed). */}
      {!readOnly && (
        <div style={{ padding: pad.adder }}>
          <HoldAdder
            verb={side === 'mech' ? 'Load' : 'Stow'}
            containerLabel={
              side === 'mech' ? buildSheetCopy('mechHold') : buildSheetCopy('storageBay')
            }
            onAdd={(lot) =>
              side === 'mech' ? report(cargo.addMechLot(lot)) : report(cargo.addCrawlerLot(lot))
            }
          />
        </div>
      )}
    </>
  )

  return (
    <div
      className={cn(
        'su-sheet-crawler-manifest',
        showCounterpart && 'su-sheet-crawler-manifest--split'
      )}
      style={MANIFEST}
      data-storage-side={side}
    >
      {/* Hold panel. The mech's: the house titled box, as the Chassis card, the
          mech it belongs to a chip on its band. The crawler's is a section of
          the Storage Bay it sits in (N5). */}
      {framed ? (
        <TitledBox
          as="section"
          title={buildSheetCopy('mechHold2')}
          chips={
            mechName ? (
              <Chips
                chips={{
                  durations: [],
                  facts: [{ key: 'mech', label: mechName, value: undefined }],
                  tags: [],
                }}
                size="mini"
              />
            ) : undefined
          }
          body="flush"
        >
          {holdBody}
        </TitledBox>
      ) : (
        // The Storage Bay's other sections' Mini Size.
        <SlabSection title={buildSheetCopy('crawlerHold')} id={holdId} size="mini">
          {holdBody}
        </SlabSection>
      )}

      {/* Counterpart panel: the house Box around the linked unit, or the one
          empty state (dashed: fillable) while nothing is linked. */}
      {showCounterpart &&
        (linkedCounterpart !== null ? (
          <Box bodyStyle={COUNTERPART}>
            <Eyebrow tone="toneDeep">{targetLabel}</Eyebrow>
            <LinkedUnitLink
              kind={side === 'mech' ? 'crawler' : 'mech'}
              name={linkedCounterpart}
              href={counterpartHref}
            />
            {side === 'mech' ? (
              <span style={SMALL_TEXT}>{buildSheetCopy('storageBayUnlimited')}</span>
            ) : (
              <span style={SMALL_TEXT}>{buildSheetCopy('slotsFree', { used, cap, free })}</span>
            )}
            {cargo.crawlerLocked !== null && !readOnly && (
              <Text variant="note">{cargo.crawlerLocked}</Text>
            )}
          </Box>
        ) : (
          <EmptyState
            headline={targetLabel}
            body={
              side === 'mech'
                ? buildSheetCopy('noCrawlerAssignedStowIs')
                : buildSheetCopy('noMechAssignedLoadIs')
            }
          />
        ))}
    </div>
  )
}
