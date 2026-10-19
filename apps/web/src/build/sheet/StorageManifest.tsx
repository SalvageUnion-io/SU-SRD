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
 * The mech's Hold is an Info Cutout under the mech sheet's own "The Hold"
 * Slab. The crawler's Hold sits inside the Storage Bay's card, so it is a
 * section of that bay: a Slab over its content, never a titled box (ruleset
 * N5). The linked counterpart unit is a Token (`LinkedUnitLink`).
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
import { reportCargo as report } from '../../lib/cargo/reportCargo'
import type { UseCargoResult } from '../../lib/cargo/useCargo'
import {
  BandTitle,
  cn,
  EmptyState,
  Eyebrow,
  InfoCutout,
  Slab,
  SlotGrid,
  Stat,
  tokens,
} from '../../components/index'
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
  /** The linked counterpart unit's sheet, for its Token; without one it only reads. */
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

const LOT_LIST = { margin: 0, listStyle: 'none' } satisfies CSSProperties

/**
 * The hold's padding by its frame. In the Info Cutout the flush body has none
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

/** The Slab sits close over the strip, as a picker's section label does. */
const HOLD_SLAB = { marginBottom: tokens.space[6] } satisfies CSSProperties

/** The open hold: a grid cell that may shrink beside its counterpart. */
const HOLD_OPEN = { minWidth: 0 } satisfies CSSProperties

/** A column whose lines stretch: the counterpart's Token fills its line (N4). */
const COUNTERPART = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  borderRadius: tokens.radius.card,
  borderWidth: tokens.borderWidth.pill,
  padding: tokens.space[12],
  background: tokens.color.paper,
} satisfies CSSProperties

const COUNTERPART_LINKED = {
  ...COUNTERPART,
  borderStyle: 'solid',
  borderColor: tokens.color.ink,
} satisfies CSSProperties

const COUNTERPART_EMPTY = {
  ...COUNTERPART,
  borderStyle: 'dashed',
  borderColor: tokens.color.wkFaint,
} satisfies CSSProperties

const NOTE = {
  margin: 0,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.note,
  lineHeight: 1.375,
  color: tokens.color.wkMuted,
} satisfies CSSProperties

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

  const holdBody = (
    <>
      {/* Capacity strip: label-first chips, as every count reads. */}
      <div style={{ ...STRIP, padding: pad.strip }}>
        {side === 'mech' ? (
          <>
            <Stat
              orientation="horizontal"
              size="compact"
              label="Units"
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
            {free > 0 && <span style={MUTED_TEXT}>{free} free</span>}
            {over && <span style={OVER_TEXT}>Over capacity</span>}
          </>
        ) : (
          <>
            <Stat
              orientation="horizontal"
              size="compact"
              label="Units"
              value={totalLotUnits(lots)}
            />
            <Stat orientation="horizontal" size="compact" label="Lots" value={lots.length} />
            <span style={MUTED_TEXT}>Unlimited</span>
          </>
        )}
      </div>

      {lots.length === 0 ? (
        <EmptyState variant="quiet" body="Hold empty." />
      ) : (
        <ul style={{ ...LOT_LIST, padding: pad.list }}>
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
            containerLabel={side === 'mech' ? 'mech hold' : 'Storage Bay'}
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
      {/* Hold panel. The mech's: the standard Info Cutout block, as the
          Chassis card and every listing Row (owner's call, 2026-10-14). The
          crawler's is a section of the Storage Bay it sits in (N5). */}
      {framed ? (
        <InfoCutout
          title="Mech Hold"
          aside={<BandTitle variant="mute">{mechName}</BandTitle>}
          flush
        >
          {holdBody}
        </InfoCutout>
      ) : (
        <section aria-labelledby={holdId} style={HOLD_OPEN}>
          <Slab label="Crawler Hold" id={holdId} style={HOLD_SLAB} />
          {holdBody}
        </section>
      )}

      {/* Counterpart panel */}
      {showCounterpart && (
        <div style={linkedCounterpart !== null ? COUNTERPART_LINKED : COUNTERPART_EMPTY}>
          <Eyebrow tone="toneDeep">{side === 'mech' ? 'Stow target' : 'Load target'}</Eyebrow>
          {linkedCounterpart !== null ? (
            <>
              <LinkedUnitLink
                kind={side === 'mech' ? 'crawler' : 'mech'}
                name={linkedCounterpart}
                href={counterpartHref}
                stats={[]}
              />
              {side === 'mech' ? (
                <span style={SMALL_TEXT}>&infin; Storage Bay &middot; unlimited</span>
              ) : (
                <span style={SMALL_TEXT}>
                  {used}/{cap} slots &middot; {free} free
                </span>
              )}
              {cargo.crawlerLocked !== null && !readOnly && (
                <p style={NOTE}>{cargo.crawlerLocked}</p>
              )}
            </>
          ) : (
            <p style={NOTE}>
              {side === 'mech'
                ? 'No crawler assigned — stow is disabled until a home crawler is assigned.'
                : 'No mech assigned — load is disabled until a mech is assigned.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
