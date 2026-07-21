/**
 * StorageManifest — The Hold panel (design §2.12, plan 4.5/4.7).
 *
 * One component, two sides of the mech ⇄ crawler boundary:
 *   - side='mech' (mech sheet): capacity strip (used/cap + the canonical
 *     SlotGrid cells, over-capacity rendered honestly as red cells — never
 *     clamped), cargo
 *     chits (linear list, `CargoChit`) with 'Stow →' (whole-lot, SCRAP
 *     deposits the crawler's TL pool bucket), counterpart = the crawler's
 *     unlimited Storage Bay.
 *   - side='crawler' (crawler sheet): '∞ unlimited' strip, a dense poster
 *     `.storegrid` of magenta `.slot` tiles (`CargoTile`, graph-paper
 *     `.storebody` backdrop) with '← Load' (cap-checked; bulk partial-fill
 *     shows a dynamic 'Load N' label), counterpart = the docked mech's
 *     capacity. The tile-grid presentation is crawler-only — the mech Hold
 *     keeps its linear list unchanged.
 *
 * All transfer semantics live in the useCargo reducer — this component only
 * renders its state and dispatches. Unlinked boundary = disabled move
 * buttons with a title reason (design pattern 8). readOnly removes the move
 * buttons entirely.
 */

import { useId } from 'react'
import { Card, SlotGrid, Stat } from 'component-lib'

import type { UseCargoResult } from '../../lib/cargo/useCargo'
import type { CargoLot } from '../../lib/schemas/cargoLot'
import { totalLotUnits } from '../../lib/schemas/cargoLot'
import { cn } from '../../lib/utils'

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

/**
 * Diagonal cargo hazard stripes for the BULK marker cell — the poster's
 * repeating-gradient fill rebuilt as an SVG pattern. Flat repeating patterns
 * are SVG, never gradient fills (ruleset §3.5 — no gradients, anywhere).
 */
