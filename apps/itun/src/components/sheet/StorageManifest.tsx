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

import { Badge, BandTitle, Button, Card, cn, Input, SlotGrid, Stat, tokens } from 'component-lib'
import type { CargoLot } from 'itun-domain/schemas/cargoLot'
import { makeScrapLot, makeUnitLot, totalLotUnits } from 'itun-domain/schemas/cargoLot'
import type { CSSProperties } from 'react'
import { useId, useState } from 'react'
import { reportCargo as report } from '../../lib/cargo/reportCargo'
import type { UseCargoResult } from '../../lib/cargo/useCargo'

/** A slot cost is a non-negative INTEGER (`CargoLotSchema.units` is `.int()`). */
function coerceSlots(raw: string): number {
  const parsed = Math.trunc(Number(raw))
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

type StorageManifestSide = 'mech' | 'crawler'

type StorageManifestProps = {
  side: StorageManifestSide
  cargo: UseCargoResult
  /** Mech name; null when no mech is docked. */
  mechName: string | null
  /** Crawler name; null when no crawler is linked. */
  crawlerName: string | null
  readOnly?: boolean
  className?: string
}

const SIDE_TINT: Record<StorageManifestSide, string> = {
  mech: 'var(--color-mech)',
  crawler: 'var(--color-crawler)',
}

/** An SVG backdrop filling its positioned parent. */
const BACKDROP = {
  pointerEvents: 'none',
  position: 'absolute',
  inset: 0,
  height: '100%',
  width: '100%',
} satisfies CSSProperties

const CAPS_BUTTON = {
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.bold,
  textTransform: 'uppercase',
  letterSpacing: tokens.tracking.capsTight,
  borderWidth: 0,
} satisfies CSSProperties

// — The crawler tile —

const TILE = {
  display: 'flex',
  minHeight: '64px',
  flexDirection: 'column',
  gap: tokens.space[6],
  borderRadius: tokens.radius.card,
  border: `${tokens.borderWidth.pill} solid var(--tone)`,
  padding: tokens.space[8],
  background: 'var(--tone)',
} satisfies CSSProperties

const TILE_HEAD = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: tokens.space[6],
} satisfies CSSProperties

const TILE_NAME = { minWidth: 0, flex: 1, overflowWrap: 'break-word' } satisfies CSSProperties

const TILE_ACTIONS = {
  marginTop: 'auto',
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: tokens.space[4],
} satisfies CSSProperties

/** A tile's chip button; its hover ground is the `.su-sheet-crawler-*` class. */
const TILE_BUTTON = {
  ...CAPS_BUTTON,
  borderRadius: tokens.radius.badge,
  padding: `${tokens.space[2]} ${tokens.space[8]}`,
} satisfies CSSProperties

// — The mech chit —

const CHIT = {
  display: 'flex',
  alignItems: 'stretch',
  overflow: 'hidden',
  borderRadius: tokens.radius.badge,
  border: `${tokens.borderWidth.chrome} solid ${tokens.color.ink}`,
  backgroundColor: tokens.color.paper,
} satisfies CSSProperties

const MARKER = {
  position: 'relative',
  display: 'flex',
  width: '42px',
  flexShrink: 0,
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: tokens.space[2],
  overflow: 'hidden',
  padding: `${tokens.space[6]} 0`,
  color: tokens.color.paper,
} satisfies CSSProperties

const MARKER_UNIT = { ...MARKER, backgroundColor: tokens.color.ink } satisfies CSSProperties

const MARKER_QTY = {
  position: 'relative',
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.lede,
  fontWeight: tokens.weight.bold,
  lineHeight: 1,
} satisfies CSSProperties

const MARKER_GLYPH = {
  position: 'relative',
  fontSize: tokens.fontSize.caption,
  lineHeight: 1,
} satisfies CSSProperties

