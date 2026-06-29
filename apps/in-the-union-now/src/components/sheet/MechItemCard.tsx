/**
 * MechItemCard — ONE installed system/module as an Erow'd full entity card
 * (design §4.3, plan 4.5).
 *
 * Action economy lives in the card foot (Erow mode 'card' semantics — the
 * footActions/footMeta props are native to ReferenceEntityDisplay):
 *   - Use: spends the primary action's EP cost / adds its Hot heat /
 *     decrements the uses counter. DISABLED while Damaged/Destroyed —
 *     "wire the disabled state, not just the pill" (§4.3).
 *   - Repair (Damaged only, promoted to primary): shows the half-SV scrap
 *     cost and offers an OPTIONAL crawler scrap-pool deduction. The
 *     no-deduction path is always available — advisory, never blocks (S12),
 *     but never a silent free flip either: the cost is on the button.
 *   - Uses stepper: manual ± counter for systems AND modules (rules B13).
 *
 * The status badge cycles Intact → Damaged → Destroyed by hand (manual
 * edits stay possible alongside the automation). An unresolvable slug falls
 * back to a plain chit (raw slug + status badge) so unknown data never
 * crashes the sheet.
 *
 * readOnly suppresses every affordance: no foot actions, no status cycle.
 */

import { useState } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { Btn, ReferenceEntityDisplay, StatusBadge, StepBtn } from 'suref-react'
import type { CardFootMeta } from 'suref-react'

import type { ScrapPool } from '../../lib/schemas/crawler'
import type { ItemCondition } from '../../lib/schemas/mech'
import { itemEconomy, repairPoolTl, repairScrapCost } from './mechItemRules'
import type { MechItem, MechItemEconomy } from './mechItemRules'

/** Stable hide literal — keeps ReferenceEntityDisplay's memo effective. */
const HIDE_CHOICES = { choices: true } as const

type MechItemCardProps = {
  /** System/module slug as stored on the mech. */
  slug: string
  /** Resolved reference entity, or null when the slug does not resolve. */
  entity: MechItem | null
  condition: ItemCondition
  /** Uses remaining (mech.itemUses). Absent = full. */
  usesRemaining?: number
  /** Current EP — gates the Use button honestly. */
  currentEP: number
  /** Linked crawler's scrap pool; null when no crawler is wired. */
  scrapPool: ScrapPool | null
  readOnly: boolean
  /** Cycle this item's condition (Intact → Damaged → Destroyed). */
  onStatusCycle: () => void
  /** Spend one activation (EP / heat / a use). */
  onUse: (economy: MechItemEconomy) => void
  /** Set the uses counter (already clamped 0..max by the card). */
  onUsesChange: (next: number) => void
  /** Repair to Intact; deductTl = pool bucket to decrement, null = none. */
  onRepair: (deductTl: number | null, cost: number) => void
}

