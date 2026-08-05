/**
 * StorageManifest — The Hold panel (design §2.12, plan 4.5/4.7).
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
 * buttons with a title reason (design pattern 8). readOnly removes the move
 * buttons entirely.
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

import { Badge, Button, Card, Input, SlotGrid, Stat } from 'component-lib'
import { useId, useState } from 'react'
import { reportCargo as report } from '../../lib/cargo/reportCargo'
import type { UseCargoResult } from '../../lib/cargo/useCargo'
import type { CargoLot } from '../../lib/schemas/cargoLot'
import { makeScrapLot, makeUnitLot, totalLotUnits } from '../../lib/schemas/cargoLot'
import { cn } from '../../lib/utils'

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

/**
 * The cap-checked move affordance shared by both Hold layouts — the single
 * source of the button label + disabled reason that the linear mech chit and
 * the poster crawler tile previously duplicated.
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
 * boundary. Both presentations and their (formerly duplicated) cap-checked
 * move affordance now live here:
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
      <li
        className="flex min-h-[64px] flex-col gap-1.5 rounded-card border-2 p-2"
        style={{ borderColor: 'var(--tone)', background: 'var(--tone)' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-1.5">
          <Badge
            shape="stamp"
            size="mini"
            leading="leading-[1.4]"
            className="min-w-0 flex-1 break-words"
          >
            {lot.name}
          </Badge>
          <Stat orientation="horizontal" label={tag.label} value={tag.value} className="shrink-0" />
        </div>
        {!readOnly && (
          <div className="mt-auto flex flex-wrap items-center justify-end gap-1">
            <Button
              variant="default"
              disabled={moveDisabled}
              title={disabledReason ?? undefined}
              aria-label={`Load ${lot.name}`}
              onClick={handleMove}
              className="rounded-badge border-0 px-2 py-0.5 font-cond text-label font-bold uppercase tracking-caps-tight hover:bg-[var(--color-cargo-pale)]"
            >
              {label}
            </Button>
            {onRemove && (
              <Button
                variant="default"
                aria-label={`Unstow ${lot.name}`}
                title={`Unstow "${lot.name}" from the Storage Bay`}
                onClick={onRemove}
                className="rounded-badge border-0 px-2 py-0.5 font-cond text-label font-bold uppercase tracking-caps-tight text-status-bad hover:bg-status-bad hover:text-paper"
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
    <li
      className="flex items-stretch overflow-hidden rounded-badge border-chrome border-ink bg-paper"
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

      {/* Actions: Stow → (offload to the crawler's Storage Bay — disabled with a
          reason when unlinked) and Unload (drop from the hold, always available). */}
      {!readOnly && (
        <Button
          variant="ghost"
          disabled={moveDisabled}
          title={disabledReason ?? undefined}
          aria-label={`${side === 'mech' ? 'Stow' : 'Load'} ${lot.name}`}
          onClick={handleMove}
          className="shrink-0 rounded-none border-0 px-2.5 py-0 font-cond text-label font-bold uppercase tracking-caps-tight hover:bg-[var(--color-cargo-pale)]"
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
          className="shrink-0 rounded-none border-0 border-ink border-l-chrome px-2.5 py-0 font-cond text-label font-bold uppercase tracking-caps-tight text-status-bad hover:bg-status-bad hover:text-paper"
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

  const compactInput = 'px-2 py-1.5 text-xs'

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-card border-chrome border-dashed border-wk-faint p-2.5">
      {/* Kind toggle — Cargo (named lot) vs Scrap (TL bulk lot). */}
      {/* biome-ignore lint/a11y/useSemanticElements: a fieldset+legend carries min-content sizing quirks in this inline add-row; role="group" + aria-label conveys the same semantics (matches FilterRow/Stat) */}
      <div className="flex items-center gap-1" role="group" aria-label="Cargo kind">
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
          className={`${compactInput} w-36 flex-1`}
        />
      ) : (
        <label
          htmlFor={tlId}
          className="flex items-center gap-1 font-cond text-label font-bold uppercase tracking-wide text-wk-muted"
        >
          Tech
          <Input
            id={tlId}
            type="number"
            min={1}
            max={6}
            step={1}
            value={tl}
            aria-label="Scrap tech level"
            onChange={(e) => setTl(coerceTl(e.target.value))}
            className={`${compactInput} w-14`}
          />
        </label>
      )}

      <label
        htmlFor={slotsId}
        className="flex items-center gap-1 font-cond text-label font-bold uppercase tracking-wide text-wk-muted"
      >
        {kind === 'scrap' ? 'Qty' : 'Slots'}
        <Input
          id={slotsId}
          type="number"
          min={0}
          step={1}
          value={amount}
          aria-label={kind === 'scrap' ? 'Scrap quantity' : 'New cargo slot cost'}
          // `CargoLotSchema.units` is `.int()`, and a `type="number"` field still
          // accepts a typed "1.5". Without truncating here the lot fails its Zod
          // parse on commit — and since the form clears itself immediately, the
          // cargo would just vanish. Coerce at the edge instead.
          onChange={(e) => setAmount(coerceSlots(e.target.value))}
          className={`${compactInput} w-14`}
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

        {/* Lot list — the mech Hold keeps the linear CargoLotItem chit list; the
            crawler Hold renders the poster's dense `.storegrid` of magenta
            `.slot` tiles on a graph-paper `.storebody` backdrop. */}
        {lots.length === 0 ? (
          <p className="m-0 px-3 py-4 text-center font-body text-xs text-wk-muted">Hold empty.</p>
        ) : side === 'crawler' ? (
          <div className="relative bg-paper p-3">
            <GraphPaper />
            <ul className="relative m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5 p-0">
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
          <ul className="m-0 flex list-none flex-col gap-[7px] p-[11px]">
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
          <div className="px-3 pb-3">
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
      <div
        className={cn(
          'flex flex-col gap-2 rounded-card border-2 p-3',
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
            <Badge shape="stamp" size="full" className="self-start">
              {linkedCounterpart}
            </Badge>
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