const MARKER_KIND = {
  position: 'relative',
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.semibold,
  textTransform: 'uppercase',
  letterSpacing: tokens.tracking.caps,
} satisfies CSSProperties

const NAME_CELL = {
  display: 'flex',
  minWidth: 0,
  flex: 1,
  flexDirection: 'column',
  justifyContent: 'center',
  gap: tokens.space[2],
  padding: `${tokens.space[6]} ${tokens.space[10]}`,
} satisfies CSSProperties

const CHIT_NAME = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.sm,
  fontWeight: tokens.weight.bold,
  textTransform: 'uppercase',
  lineHeight: 1,
  color: tokens.color.ink,
} satisfies CSSProperties

const CHIT_META = {
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.badge,
  textTransform: 'uppercase',
  letterSpacing: tokens.tracking.capsTight,
  color: tokens.color.wkMuted,
} satisfies CSSProperties

const UNITS_CELL = {
  display: 'flex',
  width: '36px',
  flexShrink: 0,
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: `${tokens.space[4]} 0`,
  background: tokens.color.wkBg,
} satisfies CSSProperties

const UNITS_VALUE = {
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.lede,
  fontWeight: tokens.weight.bold,
  lineHeight: 1,
  color: tokens.color.ink,
} satisfies CSSProperties

const UNITS_SUFFIX = {
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  textTransform: 'uppercase',
  color: tokens.color.wkMuted,
} satisfies CSSProperties

/** A chit's edge-to-edge button; its hover ground is the `.su-sheet-crawler-*` class. */
const CHIT_BUTTON = {
  ...CAPS_BUTTON,
  flexShrink: 0,
  borderRadius: 0,
  padding: `0 ${tokens.space[10]}`,
} satisfies CSSProperties

const CHIT_UNLOAD = {
  ...CHIT_BUTTON,
  borderLeft: `${tokens.borderWidth.chrome} solid ${tokens.color.ink}`,
} satisfies CSSProperties

// — The intake form —

const ADDER = {
  marginTop: tokens.space[12],
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: tokens.space[8],
  borderRadius: tokens.radius.card,
  border: `${tokens.borderWidth.chrome} dashed ${tokens.color.wkFaint}`,
  padding: tokens.space[10],
} satisfies CSSProperties

const KIND_TOGGLE = {
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space[4],
} satisfies CSSProperties

const ADDER_LABEL = {
  display: 'flex',
  alignItems: 'center',
  gap: tokens.space[4],
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.bold,
  textTransform: 'uppercase',
  letterSpacing: '0.025em',
  color: tokens.color.wkMuted,
} satisfies CSSProperties

/** A compact `Input`: tighter and smaller than its own skin. */
const COMPACT_INPUT = {
  padding: `${tokens.space[6]} ${tokens.space[8]}`,
  fontSize: tokens.fontSize.xs,
  lineHeight: 1 / 0.75,
} satisfies CSSProperties

const NAME_INPUT = { ...COMPACT_INPUT, width: '144px', flex: 1 } satisfies CSSProperties

const NUMBER_INPUT = { ...COMPACT_INPUT, width: '56px' } satisfies CSSProperties

// — The manifest —

/** The column template is `.su-sheet-crawler-manifest` (it splits at md). */
const MANIFEST = { display: 'grid', gap: tokens.space[12] } satisfies CSSProperties

const HOLD_CARD = { boxShadow: '0 2px 8px -3px var(--color-ink-50)' } satisfies CSSProperties

const HOLD_TITLE = {
  margin: 0,
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.xs,
  lineHeight: 1 / 0.75,
  fontWeight: tokens.weight.bold,
  textTransform: 'uppercase',
  letterSpacing: tokens.tracking.caps,
  color: tokens.color.paper,
} satisfies CSSProperties

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

/**
 * Diagonal cargo hazard stripes for the BULK marker cell — the poster's
 * repeating-gradient fill rebuilt as an SVG pattern. Flat repeating patterns
 * are SVG, never gradient fills (ruleset §3.5 — no gradients, anywhere).
 */