export function MechItemCard({
  slug,
  entity,
  condition,
  usesRemaining,
  currentEP,
  scrapPool,
  readOnly,
  onStatusCycle,
  onUse,
  onUsesChange,
  onRepair,
}: MechItemCardProps) {
  const [confirmingRepair, setConfirmingRepair] = useState(false)

  if (!entity) {
    // Unresolvable slug: plain chit, never a crash. The status badge still
    // cycles so conditions stay editable for unknown items.
    return (
      <div className="flex h-full items-center justify-between gap-2 rounded-[3px] border-[1.5px] border-ink bg-paper px-3 py-2">
        <span className="font-body text-sm text-ink">{slug}</span>
        <StatusBadge status={condition} onClick={readOnly ? undefined : onStatusCycle} />
      </div>
    )
  }

  const economy = itemEconomy(entity)
  const { epCost, heat, maxUses } = economy
  const remaining = maxUses > 0 ? Math.min(usesRemaining ?? maxUses, maxUses) : 0
  const cost = repairScrapCost(entity.salvageValue)
  // techLevel can be 'B'/'N' (Bio/Nano) — only numeric TLs map to pool buckets.
  const itemTl = typeof entity.techLevel === 'number' ? entity.techLevel : undefined
  const deductTl = scrapPool ? repairPoolTl(scrapPool, itemTl, cost) : null

  const useDisabledReason =
    condition === 'destroyed'
      ? 'Destroyed — cannot be used'
      : condition === 'damaged'
        ? 'Damaged — repair before use'
        : maxUses > 0 && remaining <= 0
          ? 'No uses remaining'
          : epCost > currentEP
            ? `Not enough EP (needs ${epCost})`
            : null
  const showUse = epCost > 0 || heat > 0 || maxUses > 0

  const footMeta: CardFootMeta[] = [
    ...(epCost > 0 ? [{ label: 'EP Cost', value: epCost }] : []),
    ...(heat > 0 ? [{ label: 'Heat', value: `+${heat}` }] : []),
    { label: 'Slots', value: entity.slotsRequired },
  ]

  const deductDisabledReason =
    deductTl !== null
      ? null
      : scrapPool
        ? `Not enough TL ${itemTl ?? 1}+ scrap in the crawler pool`
        : 'No crawler linked — no pool to deduct from'

  const footActions = readOnly ? undefined : (
    <>
      {showUse && (
        <Btn
          size="sm"
          variant={condition === 'intact' ? 'primary' : 'default'}
          disabled={useDisabledReason !== null}
          title={useDisabledReason ?? undefined}
          aria-label={`Use ${entity.name}`}
          onClick={() => onUse(economy)}
        >
          Use
        </Btn>
      )}
      {maxUses > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <StepBtn
            aria-label={`Decrease ${entity.name} uses`}
            disabled={remaining <= 0}
            onClick={() => onUsesChange(remaining - 1)}
          >
            &ndash;
          </StepBtn>
          <span className="min-w-[4.5rem] text-center font-cond text-[11px] font-bold uppercase leading-none tabular-nums text-ink">
            Uses {remaining}/{maxUses}
          </span>
          <StepBtn
            aria-label={`Increase ${entity.name} uses`}
            disabled={remaining >= maxUses}
            onClick={() => onUsesChange(remaining + 1)}
          >
            +
          </StepBtn>
        </span>
      )}
      {condition === 'damaged' && (
        // Reserve the repair affordance its own full-width foot row so toggling
        // between the single Repair button and the 3-button confirm cluster
        // never changes the foot's row count — keeps the equal-height Erow steady.
        <span className="flex basis-full flex-wrap items-center justify-end gap-1.5">
          {confirmingRepair ? (
            <>
              <Btn
                size="sm"
                variant="primary"
                disabled={deductTl === null}
                title={deductDisabledReason ?? undefined}
                aria-label={`Repair ${entity.name} and deduct scrap`}
                onClick={() => {
                  onRepair(deductTl, cost)
                  setConfirmingRepair(false)
                }}
              >
                Deduct {cost} from TL {deductTl ?? Math.max(1, itemTl ?? 1)} pool
              </Btn>
              <Btn
                size="sm"
                aria-label={`Repair ${entity.name} without deducting scrap`}
                onClick={() => {
                  onRepair(null, cost)
                  setConfirmingRepair(false)
                }}
              >
                Repair without deducting
              </Btn>
              <Btn size="sm" variant="ghost" onClick={() => setConfirmingRepair(false)}>
                Cancel
              </Btn>
            </>
          ) : (
            <Btn
              size="sm"
              variant="primary"
              aria-label={`Repair ${entity.name}`}
              onClick={() => setConfirmingRepair(true)}
            >
              Repair &middot; {cost} Scrap
            </Btn>
          )}
        </span>
      )}
    </>
  )

  return (
    <ReferenceEntityDisplay
      data={entity as unknown as SURefEntity}
      hide={HIDE_CHOICES}
      status={condition}
      onStatusClick={readOnly ? undefined : onStatusCycle}
      footActions={footActions}
      footMeta={footMeta}
    />
  )
}
