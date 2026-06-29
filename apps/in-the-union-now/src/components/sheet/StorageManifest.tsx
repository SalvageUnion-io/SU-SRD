/**
 * StorageManifest — The Hold cargo panel (design §2.12, plan 4.5/4.7).
 *
 * One component, two sides of the mech ⇄ crawler boundary:
 *   - side='mech' (mech sheet): capacity strip (used/cap + cargo pips,
 *     over-capacity rendered honestly as red pips — never clamped), cargo
 *     chits with 'Stow →' (whole-lot, SCRAP deposits the crawler's TL pool
 *     bucket), counterpart = the crawler's unlimited Storage Bay.
 *   - side='crawler' (crawler sheet): '∞ unlimited' strip, chits with
 *     '← Load' (cap-checked; bulk partial-fill shows a dynamic 'Load N'
 *     label), counterpart = the docked mech's capacity.
 *
 * All transfer semantics live in the useCargo reducer — this component only
 * renders its state and dispatches. Unlinked boundary = disabled move
 * buttons with a title reason (design pattern 8). readOnly removes the move
 * buttons entirely.
 */

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
      className="flex items-stretch overflow-hidden rounded-[2px] border-[1.5px] border-ink bg-paper"
      style={{ boxShadow: `inset 3px 0 0 -1px ${SIDE_TINT[side]}` }}
    >
      {/* Marker cell: BULK ×N bronze stripes / UNIT ink diamond */}
      <span
        className="flex w-[42px] shrink-0 flex-col items-center justify-center gap-0.5 py-1.5 text-su-white"
        style={
          lot.kind === 'bulk'
            ? {
                background:
                  'repeating-linear-gradient(135deg, var(--color-cargo) 0 5px, var(--color-cargo-deep) 5px 10px)',
              }
            : { background: 'var(--color-ink)' }
        }
      >
        {lot.kind === 'bulk' ? (
          <span className="font-body text-[15px] font-bold leading-none">
            &times;{lot.qty ?? lot.units}
          </span>
        ) : (
          <span aria-hidden="true" className="text-[13px] leading-none">
            &#9670;
          </span>
        )}
        <span className="font-cond text-[7px] font-semibold uppercase tracking-[0.08em]">
          {lot.kind === 'bulk' ? 'Bulk' : 'Unit'}
        </span>
      </span>

      {/* Name + category/code */}
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-2.5 py-1.5">
        <span className="truncate font-cond text-sm font-bold uppercase leading-none text-ink">
          {lot.name}
        </span>
        <span className="font-body text-[10px] uppercase tracking-[0.04em] text-wk-muted">
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
        <span className="font-body text-[15px] font-bold leading-none text-ink">{lot.units}</span>
        <span className="font-cond text-[8px] uppercase text-wk-muted">U</span>
      </span>

      {/* Move button */}
      {!readOnly && (
        <button
          type="button"
          disabled={disabledReason !== null}
          title={disabledReason ?? undefined}
          aria-label={`${side === 'mech' ? 'Stow' : 'Load'} ${lot.name}`}
          onClick={handleMove}
          className="shrink-0 cursor-pointer px-2.5 font-cond text-[10px] font-bold uppercase tracking-[0.04em] text-ink transition-colors duration-[120ms] hover:bg-[var(--color-cargo-pale)] disabled:cursor-not-allowed disabled:opacity-40"
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
      <div className="overflow-hidden rounded-[3px] border-[2.5px] border-ink bg-paper shadow-[0_2px_8px_-3px_rgba(40,32,25,0.4)]">
        <div className="flex items-center gap-2 bg-ink px-3 py-1.5">
          <span className="font-cond text-[11px] font-bold uppercase tracking-[0.12em] text-su-white">
            {side === 'mech' ? 'Mech Hold' : 'Crawler Hold'}
          </span>
          <span className="min-w-0 truncate font-cond text-[11px] uppercase tracking-[0.12em] text-su-white/60">
            {side === 'mech' ? mechName : crawlerName}
          </span>
        </div>

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
              <span className="font-cond text-[10px] font-bold uppercase tracking-[0.08em] text-ink opacity-70">
                Units
              </span>
              <span
                className="flex flex-wrap gap-1"
                role="img"
                aria-label={`Hold ${used} of ${cap} slots used${over ? ' — over capacity' : ''}`}
              >
                {Array.from({ length: Math.max(cap, used) }, (_, i) => (
                  <span
                    key={i}
                    data-cpip={i < used ? (i >= cap ? 'over' : 'on') : 'off'}
                    className="h-[13px] w-[13px] rounded-[2px] border-[1.5px] border-ink"
                    style={{
                      background:
                        i < used
                          ? i >= cap
                            ? 'var(--color-status-bad)'
                            : 'var(--color-cargo)'
                          : 'transparent',
                    }}
                  />
                ))}
              </span>
              {free > 0 && (
                <span className="font-cond text-[10px] font-bold uppercase text-ink opacity-70">
                  {free} free
                </span>
              )}
              {over && (
                <span className="font-cond text-[10px] font-bold uppercase text-status-bad">
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
              <span className="font-cond text-[10px] font-bold uppercase tracking-[0.08em] text-ink opacity-70">
                Unlimited
              </span>
              <span className="font-body text-xs text-ink">
                {totalLotUnits(lots)} units stowed &middot; {lots.length}{' '}
                {lots.length === 1 ? 'lot' : 'lots'}
              </span>
            </>
          )}
        </div>

        {/* Lot list */}
        {lots.length === 0 ? (
          <p className="m-0 px-3 py-4 text-center font-body text-xs text-wk-muted">Hold empty.</p>
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
      </div>

      {/* Counterpart panel */}
      <div
        className={cn(
          'flex flex-col gap-2 rounded-[3px] border-2 p-3',
          linkedCounterpart !== null ? 'border-ink' : 'border-dashed border-wk-faint'
        )}
        style={{ background: 'var(--ground-2)' }}
      >
        <span
          className="font-cond text-[10.5px] font-bold uppercase tracking-[0.08em]"
          style={{ color: 'var(--tone-deep, var(--color-ink))' }}
        >
          {side === 'mech' ? 'Stow target →' : '← Load target'}
        </span>
        {linkedCounterpart !== null ? (
          <>
            <span className="self-start bg-ink px-2 py-0.5 font-cond text-[17px] font-bold uppercase leading-tight text-su-white">
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
          <p className="m-0 font-body text-[11.5px] leading-snug text-wk-muted">
            {side === 'mech'
              ? 'No crawler linked — stow is disabled until a home crawler is wired.'
              : 'No mech docked — load is disabled until a mech is wired.'}
          </p>
        )}
      </div>
    </div>
  )
}
