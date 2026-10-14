/**
 * StorageManifest — The Hold panel.
 *
 * One component, two sides of the mech ⇄ crawler boundary:
 *   - side='mech' (mech sheet): capacity strip (used/cap + the canonical
 *     SlotGrid cells, over-capacity rendered honestly as red cells — never
 *     clamped), cargo
 *     chits (linear list, `CargoLotItem`) with 'Stow →' (whole-lot, SCRAP
 *     deposits the crawler's TL pool bucket), counterpart = the crawler's
 *     unlimited Storage Bay.
 *   - side='crawler' (crawler sheet): '∞ unlimited' strip, a dense poster
 *     `.storegrid` of magenta `.slot` tiles (the same `CargoLotItem`, graph-paper
 *     `.storebody` backdrop) with '← Load' (cap-checked; bulk partial-fill
 *     shows a dynamic 'Load N' label), counterpart = the docked mech's
 *     capacity. The tile-grid presentation is crawler-only — the mech Hold
 *     keeps its linear list unchanged.
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

import { Badge, BandTitle, cn, InfoCutout, SlotGrid, tokens } from 'component-lib'
import { totalLotUnits } from 'itun-domain/schemas/cargoLot'
import type { CSSProperties } from 'react'
import { reportCargo as report } from '../../lib/cargo/reportCargo'
import type { UseCargoResult } from '../../lib/cargo/useCargo'
import type { StorageManifestSide } from './CargoLotItem'
import { CargoLotItem } from './CargoLotItem'
import { GraphPaper } from './cargoBackdrops'
import { HoldAdder } from './HoldAdder'

type StorageManifestProps = {
  side: StorageManifestSide
  cargo: UseCargoResult
  /** Mech name; null when no mech is docked. */
  mechName: string | null
  /** Crawler name; null when no crawler is linked. */
  crawlerName: string | null
  readOnly?: boolean
}

// — The manifest —

/** The column template is `.su-sheet-crawler-manifest` (it splits at md). */
const MANIFEST = { display: 'grid', gap: tokens.space[12] } satisfies CSSProperties

const STRIP = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: tokens.space[12],
  borderBottom: `${tokens.borderWidth.pill} solid ${tokens.color.ink}`,
  padding: `${tokens.space[8]} ${tokens.space[12]}`,
  background: tokens.color.paper,
} satisfies CSSProperties

const STRIP_FIGURE = {
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize['2xl'],
  fontWeight: tokens.weight.bold,
  lineHeight: 1,
  color: tokens.color.ink,
} satisfies CSSProperties

const STRIP_INFINITY = {
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize['3xl'],
  fontWeight: tokens.weight.bold,
  lineHeight: 1,
  color: tokens.color.cargoDeep,
} satisfies CSSProperties

const STRIP_CAPS = {
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.bold,
  textTransform: 'uppercase',
  color: tokens.color.ink,
  opacity: 0.7,
} satisfies CSSProperties

const STRIP_LABEL = { ...STRIP_CAPS, letterSpacing: tokens.tracking.caps } satisfies CSSProperties

const STRIP_OVER = {
  ...STRIP_CAPS,
  color: tokens.color.statusBad,
  opacity: undefined,
} satisfies CSSProperties

const SMALL_TEXT = {
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.xs,
  lineHeight: 1 / 0.75,
  color: tokens.color.ink,
} satisfies CSSProperties

const EMPTY = {
  ...SMALL_TEXT,
  margin: 0,
  padding: `${tokens.space[16]} ${tokens.space[12]}`,
  textAlign: 'center',
  color: tokens.color.wkMuted,
} satisfies CSSProperties

const STORE_BODY = {
  position: 'relative',
  backgroundColor: tokens.color.paper,
  padding: tokens.space[12],
} satisfies CSSProperties

const STORE_GRID = {
  position: 'relative',
  margin: 0,
  display: 'grid',
  listStyle: 'none',
  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
  gap: tokens.space[10],
  padding: 0,
} satisfies CSSProperties

const CHIT_LIST = {
  margin: 0,
  display: 'flex',
  listStyle: 'none',
  flexDirection: 'column',
  gap: '7px',
  padding: '11px',
} satisfies CSSProperties

const ADDER_WRAP = { padding: `0 ${tokens.space[12]} ${tokens.space[12]}` } satisfies CSSProperties

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

const COUNTERPART_LABEL = {
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.bold,
  textTransform: 'uppercase',
  letterSpacing: tokens.tracking.caps,
  color: 'var(--tone-deep, var(--color-ink))',
} satisfies CSSProperties

