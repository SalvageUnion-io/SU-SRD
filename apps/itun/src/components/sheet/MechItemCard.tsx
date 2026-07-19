/**
 * MechItemCard — ONE installed system/module as an Erow'd COMPACT entity card
 * (design §4.3, plan 4.5; redesign phase 2: compact listing cards, max 2-up).
 *
 * Every affordance rides the card's controls overlay (no footer actions);
 * `footMeta` still carries the read-only EP/Heat/Slots figures:
 *   - Use: spends the primary action's EP cost / adds its Hot heat /
 *     decrements the uses counter. DISABLED while Damaged/Destroyed —
 *     "wire the disabled state, not just the pill" (§4.3).
 *   - Repair (Damaged only, danger control): shows the half-SV scrap cost and
 *     opens a MODAL confirm offering an OPTIONAL crawler scrap-pool deduction.
 *     The no-deduction path is always available — advisory, never blocks (S12),
 *     but never a silent free flip either: the cost is on the control.
 *   - Uses stepper: manual ± counter for systems AND modules (rules B13).
 *   - Remove (✕): per-card uninstall — always available on editable sheets
 *     (unified edit language archetype B, never gated behind a mode).
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
import { Button, ModalShell, ReferenceEntityCard, StatusBadge } from 'component-lib'
import type { CardFootMeta, ReferenceEntityControl } from 'component-lib'

import type { ScrapPool } from '../../lib/schemas/crawler'
import type { ItemCondition } from '../../lib/schemas/mech'
import { itemEconomy, repairPoolTl, repairScrapCost } from './mechItemRules'
import type { MechItem, MechItemEconomy } from './mechItemRules'
import { CardRemoveButton, REMOVABLE_CARD_STYLE, cardRemoveControls } from 'component-lib'

/** Stable hide literal — keeps ReferenceEntityCard's memo effective. */
const HIDE_CHOICES = { choices: true } as const

type MechItemCardProps = {
  /** System/module slug as stored on the mech. */
  slug: string
  /** Resolved reference entity, or null when the slug does not resolve. */
  entity: MechItem | null
  condition: ItemCondition
  /** Uses remaining (mech.itemUses). Absent = full. */
  usesRemaining?: number
  /** Current EP — gates the Use button honestly. Omit when Use is not offered. */
  currentEP?: number
  /** Linked crawler's scrap pool; null when no crawler is wired. */
  scrapPool: ScrapPool | null
  readOnly: boolean
  /** Cycle this item's condition (Intact → Damaged → Destroyed). */
  onStatusCycle: () => void
  /**
   * Spend one activation (EP / heat / a use). "Using a system" is a Guided-Play
   * transaction that belongs to the Dashboard (ADR-021); omit `onUse` on the
   * Free-Edit Live Sheet — the uses counter stays hand-editable via onUsesChange.
   */
  onUse?: (economy: MechItemEconomy) => void
  /** Set the uses counter (already clamped 0..max by the card). */
  onUsesChange: (next: number) => void
  /** Repair to Intact; deductTl = pool bucket to decrement, null = none. */
  onRepair: (deductTl: number | null, cost: number) => void
  /**
   * Per-card remove (✕) — uninstall this item. Always available on editable
   * sheets (unified edit language archetype B). Omit on read-only sheets.
   */
  onRemove?: () => void
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
  onRemove,
}: MechItemCardProps) {
  const [confirmingRepair, setConfirmingRepair] = useState(false)

  if (!entity) {
    // Unresolvable slug: plain chit, never a crash. The status badge still
    // cycles so conditions stay editable for unknown items.
    return (
      <div className="flex h-full items-center justify-between gap-2 rounded-[3px] border-chrome border-ink bg-paper px-3 py-2">
        <span className="font-body text-sm text-ink">{slug}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          <StatusBadge status={condition} onClick={readOnly ? undefined : onStatusCycle} />
          {!readOnly && onRemove && <CardRemoveButton name={slug} onRemove={onRemove} />}
        </span>
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
          : epCost > (currentEP ?? Number.POSITIVE_INFINITY)
            ? `Not enough EP (needs ${epCost})`
            : null
  // "Use" (the EP/heat-spending activation) is offered only when a handler is
  // wired — the Dashboard passes one; the Free-Edit Live Sheet does not (ADR-021).
  const showUse = onUse !== undefined && (epCost > 0 || heat > 0 || maxUses > 0)

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

  // All per-card interactivity rides the controls overlay (no footer actions):
  // Use, the uses stepper, and Repair (which opens a modal confirm), plus the
  // per-card remove (✕). The status toggle is added by ReferenceEntityCard.
  const controls: ReferenceEntityControl[] = readOnly
    ? []
    : [
        ...(showUse
          ? [
              {
                key: 'use',
                label: 'Use',
                ariaLabel: `Use ${entity.name}`,
                title: useDisabledReason ?? undefined,
                onClick: () => onUse?.(economy),
                variant: condition === 'intact' ? 'primary' : 'ghost',
                disabled: useDisabledReason !== null,
              } satisfies ReferenceEntityControl,
            ]
          : []),
        ...(maxUses > 0
          ? [
              {
                key: 'uses',
                stepper: {
                  count: remaining,
                  onChange: onUsesChange,
                  subject: entity.name,
                  min: 0,
                  max: maxUses,
                  label: 'Uses',
                },
              } satisfies ReferenceEntityControl,
            ]
          : []),
        ...(condition === 'damaged'
          ? [
              {
                key: 'repair',
                label: 'Repair',
                segmentText: `${cost} Scrap`,
                ariaLabel: `Repair ${entity.name}`,
                onClick: () => setConfirmingRepair(true),
                variant: 'danger',
              } satisfies ReferenceEntityControl,
            ]
          : []),
        ...(onRemove ? cardRemoveControls({ name: entity.name, onRemove }) : []),
      ]

  // Repair confirm — a modal (design: no inline confirm cluster / footer).
  const repairModal =
    condition === 'damaged' && confirmingRepair ? (
      <ModalShell
        open={confirmingRepair}
        onOpenChange={(next) => {
          if (!next) setConfirmingRepair(false)
        }}
        title={`Repair ${entity.name}`}
        maxWidth="max-w-sm"
        align="center"
      >
        <div className="flex flex-col gap-3 bg-paper p-5">
          <p className="m-0 font-body text-sm text-ink">
            Repairing costs {cost} Scrap (Tech {Math.max(1, itemTl ?? 1)} or higher) from the
            crawler pool.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
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
            </Button>
            <Button
              size="sm"
              aria-label={`Repair ${entity.name} without deducting scrap`}
              onClick={() => {
                onRepair(null, cost)
                setConfirmingRepair(false)
              }}
            >
              Repair without deducting
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmingRepair(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </ModalShell>
    ) : null

  const removable = !readOnly && onRemove !== undefined
  return (
    <>
      <ReferenceEntityCard
        data={entity as unknown as SURefEntity}
        compact
        hide={HIDE_CHOICES}
        status={condition}
        onStatusClick={readOnly ? undefined : onStatusCycle}
        footMeta={footMeta}
        controls={controls.length ? controls : undefined}
        cardStyle={removable ? REMOVABLE_CARD_STYLE : undefined}
      />
      {repairModal}
    </>
  )
}
