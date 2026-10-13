/**
 * CargoLotItem — one lot in The Hold (`StorageManifest`), on either side of the
 * mech ⇄ crawler boundary, with the cap-checked move affordance both layouts
 * share.
 */

import { Badge, Button, Stat, tokens } from 'component-lib'
import type { CargoLot } from 'itun-domain/schemas/cargoLot'
import type { CSSProperties } from 'react'
import { loadableQty } from '../../lib/cargo/cargoTransfer'
import { reportCargo as report } from '../../lib/cargo/reportCargo'
import type { UseCargoResult } from '../../lib/cargo/useCargo'
import { HazardStripes } from './cargoBackdrops'

export type StorageManifestSide = 'mech' | 'crawler'

const SIDE_TINT: Record<StorageManifestSide, string> = {
  mech: 'var(--color-mech)',
  crawler: 'var(--color-crawler)',
}

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
export function CargoLotItem({ lot, side, cargo, linked, readOnly, onRemove }: CargoLotItemProps) {
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
