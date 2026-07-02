/**
 * SalvageControl — the Area Salvage + Mech Salvage rollers on the crawler
 * sheet (design-review R-3; Core Book pp. 244–248).
 *
 * ADR-007 automation boundary, following the HeatCheckControl pattern:
 * deterministic bookkeeping auto-applies — found Scrap deposits straight into
 * the crawler's TL pool buckets, and the 20-band wreck chassis lands in the
 * hold as a Damaged lot. WHICH System/Module comes off a wreck (or what a
 * Jackpot! find actually is) is the table's narrative call: the roll opens a
 * claim the player walks down via a picker, or skips to handle by hand.
 *
 * Supply (p.245): each area has a Supply (default 5); every roll costs 1.
 * Supply and the area's TL are Mediator-set, so both are hand-editable here
 * (honor system) — attempts used are displayed, never enforced beyond the
 * counter. 'New area' resets the tracker.
 *
 * Pure roll/claim logic lives in lib/rules/salvage.ts (injectable d20).
 */

import { useId, useMemo, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Btn, MiniBtn, StepBtn } from 'suref-react'

import { addToScrapPool } from '../../lib/cargo/cargoTransfer'
import { parseCrawlerTechLevel } from '../../lib/crawlerLevel'
import type { Roll } from '../../lib/rules/heatCheck'
import { defaultRoll } from '../../lib/rules/heatCheck'
import {
  AREA_SALVAGE_DEFAULT_SUPPLY,
  areaJackpotClaim,
  claimAllows,
  claimExhausted,
  damagedSalvageLot,
  performAreaSalvage,
  performMechSalvage,
  takeFromClaim,
} from '../../lib/rules/salvage'
import type {
  AreaSalvageResult,
  MechSalvageResult,
  SalvageClaim,
  SalvageTakeKind,
  WreckChassis,
} from '../../lib/rules/salvage'
import type { CargoLot } from '../../lib/schemas/cargoLot'
import type { Crawler } from '../../lib/schemas/crawler'
import { useEntityStore } from '../../stores/entityStore'
import { cn } from '../../lib/utils'

const TECH_LEVELS = [1, 2, 3, 4, 5, 6] as const

const SELECT_CLASS =
  'w-full rounded-[3px] border-chrome border-ink bg-paper px-2 py-1.5 font-body text-sm text-ink focus:outline-none focus:ring-[3px] focus:ring-rust/[0.22]'

/** Minimal shape read off the reference models for picker options. */
type RefItem = {
  id: string
  name: string
  techLevel?: unknown
  salvageValue?: unknown
}

type ClaimOption = {
  key: string
  kind: SalvageTakeKind
  name: string
  techLevel?: number
  salvageValue: number
}

/** Read a reference model defensively — empty when data isn't preloaded (tests). */
function loadRef(all: () => ReadonlyArray<unknown>): RefItem[] {
  try {
    return (all() as ReadonlyArray<RefItem>).slice()
  } catch {
    return []
  }
}

function numericTl(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 6
    ? value
    : undefined
}

/** Build sorted claim options of one kind, optionally restricted to a TL. */
function toOptions(kind: SalvageTakeKind, items: RefItem[], tl?: number): ClaimOption[] {
  return items
    .map((item) => ({
      key: `${kind}:${item.id}`,
      kind,
      name: item.name,
      techLevel: numericTl(item.techLevel),
      salvageValue: typeof item.salvageValue === 'number' ? item.salvageValue : 1,
    }))
    .filter((option) => tl === undefined || option.techLevel === tl)
    .sort((a, b) => (a.techLevel ?? 0) - (b.techLevel ?? 0) || a.name.localeCompare(b.name))
}

function optionLabel(option: ClaimOption): string {
  const tl = option.techLevel !== undefined ? `T${option.techLevel} · ` : ''
  return `${tl}${option.name} (SV ${option.salvageValue})`
}

const KIND_GROUP: Record<SalvageTakeKind, string> = {
  chassis: 'Chassis',
  system: 'Systems',
  module: 'Modules',
}