function HazardStripes() {
  const id = useId()
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
      <defs>
        <pattern
          id={id}
          width="10"
          height="10"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="10" height="10" className="fill-cargo" />
          <rect x="5" width="5" height="10" className="fill-cargo-deep" />
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
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
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

type CargoChitProps = {
  lot: CargoLot
  side: StorageManifestSide
  cargo: UseCargoResult
  /** Whether the receiving side of the boundary is linked. */
  linked: boolean
  readOnly: boolean
}

function CargoChit({ lot, side, cargo, linked, readOnly }: CargoChitProps) {
  let label = 'Stow →'
  let disabledReason: string | null = linked
    ? null
    : side === 'mech'
      ? 'No crawler linked — nothing to stow to.'
      : 'No mech docked — nothing to load onto.'

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

  function handleMove() {
    if (side === 'mech') void cargo.stow(lot.id)
    else void cargo.load(lot.id)
  }

  return (
    <li
      className="flex items-stretch overflow-hidden rounded-[2px] border-chrome border-ink bg-paper"
      style={{ boxShadow: `inset 3px 0 0 -1px ${SIDE_TINT[side]}` }}
    >
      {/* Marker cell: BULK ×N bronze stripes / UNIT ink diamond */}
      <span
        className={cn(
          'relative flex w-[42px] shrink-0 flex-col items-center justify-center gap-0.5 overflow-hidden py-1.5 text-paper',
          lot.kind !== 'bulk' && 'bg-ink'
        )}
      >
        {lot.kind === 'bulk' && <HazardStripes />}
        {lot.kind === 'bulk' ? (
          <span className="relative font-body text-lede font-bold leading-none">
            &times;{lot.qty ?? lot.units}
          </span>
        ) : (
          <span aria-hidden="true" className="relative text-caption leading-none">
            &#9670;
          </span>
        )}
        <span className="relative font-cond text-nano font-semibold uppercase tracking-caps">
          {lot.kind === 'bulk' ? 'Bulk' : 'Unit'}
        </span>
      </span>

      {/* Name + category/code */}
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-2.5 py-1.5">
        <span className="truncate font-cond text-sm font-bold uppercase leading-none text-ink">
          {lot.name}
        </span>
        <span className="font-body text-label uppercase tracking-caps-tight text-wk-muted">
          {lot.cat}
          {lot.tl !== undefined ? ` T${lot.tl}` : ''} &middot; {lot.code}
        </span>
      </span>

      {/* Units cost cell — tinted ground (not a border) separates it from the
          name cell and, in turn, sets the move button off on its other edge. */}
      <span
        className="flex w-9 shrink-0 flex-col items-center justify-center py-1"
        style={{ background: 'var(--ground-2)' }}
      >
        <span className="font-body text-lede font-bold leading-none text-ink">{lot.units}</span>
        <span className="font-cond text-nano uppercase text-wk-muted">U</span>
      </span>

      {/* Move button */}
      {!readOnly && (
        <button
          type="button"
          disabled={disabledReason !== null}
          title={disabledReason ?? undefined}
          aria-label={`${side === 'mech' ? 'Stow' : 'Load'} ${lot.name}`}
          onClick={handleMove}
          className="shrink-0 cursor-pointer px-2.5 font-cond text-label font-bold uppercase tracking-caps-tight text-ink transition-colors duration-[120ms] hover:bg-[var(--color-cargo-pale)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {label}
        </button>
      )}
    </li>
  )
}

type CargoTileProps = {
  lot: CargoLot
  cargo: UseCargoResult
  /** Whether a mech is docked (the crawler Hold's Load target). */
  linked: boolean
  readOnly: boolean
}

/**
 * CargoTile — the crawler Hold's poster `.slot`: a magenta `--tone` tile
 * stamping the item name over an `MChip` qty/TL tag, with the '← Load'
 * transfer button (same cap-checked affordance as `CargoChit`'s crawler
 * branch, reimplemented here since the mech-side chit keeps its own linear
 * layout untouched).
 */
function CargoTile({ lot, cargo, linked, readOnly }: CargoTileProps) {
  let label = '← Load'
  let disabledReason: string | null = linked ? null : 'No mech docked — nothing to load onto.'

  if (disabledReason === null) {
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

  const tag =
    lot.kind === 'bulk'
      ? { label: '×', value: lot.qty ?? lot.units }
      : lot.tl !== undefined
        ? { label: 'TL', value: lot.tl }
        : { label: 'U', value: lot.units }

  return (
    <li
      className="flex min-h-[64px] flex-col gap-1.5 rounded-[3px] border-2 p-2"
      style={{ borderColor: 'var(--tone)', background: 'var(--tone)' }}
    >
      <div className="flex flex-wrap items-start justify-between gap-1.5">
        <span className="box-decoration-clone min-w-0 flex-1 break-words bg-ink px-1.5 py-0.5 font-cond text-[11px] font-bold uppercase leading-[1.4] text-paper">
          {lot.name}
        </span>
        <Stat orientation="horizontal" label={tag.label} value={tag.value} className="shrink-0" />
      </div>
      {!readOnly && (
        <button
          type="button"
          disabled={disabledReason !== null}
          title={disabledReason ?? undefined}
          aria-label={`Load ${lot.name}`}
          onClick={() => void cargo.load(lot.id)}
          className="mt-auto self-end rounded-[2px] bg-paper px-2 py-0.5 font-cond text-[10px] font-bold uppercase tracking-caps-tight text-ink transition-colors duration-[120ms] hover:bg-[var(--color-cargo-pale)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {label}
        </button>
      )}
    </li>
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
  const lots = side === 'mech' ? cargo.state.mechLots : cargo.state.crawlerLots
  const { used, cap, free, over } = cargo.usage
  const linkedCounterpart = side === 'mech' ? crawlerName : mechName

  return (
    <div
      className={cn('grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_250px]', className)}
      data-storage-side={side}
    >
      {/* Hold panel */}
      <Card
        headerBg="bg-ink"
        headerContent={
          <>
            <span className="m-0 font-cond text-xs font-bold uppercase tracking-caps text-paper">
              {side === 'mech' ? 'Mech Hold' : 'Crawler Hold'}
            </span>
            <span className="min-w-0 truncate font-cond text-xs uppercase text-paper/60">
              {side === 'mech' ? mechName : crawlerName}
            </span>
          </>
        }
        cardStyle={{ className: 'shadow-[0_2px_8px_-3px_var(--color-ink-50)]' }}
        bodyPadding="p-0"
      >
        {/* Capacity strip */}
        <div
          className="flex flex-wrap items-center gap-3 border-b-2 border-ink px-3 py-2"
          style={{ background: 'var(--ground-2)' }}
        >
          {side === 'mech' ? (
            <>
              <span className="font-body text-2xl font-bold leading-none text-ink">
                {used}/{cap}
              </span>
              <span className="font-cond text-label font-bold uppercase tracking-caps text-ink opacity-70">
                Units
              </span>
              {/* The canonical addressable-slot cells (ruleset §5 atom 10):
                  dashed = empty, cargo = filled, status-bad = over-capacity —
                  never clamped. */}
              <SlotGrid
                used={used}
                cap={cap}
                scale="sheet"
                label={`Hold ${used} of ${cap} slots used${over ? ' — over capacity' : ''}`}
              />
              {free > 0 && (
                <span className="font-cond text-label font-bold uppercase text-ink opacity-70">
                  {free} free
                </span>
              )}
              {over && (
                <span className="font-cond text-label font-bold uppercase text-status-bad">
                  Over capacity
                </span>
              )}
            </>
          ) : (
            <>
              <span
                className="font-body text-3xl font-bold leading-none"
                style={{ color: 'var(--color-cargo-deep)' }}
              >
                &infin;
              </span>
              <span className="font-cond text-label font-bold uppercase tracking-caps text-ink opacity-70">
                Unlimited
              </span>
              <span className="font-body text-xs text-ink">
                {totalLotUnits(lots)} units stowed &middot; {lots.length}{' '}
                {lots.length === 1 ? 'lot' : 'lots'}
              </span>
            </>
          )}
        </div>

        {/* Lot list — the mech Hold keeps the linear CargoChit list; the
            crawler Hold renders the poster's dense `.storegrid` of magenta
            `.slot` tiles on a graph-paper `.storebody` backdrop. */}
        {lots.length === 0 ? (
          <p className="m-0 px-3 py-4 text-center font-body text-xs text-wk-muted">Hold empty.</p>
        ) : side === 'crawler' ? (
          <div className="relative bg-paper p-3">
            <GraphPaper />
            <ul className="relative m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5 p-0">
              {lots.map((lot) => (
                <CargoTile
                  key={lot.id}
                  lot={lot}
                  cargo={cargo}
                  linked={linkedCounterpart !== null}
                  readOnly={readOnly}
                />
              ))}
            </ul>
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-[7px] p-[11px]">
            {lots.map((lot) => (
              <CargoChit
                key={lot.id}
                lot={lot}
                side={side}
                cargo={cargo}
                linked={linkedCounterpart !== null}
                readOnly={readOnly}
              />
            ))}
          </ul>
        )}
      </Card>

      {/* Counterpart panel */}
      <div
        className={cn(
          'flex flex-col gap-2 rounded-[3px] border-2 p-3',
          linkedCounterpart !== null ? 'border-ink' : 'border-dashed border-wk-faint'
        )}
        style={{ background: 'var(--ground-2)' }}
      >
        <span
          className="font-cond text-label-lg font-bold uppercase tracking-caps"
          style={{ color: 'var(--tone-deep, var(--color-ink))' }}
        >
          {side === 'mech' ? 'Stow target →' : '← Load target'}
        </span>
        {linkedCounterpart !== null ? (
          <>
            <span className="self-start bg-ink px-2 py-0.5 font-cond text-base font-bold uppercase leading-tight text-paper">
              {linkedCounterpart}
            </span>
            {side === 'mech' ? (
              <span className="font-body text-xs text-ink">
                &infin; Storage Bay &middot; unlimited
              </span>
            ) : (
              <span className="font-body text-xs text-ink">
                {used}/{cap} slots &middot; {free} free
              </span>
            )}
          </>
        ) : (
          <p className="m-0 font-body text-note leading-snug text-wk-muted">
            {side === 'mech'
              ? 'No crawler linked — stow is disabled until a home crawler is wired.'
              : 'No mech docked — load is disabled until a mech is wired.'}
          </p>
        )}
      </div>
    </div>
  )
}