const COUNTERPART_STAMP = { alignSelf: 'flex-start' } satisfies CSSProperties

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
  readOnly = false,
}: StorageManifestProps) {
  const lots = side === 'mech' ? cargo.state.carrierLots : cargo.state.depotLots
  const { used, cap, free, over } = cargo.usage
  const linkedCounterpart = side === 'mech' ? crawlerName : mechName
  // Read draws no write cue: a stow or load target with nothing wired to it is a
  // dashed drop box, so a read sheet says nothing rather than show one.
  const showCounterpart = !readOnly || linkedCounterpart !== null

  return (
    <div
      className={cn(
        'su-sheet-crawler-manifest',
        showCounterpart && 'su-sheet-crawler-manifest--split'
      )}
      style={MANIFEST}
      data-storage-side={side}
    >
      {/* Hold panel */}
      {/* The standard Info Cutout block, as the Chassis card and every
          listing Row (owner's call, 2026-10-14). */}
      <InfoCutout
        title={side === 'mech' ? 'Mech Hold' : 'Crawler Hold'}
        aside={<BandTitle variant="mute">{side === 'mech' ? mechName : crawlerName}</BandTitle>}
        flush
      >
        {/* Capacity strip — paper, like the rest of the Hold body: the
            tone-tinted ground it once wore was off the closed palette
            (ruleset §4.1). */}
        <div style={STRIP}>
          {side === 'mech' ? (
            <>
              <span style={STRIP_FIGURE}>
                {used}/{cap}
              </span>
              <span style={STRIP_LABEL}>Units</span>
              {/* The canonical addressable-slot cells (ruleset §5 atom 10):
                  dashed = empty, cargo = filled, status-bad = over-capacity —
                  never clamped. */}
              <SlotGrid
                used={used}
                cap={cap}
                readOnly={readOnly}
                label={`Hold ${used} of ${cap} slots used${over ? ' — over capacity' : ''}`}
              />
              {free > 0 && <span style={STRIP_CAPS}>{free} free</span>}
              {over && <span style={STRIP_OVER}>Over capacity</span>}
            </>
          ) : (
            <>
              <span style={STRIP_INFINITY}>&infin;</span>
              <span style={STRIP_LABEL}>Unlimited</span>
              <span style={SMALL_TEXT}>
                {totalLotUnits(lots)} units stowed &middot; {lots.length}{' '}
                {lots.length === 1 ? 'lot' : 'lots'}
              </span>
            </>
          )}
        </div>

        {/* Lot list — the mech Hold keeps the linear CargoLotItem chit list; the
            crawler Hold renders the poster's dense `.storegrid` of magenta
            `.slot` tiles on a graph-paper `.storebody` backdrop. */}
        {lots.length === 0 ? (
          <p style={EMPTY}>Hold empty.</p>
        ) : side === 'crawler' ? (
          <div style={STORE_BODY}>
            <GraphPaper />
            <ul style={STORE_GRID}>
              {lots.map((lot) => (
                <CargoLotItem
                  key={lot.id}
                  lot={lot}
                  side={side}
                  cargo={cargo}
                  linked={linkedCounterpart !== null}
                  readOnly={readOnly}
                  onRemove={() => report(cargo.removeCrawlerLot(lot.id))}
                />
              ))}
            </ul>
          </div>
        ) : (
          <ul style={CHIT_LIST}>
            {lots.map((lot) => (
              <CargoLotItem
                key={lot.id}
                lot={lot}
                side={side}
                cargo={cargo}
                linked={linkedCounterpart !== null}
                readOnly={readOnly}
                onRemove={() => report(cargo.removeMechLot(lot.id))}
              />
            ))}
          </ul>
        )}

        {/* Each container's own intake — always available, never gated on the
            other side of the boundary: 'Load' into the mech hold (no crawler
            needed), 'Stow' into the crawler Storage Bay (no docked mech needed). */}
        {!readOnly && (
          <div style={ADDER_WRAP}>
            <HoldAdder
              verb={side === 'mech' ? 'Load' : 'Stow'}
              containerLabel={side === 'mech' ? 'mech hold' : 'Storage Bay'}
              onAdd={(lot) =>
                side === 'mech' ? report(cargo.addMechLot(lot)) : report(cargo.addCrawlerLot(lot))
              }
            />
          </div>
        )}
      </InfoCutout>

      {/* Counterpart panel */}
      {showCounterpart && (
        <div style={linkedCounterpart !== null ? COUNTERPART_LINKED : COUNTERPART_EMPTY}>
          <span style={COUNTERPART_LABEL}>
            {side === 'mech' ? 'Stow target →' : '← Load target'}
          </span>
          {linkedCounterpart !== null ? (
            <>
              <Badge shape="stamp" size="full" style={COUNTERPART_STAMP}>
                {linkedCounterpart}
              </Badge>
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