type ClaimPickerProps = {
  claim: SalvageClaim
  prompt: string
  /** Options grouped per kind; kinds the claim disallows are omitted. */
  options: Record<SalvageTakeKind, ClaimOption[]>
  /** The known wreck chassis (mech salvage) — takeable directly. */
  wreck?: WreckChassis | null
  onTakeWreckChassis?: () => void
  onTake: (option: ClaimOption) => void
  onSkip: () => void
}

/**
 * ClaimPicker — the player-choice walk-down for an open salvage claim.
 * Renders an advisory (HeatCheckControl style), a grouped item picker, and a
 * Skip escape hatch (the honor-system path: handle it by hand instead).
 */
function ClaimPicker({
  claim,
  prompt,
  options,
  wreck = null,
  onTakeWreckChassis,
  onTake,
  onSkip,
}: ClaimPickerProps) {
  const selectId = useId()
  const [selectedKey, setSelectedKey] = useState('')

  const kinds = (['chassis', 'system', 'module'] as const).filter((kind) =>
    claimAllows(claim, kind)
  )
  const pickableKinds = kinds.filter((kind) => !(kind === 'chassis' && wreck !== null))
  const selected = pickableKinds
    .flatMap((kind) => options[kind])
    .find((option) => option.key === selectedKey)

  return (
    <div
      role="alert"
      className="mt-2 flex flex-col gap-2 rounded-[3px] border-chrome border-status-warn bg-paper px-3 py-2"
    >
      <p className="m-0 font-body text-sm text-rust">{prompt}</p>

      {wreck !== null && claimAllows(claim, 'chassis') && onTakeWreckChassis && (
        <Btn size="sm" variant="primary" onClick={onTakeWreckChassis}>
          Take {wreck.name} chassis (Damaged)
        </Btn>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={selectId} className="sr-only">
          Salvaged item
        </label>
        <select
          id={selectId}
          value={selectedKey}
          onChange={(e) => setSelectedKey(e.target.value)}
          className={cn(SELECT_CLASS, 'min-w-0 flex-1')}
        >
          <option value="">Pick an item…</option>
          {pickableKinds.map((kind) =>
            options[kind].length > 0 ? (
              <optgroup key={kind} label={KIND_GROUP[kind]}>
                {options[kind].map((option) => (
                  <option key={option.key} value={option.key}>
                    {optionLabel(option)}
                  </option>
                ))}
              </optgroup>
            ) : null
          )}
        </select>
        <Btn
          size="sm"
          variant="primary"
          disabled={selected === undefined}
          title={selected === undefined ? 'Pick an item first.' : undefined}
          onClick={() => {
            if (!selected) return
            onTake(selected)
            setSelectedKey('')
          }}
        >
          Add to hold
        </Btn>
        <MiniBtn onClick={onSkip} title="Close the claim and handle it by hand instead.">
          Skip
        </MiniBtn>
      </div>
    </div>
  )
}

function describeAreaResult(result: AreaSalvageResult): string {
  const head = `Area Salvage: rolled ${result.roll} — ${result.label}.`
  if (result.band === 'nothing') return `${head} You find nothing in this area.`
  if (result.band === 'jackpot')
    return `${head} You find a Mech Chassis, System, or Module at Tech ${result.areaTl}, Damaged.`
  return `${head} Deposited ${result.scrapQty} Tech ${result.areaTl} Scrap into the pool.`
}

function describeMechResult(result: MechSalvageResult, wreck: WreckChassis): string {
  const head = `Mech Salvage (${wreck.name}): rolled ${result.roll} — ${result.label}.`
  switch (result.band) {
    case 'unsalvageable':
      return `${head} The wreck is a total loss — Chassis, Systems, and Modules are all destroyed.`
    case 'scrap':
      return `${head} Deposited ${result.scrapQty} Tech ${result.scrapTl} Scrap (half the chassis Salvage Value) into the pool.`
    case 'system-or-module':
      return `${head} Claim one System or Module of your choice, Damaged — everything else is destroyed.`
    case 'chassis-or-item':
      return `${head} Claim the Chassis OR one System or Module, Damaged — everything else is destroyed.`
    case 'full-strip':
      return `${head} Chassis (Damaged) added to the hold — claim one System and one Module, Damaged.`
  }
}

type SalvageControlProps = {
  crawler: Crawler
  /** Injectable store — defaults to useEntityStore. */
  store?: typeof useEntityStore
  /** Injectable d20 roller — defaults to a randsum-backed roll. */
  roll?: Roll
}

export function SalvageControl({
  crawler,
  store = useEntityStore,
  roll = defaultRoll,
}: SalvageControlProps) {
  const storeState = store()
  const areaTlId = useId()
  const wreckSelectId = useId()

  // Reference option pools (loaded once per mount; reference data is static).
  const chassisItems = useMemo(() => loadRef(() => SalvageUnionReference.Chassis.all()), [])
  const systemItems = useMemo(() => loadRef(() => SalvageUnionReference.Systems.all()), [])
  const moduleItems = useMemo(() => loadRef(() => SalvageUnionReference.Modules.all()), [])

  // --- Area Salvage state -------------------------------------------------
  const [areaTl, setAreaTl] = useState(() => parseCrawlerTechLevel(crawler.techLevel) ?? 1)
  const [supply, setSupply] = useState(AREA_SALVAGE_DEFAULT_SUPPLY)
  const [attemptsUsed, setAttemptsUsed] = useState(0)
  const [lastArea, setLastArea] = useState<AreaSalvageResult | null>(null)
  const [areaClaim, setAreaClaim] = useState<SalvageClaim | null>(null)

  // --- Mech Salvage state -------------------------------------------------
  const [wreckId, setWreckId] = useState('')
  const [lastMech, setLastMech] = useState<{
    result: MechSalvageResult
    wreck: WreckChassis
  } | null>(null)
  const [mechClaim, setMechClaim] = useState<SalvageClaim | null>(null)

  const wreckItem = chassisItems.find((c) => c.id === wreckId)
  const wreck: WreckChassis | null = wreckItem
    ? {
        name: wreckItem.name,
        techLevel: numericTl(wreckItem.techLevel) ?? 1,
        salvageValue: typeof wreckItem.salvageValue === 'number' ? wreckItem.salvageValue : 1,
      }
    : null

  // --- Deposits (auto-applied bookkeeping, ADR-007) -----------------------

  /** Deposit scrap into the crawler's TL pool bucket (freshest record wins). */
  async function depositScrap(tl: number, qty: number) {
    const fresh = storeState.get('crawler', crawler.id) ?? crawler
    await storeState.update('crawler', crawler.id, {
      scrapPool: addToScrapPool(fresh.scrapPool ?? {}, tl, qty),
    })
  }

  /** Prepend a lot to the crawler hold (unlimited — no cap check). */
  async function depositLot(lot: CargoLot) {
    const fresh = storeState.get('crawler', crawler.id) ?? crawler
    await storeState.update('crawler', crawler.id, {
      cargoLots: [lot, ...(fresh.cargoLots ?? [])],
    })
  }

  // --- Area Salvage actions ------------------------------------------------

  function handleAreaRoll() {
    if (supply <= 0) return
    const result = performAreaSalvage({ areaTl, roll })
    setLastArea(result)
    setAttemptsUsed((n) => n + 1)
    setSupply((s) => Math.max(0, s - 1))
    if (result.scrapQty > 0) void depositScrap(result.areaTl, result.scrapQty)
    setAreaClaim(result.requiresPlayerChoice ? areaJackpotClaim() : null)
  }

  function resetArea() {
    setSupply(AREA_SALVAGE_DEFAULT_SUPPLY)
    setAttemptsUsed(0)
    setLastArea(null)
    setAreaClaim(null)
  }

  function takeAreaOption(option: ClaimOption) {
    void depositLot(damagedSalvageLot(option))
    setAreaClaim((claim) => {
      if (!claim) return null
      const next = takeFromClaim(claim, option.kind)
      return claimExhausted(next) ? null : next
    })
  }

  // --- Mech Salvage actions ------------------------------------------------

  function handleMechRoll() {
    if (!wreck) return
    const result = performMechSalvage({ chassis: wreck, roll })
    setLastMech({ result, wreck })
    if (result.scrapQty > 0) void depositScrap(result.scrapTl, result.scrapQty)
    if (result.chassisGranted) void depositLot(damagedSalvageLot(wreck))
    setMechClaim(result.requiresPlayerChoice ? result.claim : null)
  }

  function takeMechOption(option: ClaimOption) {
    void depositLot(damagedSalvageLot(option))
    setMechClaim((claim) => {
      if (!claim) return null
      const next = takeFromClaim(claim, option.kind)
      return claimExhausted(next) ? null : next
    })
  }

  function takeMechWreckChassis() {
    if (!lastMech) return
    void depositLot(damagedSalvageLot(lastMech.wreck))
    setMechClaim((claim) => {
      if (!claim) return null
      const next = takeFromClaim(claim, 'chassis')
      return claimExhausted(next) ? null : next
    })
  }

  // Claim options: an area jackpot is restricted to the area's TL; wreck
  // Systems/Modules are unrestricted (mounted hardware can be any TL).
  const areaOptions: Record<SalvageTakeKind, ClaimOption[]> = useMemo(
    () => ({
      chassis: toOptions('chassis', chassisItems, lastArea?.areaTl),
      system: toOptions('system', systemItems, lastArea?.areaTl),
      module: toOptions('module', moduleItems, lastArea?.areaTl),
    }),
    [chassisItems, systemItems, moduleItems, lastArea?.areaTl]
  )
  const mechOptions: Record<SalvageTakeKind, ClaimOption[]> = useMemo(
    () => ({
      chassis: [],
      system: toOptions('system', systemItems),
      module: toOptions('module', moduleItems),
    }),
    [systemItems, moduleItems]
  )

  const supplyExhausted = supply <= 0

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {/* --- Area Salvage --------------------------------------------------- */}
      <div className="overflow-hidden rounded-[3px] border-2 border-ink bg-paper">
        <div className="flex items-center justify-between gap-2 bg-ink px-3 py-1.5">
          <span className="font-cond text-xs font-bold uppercase tracking-wider text-su-white">
            Area Salvage
          </span>
          <span className="font-cond text-xs uppercase text-su-white/60">1 Supply per roll</span>
        </div>
        <div className="flex flex-col gap-2.5 px-3 py-2.5">
          {/* Area TL — Mediator-set */}
          <div className="flex flex-wrap items-center gap-2">
            <span id={areaTlId} className="font-cond text-xs font-bold uppercase text-ink">
              Area Tech Level
            </span>
            <div
              role="group"
              aria-labelledby={areaTlId}
              className="inline-flex items-stretch overflow-hidden rounded-[2px] border-chrome border-ink bg-paper"
            >
              {TECH_LEVELS.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`Set area tech level ${n}`}
                  aria-pressed={n === areaTl}
                  onClick={() => setAreaTl(n)}
                  className={cn(
                    'min-w-8 px-2 py-1 font-cond text-sm font-bold leading-none',
                    n === areaTl ? 'bg-ink text-su-white' : 'text-ink hover:bg-su-paper'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Supply tracker — hand-editable (honor system, p.245) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-cond text-xs font-bold uppercase text-ink">Supply</span>
            <StepBtn
              aria-label="Decrease supply"
              disabled={supply <= 0}
              onClick={() => setSupply((s) => Math.max(0, s - 1))}
            >
              &ndash;
            </StepBtn>
            <span
              className="min-w-6 text-center font-body text-sm font-bold text-ink"
              aria-label={`Supply remaining: ${supply}`}
            >
              {supply}
            </span>
            <StepBtn aria-label="Increase supply" onClick={() => setSupply((s) => s + 1)}>
              +
            </StepBtn>
            <span className="font-body text-xs text-wk-muted">
              {attemptsUsed} {attemptsUsed === 1 ? 'attempt' : 'attempts'} used
            </span>
            <MiniBtn onClick={resetArea} title="Reset Supply and attempts for a new area.">
              New area
            </MiniBtn>
          </div>

          <div>
            <Btn
              size="sm"
              variant="primary"
              disabled={supplyExhausted}
              title={
                supplyExhausted
                  ? 'Supply exhausted — this area is picked clean (step Supply up if the Mediator allows).'
                  : `Roll the die: Scrap or a Damaged find at Tech ${areaTl}.`
              }
              onClick={handleAreaRoll}
            >
              Roll Area Salvage
            </Btn>
          </div>

          <div className="min-h-6">
            {lastArea && (
              <p role="status" className="m-0 font-body text-sm text-ink" data-band={lastArea.band}>
                {describeAreaResult(lastArea)}
              </p>
            )}
            {areaClaim && lastArea && (
              <ClaimPicker
                key={`area-${attemptsUsed}`}
                claim={areaClaim}
                prompt={`Jackpot! Pick the Tech ${lastArea.areaTl} Chassis, System, or Module you found — it lands in the hold, Damaged.`}
                options={areaOptions}
                onTake={takeAreaOption}
                onSkip={() => setAreaClaim(null)}
              />
            )}
          </div>
        </div>
      </div>

      {/* --- Mech Salvage --------------------------------------------------- */}
      <div className="overflow-hidden rounded-[3px] border-2 border-ink bg-paper">
        <div className="flex items-center justify-between gap-2 bg-ink px-3 py-1.5">
          <span className="font-cond text-xs font-bold uppercase tracking-wider text-su-white">
            Mech Salvage
          </span>
          <span className="font-cond text-xs uppercase text-su-white/60">pick over a wreck</span>
        </div>
        <div className="flex flex-col gap-2.5 px-3 py-2.5">
          <div className="flex flex-col gap-1">
            <label
              htmlFor={wreckSelectId}
              className="font-cond text-xs font-bold uppercase text-ink"
            >
              Wreck chassis
            </label>
            <select
              id={wreckSelectId}
              value={wreckId}
              onChange={(e) => setWreckId(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Pick the wreck&rsquo;s chassis…</option>
              {toOptions('chassis', chassisItems).map((option) => (
                <option key={option.key} value={option.key.replace('chassis:', '')}>
                  {optionLabel(option)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Btn
              size="sm"
              variant="primary"
              disabled={wreck === null}
              title={
                wreck === null
                  ? "Pick the wreck's chassis first."
                  : 'Roll the die: what survives on this wreck?'
              }
              onClick={handleMechRoll}
            >
              Roll Mech Salvage
            </Btn>
          </div>

          <div className="min-h-6">
            {lastMech && (
              <p
                role="status"
                className="m-0 font-body text-sm text-ink"
                data-band={lastMech.result.band}
              >
                {describeMechResult(lastMech.result, lastMech.wreck)}
              </p>
            )}
            {mechClaim && lastMech && (
              <ClaimPicker
                key={`mech-${lastMech.result.roll}-${lastMech.wreck.name}`}
                claim={mechClaim}
                prompt={
                  mechClaim.systemPicks > 0 || mechClaim.modulePicks > 0
                    ? 'Claim one System and one Module off the wreck — they land in the hold, Damaged.'
                    : mechClaim.chassis
                      ? 'Claim the Chassis OR one System/Module off the wreck — it lands in the hold, Damaged.'
                      : 'Claim one System or Module off the wreck — it lands in the hold, Damaged.'
                }
                options={mechOptions}
                wreck={lastMech.wreck}
                onTakeWreckChassis={takeMechWreckChassis}
                onTake={takeMechOption}
                onSkip={() => setMechClaim(null)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