function HazardStripes() {
  const id = useId()
  return (
    <svg aria-hidden="true" style={BACKDROP}>
      <defs>
        <pattern
          id={id}
          width="10"
          height="10"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="10" height="10" fill={tokens.color.cargo} />
          <rect x="5" width="5" height="10" fill={tokens.color.cargoDeep} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/**
 * The crawler Hold's poster `.storebody` graph-paper backdrop — a 34px
 * tone-tinted grid, rebuilt as an SVG pattern for the same §3.5 reason.
 */
function GraphPaper() {
  const id = useId()
  const line = { fill: 'color-mix(in srgb, var(--tone) 16%, transparent)' }
  return (
    <svg aria-hidden="true" style={BACKDROP}>
      <defs>
        <pattern id={id} width="34" height="34" patternUnits="userSpaceOnUse">
          <rect width="34" height="1" style={line} />
          <rect width="1" height="34" style={line} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/** Per-unit slot cost of a bulk lot (mirrors the reducer's accounting). */
function perUnitCost(lot: CargoLot): number {
  if (lot.kind !== 'bulk' || lot.qty === undefined || lot.qty <= 0) return lot.units
  return Math.max(1, Math.round(lot.units / lot.qty))
}

/**
 * The cap-checked move affordance shared by both Hold layouts — the single
 * source of the button label + disabled reason for the linear mech chit and
 * the poster crawler tile.
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
      ? 'No crawler linked — nothing to stow to.'
      : 'No mech docked — nothing to load onto.'
    : cargo.crawlerLocked

  if (side === 'crawler' && disabledReason === null) {
    const per = perUnitCost(lot)
    const fitsQty =
      lot.kind === 'bulk' && lot.qty !== undefined
        ? Math.min(lot.qty, Math.floor(cargo.usage.free / per))
        : lot.units <= cargo.usage.free
          ? 1
          : 0
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
 * CargoLotItem — one lot, rendered for either side of the mech ⇄ crawler
 * boundary. Both presentations and their shared cap-checked move affordance
 * live here:
 *   - `side === 'mech'`    → the linear chit (marker cell + name + units cell)
 *     with a 'Stow →' button, laid out in the mech Hold's flat list.
 *   - `side === 'crawler'` → the poster `.slot` tile (magenta `--tone`, name
 *     stamp over an MChip qty/TL tag) with the cap-checked '← Load' button.
 * The label + disabled reason come from the shared `moveAffordance`, and both
 * move buttons route through the shared `Button` (variant differs only to keep
 * each layout's ground: `ghost` for the chit's transparent cell, `default` for
 * the tile's paper chip).
 */
function CargoLotItem({ lot, side, cargo, linked, readOnly, onRemove }: CargoLotItemProps) {
  const { label, disabledReason } = moveAffordance(lot, side, cargo, linked)

  function handleMove() {
    if (side === 'mech') report(cargo.stow(lot.id))
    else report(cargo.load(lot.id))
  }

  const moveDisabled = disabledReason !== null

  if (side === 'crawler') {
    const tag =
      lot.kind === 'bulk'
        ? { label: '×', value: lot.qty ?? lot.units }
        : lot.tl !== undefined
          ? { label: 'TL', value: lot.tl }
          : { label: 'U', value: lot.units }

    return (
      <li style={TILE}>
        <div style={TILE_HEAD}>
          <Badge shape="stamp" size="mini" style={TILE_NAME}>
            {lot.name}
          </Badge>
          <Stat orientation="horizontal" label={tag.label} value={tag.value} />
        </div>
        {!readOnly && (
          <div style={TILE_ACTIONS}>
            <Button
              variant="default"
              disabled={moveDisabled}
              title={disabledReason ?? undefined}
              aria-label={`Load ${lot.name}`}
              onClick={handleMove}
              className="su-sheet-crawler-move"
              style={TILE_BUTTON}
            >
              {label}
            </Button>
            {onRemove && (
              <Button
                variant="default"
                aria-label={`Unstow ${lot.name}`}
                title={`Unstow "${lot.name}" from the Storage Bay`}
                onClick={onRemove}
                className="su-sheet-crawler-remove"
                style={TILE_BUTTON}
              >
                Unstow
              </Button>
            )}
          </div>
        )}
      </li>
    )
  }

  return (
    <li style={{ ...CHIT, boxShadow: `inset 3px 0 0 -1px ${SIDE_TINT[side]}` }}>
      {/* Marker cell: BULK ×N bronze stripes / UNIT ink diamond */}
      <span style={lot.kind === 'bulk' ? MARKER : MARKER_UNIT}>
        {lot.kind === 'bulk' && <HazardStripes />}
        {lot.kind === 'bulk' ? (
          <span style={MARKER_QTY}>&times;{lot.qty ?? lot.units}</span>
        ) : (
          <span aria-hidden="true" style={MARKER_GLYPH}>
            &#9670;
          </span>
        )}
        <span style={MARKER_KIND}>{lot.kind === 'bulk' ? 'Bulk' : 'Unit'}</span>
      </span>

      {/* Name + category/code */}
      <span style={NAME_CELL}>
        <span style={CHIT_NAME}>{lot.name}</span>
        <span style={CHIT_META}>
          {lot.cat}
          {lot.tl !== undefined ? ` T${lot.tl}` : ''} &middot; {lot.code}
        </span>
      </span>

      {/* Units cost cell — the workshop step off paper (not a border)
          separates it from the name cell and, in turn, sets the move button
          off on its other edge. */}
      <span style={UNITS_CELL}>
        <span style={UNITS_VALUE}>{lot.units}</span>
        <span style={UNITS_SUFFIX}>U</span>
      </span>

      {/* Actions: Stow → (offload to the crawler's Storage Bay — disabled with a
          reason when unlinked) and Unload (drop from the hold, always available). */}
      {!readOnly && (
        <Button
          variant="ghost"
          disabled={moveDisabled}
          title={disabledReason ?? undefined}
          aria-label={`${side === 'mech' ? 'Stow' : 'Load'} ${lot.name}`}
          onClick={handleMove}
          className="su-sheet-crawler-move"
          style={CHIT_BUTTON}
        >
          {label}
        </Button>
      )}
      {!readOnly && onRemove && (
        <Button
          variant="ghost"
          aria-label={`Unload ${lot.name}`}
          title={`Unload "${lot.name}" from the mech hold`}
          onClick={onRemove}
          className="su-sheet-crawler-remove"
          style={CHIT_UNLOAD}
        >
          Unload
        </Button>
      )}
    </li>
  )
}

/** Clamp a typed tech level to the 1–6 scrap range. */
function coerceTl(raw: string): number {
  const n = Math.trunc(Number(raw))
  if (!Number.isFinite(n)) return 1
  return Math.min(6, Math.max(1, n))
}

/**
 * HoldAdder — a container's own intake form, added straight into that
 * container. Needs NO counterpart on the other side of the boundary (the mech
 * hold works with no crawler; the Storage Bay works with no docked mech). A
 * Kind toggle picks what is entered:
 *   - `Cargo` (default) — a free-text SEALED unit lot (name + slot cost) via
 *     `makeUnitLot`, the original behaviour.
 *   - `Scrap` — an arbitrary bulk SCRAP lot at a chosen tech level (1–6) via
 *     `makeScrapLot`, so a crawler (or mech) can stow scrap by hand. This is
 *     the physical-cargo path; the crawler's abstract scrap POOL is edited
 *     separately by `ScrapPoolAdder`.
 * The verb is the side's intake word — 'Load' into the mech hold, 'Stow' into
 * the crawler Storage Bay.
 */
function HoldAdder({
  onAdd,
  verb,
  containerLabel,
}: {
  onAdd: (lot: CargoLot) => void
  verb: string
  containerLabel: string
}) {
  const slotsId = useId()
  const tlId = useId()
  const [kind, setKind] = useState<'cargo' | 'scrap'>('cargo')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(1)
  const [tl, setTl] = useState(1)

  const canCommit = kind === 'scrap' ? amount > 0 : name.trim().length > 0

  function commit() {
    if (!canCommit) return
    if (kind === 'scrap') {
      onAdd(makeScrapLot(tl, amount))
    } else {
      onAdd(makeUnitLot(name.trim(), { units: coerceSlots(String(amount)) }))
    }
    setName('')
    setAmount(1)
  }

  return (
    <div style={ADDER}>
      {/* Kind toggle — Cargo (named lot) vs Scrap (TL bulk lot). */}
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset+legend carries min-content sizing quirks in this inline add-row; role="group" + aria-label conveys the same semantics (matches FilterRow/Stat) */}
      <div style={KIND_TOGGLE} role="group" aria-label="Cargo kind">
        {(['cargo', 'scrap'] as const).map((k) => (
          <Badge
            key={k}
            as="button"
            surface={kind === k ? 'solid' : 'ghost'}
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
          >
            {k === 'cargo' ? 'Cargo' : 'Scrap'}
          </Badge>
        ))}
      </div>

      {kind === 'cargo' ? (
        <Input
          type="text"
          value={name}
          aria-label="New cargo name"
          placeholder="Cargo name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
          }}
          style={NAME_INPUT}
        />
      ) : (
        <label htmlFor={tlId} style={ADDER_LABEL}>
          Tech
          <Input
            id={tlId}
            type="number"
            numeric
            min={1}
            max={6}
            step={1}
            value={tl}
            aria-label="Scrap tech level"
            onChange={(e) => setTl(coerceTl(e.target.value))}
            style={NUMBER_INPUT}
          />
        </label>
      )}

      <label htmlFor={slotsId} style={ADDER_LABEL}>
        {kind === 'scrap' ? 'Qty' : 'Slots'}
        <Input
          id={slotsId}
          type="number"
          numeric
          min={0}
          step={1}
          value={amount}
          aria-label={kind === 'scrap' ? 'Scrap quantity' : 'New cargo slot cost'}
          // `CargoLotSchema.units` is `.int()`, and a `type="number"` field still
          // accepts a typed "1.5". Without truncating here the lot fails its Zod
          // parse on commit — and since the form clears itself immediately, the
          // cargo would just vanish. Coerce at the edge instead.
          onChange={(e) => setAmount(coerceSlots(e.target.value))}
          style={NUMBER_INPUT}
        />
      </label>
      <Button
        size="compact"
        disabled={!canCommit}
        aria-label={`${verb} ${kind} into the ${containerLabel}`}
        onClick={commit}
      >
        {verb}
      </Button>
    </div>
  )
}

export function StorageManifest({
  side,
  cargo,
  mechName,
  crawlerName,
  readOnly = false,
  className,
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
        showCounterpart && 'su-sheet-crawler-manifest--split',
        className
      )}
      style={MANIFEST}
      data-storage-side={side}
    >
      {/* Hold panel */}
      <Card
        headerBgColor="var(--color-ink)"
        headerContent={
          <>
            <span style={HOLD_TITLE}>{side === 'mech' ? 'Mech Hold' : 'Crawler Hold'}</span>
            <BandTitle variant="mute" fill={false}>
              {side === 'mech' ? mechName : crawlerName}
            </BandTitle>
          </>
        }
        cardStyle={{ style: HOLD_CARD }}
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
                scale="sheet"
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
      </Card>

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
                ? 'No crawler linked — stow is disabled until a home crawler is wired.'
                : 'No mech docked — load is disabled until a mech is wired.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
