/**
 * MechItemToken — ONE installed system/module as the entity display language's
 * TOKEN (owner's call, 2026-10-14: a sheet's Systems, Modules and Assigned
 * Units are Tokens that Peek, not cards that expand). Hover, focus or a long
 * press Peeks the whole card; a damaged or destroyed item's pill greys.
 *
 * Its controls sit ON the Token's line (`SheetItemLine`, which a pilot's
 * equipment shares): the condition, Uses, Repair (Damaged only: shows the
 * half-SV scrap cost and opens a MODAL confirm offering an OPTIONAL crawler
 * scrap-pool deduction; the no-deduction path is always available —
 * advisory, never blocks, but never a silent free flip either) and Remove.
 *
 * An unresolvable slug falls back to a plain chit (raw slug + status badge)
 * so unknown data never crashes the sheet.
 */

import { Button, Entity, ModalShell, StatusBadge, tokens } from 'component-lib'
import type { ScrapPool } from 'itun-domain/schemas/crawler'
import type { ItemCondition } from 'itun-domain/schemas/itemCondition'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { MechItem } from '../../lib/rules/mechItems'
import {
  itemEconomy,
  itemUsesRemaining,
  repairPoolTl,
  repairScrapCost,
} from '../../lib/rules/mechItems'
import { SheetItemLine } from './SheetItemLine'
import { CardRemoveButton } from './SheetSection'

/** The fallback chit for a slug that does not resolve. */
const CHIT = {
  alignItems: 'center',
  backgroundColor: tokens.color.paper,
  border: `${tokens.borderWidth.chrome} solid ${tokens.color.ink}`,
  borderRadius: tokens.radius.card,
  display: 'flex',
  gap: tokens.space[8],
  height: '100%',
  justifyContent: 'space-between',
  padding: `${tokens.space[8]} ${tokens.space[12]}`,
} satisfies CSSProperties

/** The small body size and its own line-height. */
const BODY_SM = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  lineHeight: 'calc(1.25 / 0.875)',
} satisfies CSSProperties

const CHIT_END = {
  alignItems: 'center',
  display: 'flex',
  flexShrink: 0,
  gap: tokens.space[6],
} satisfies CSSProperties

const CONFIRM = {
  backgroundColor: tokens.color.paper,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  padding: tokens.space[20],
} satisfies CSSProperties

const CONFIRM_ACTIONS = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
  justifyContent: 'flex-end',
} satisfies CSSProperties

type MechItemTokenProps = {
  /** System/module slug as stored on the mech. */
  slug: string
  /** Resolved reference entity, or null when the slug does not resolve. */
  entity: MechItem | null
  condition: ItemCondition
  /** Uses remaining (mech.itemUses). Absent = full. */
  usesRemaining?: number
  /** Linked crawler's scrap pool; null when no crawler is wired. */
  scrapPool: ScrapPool | null
  /**
   * Why the viewer may not draw on `scrapPool` (the Mediator keeps a Game's
   * crawler, ADR-038 §5), or null/absent when they may. Closes only the
   * deduction; repairing without one stays open.
   */
  scrapPoolLocked?: string | null
  readOnly: boolean
  /** Cycle this item's condition (Intact → Damaged → Destroyed). */
  onStatusCycle: () => void
  /** Set the uses counter (0..max). */
  onUsesChange: (next: number) => void
  /** Repair to Intact; deductTl = pool bucket to decrement, null = none. */
  onRepair: (deductTl: number | null, cost: number) => void
  /**
   * Per-item remove (✕) — uninstall this item. Always available on editable
   * sheets (unified edit language archetype B). Omit on read-only sheets.
   */
  onRemove?: () => void
}

export function MechItemToken({
  slug,
  entity,
  condition,
  usesRemaining,
  scrapPool,
  scrapPoolLocked = null,
  readOnly,
  onStatusCycle,
  onUsesChange,
  onRepair,
  onRemove,
}: MechItemTokenProps) {
  const [confirmingRepair, setConfirmingRepair] = useState(false)

  if (!entity) {
    // Unresolvable slug: plain chit, never a crash. The status badge still
    // cycles so conditions stay editable for unknown items.
    return (
      <div style={CHIT}>
        <span style={BODY_SM}>{slug}</span>
        <span style={CHIT_END}>
          <StatusBadge status={condition} onClick={readOnly ? undefined : onStatusCycle} />
          {!readOnly && onRemove && <CardRemoveButton name={slug} onRemove={onRemove} />}
        </span>
      </div>
    )
  }

  const { maxUses } = itemEconomy(entity)
  const remaining = itemUsesRemaining(maxUses, usesRemaining)
  const cost = repairScrapCost(entity.salvageValue)
  // techLevel can be 'B'/'N' (Bio/Nano) — only numeric TLs map to pool buckets.
  const itemTl = typeof entity.techLevel === 'number' ? entity.techLevel : undefined
  const deductTl =
    scrapPool && scrapPoolLocked === null ? repairPoolTl(scrapPool, itemTl, cost) : null

  const deductDisabledReason =
    deductTl !== null
      ? null
      : scrapPool && scrapPoolLocked !== null
        ? scrapPoolLocked
        : scrapPool
          ? `Not enough TL ${itemTl ?? 1}+ scrap in the crawler pool`
          : 'No crawler assigned — no pool to deduct from'

  // Repair confirm — a modal (design: no inline confirm cluster / footer).
  const repairModal =
    condition === 'damaged' && confirmingRepair ? (
      <ModalShell
        open={confirmingRepair}
        onOpenChange={(next) => {
          if (!next) setConfirmingRepair(false)
        }}
        title={`Repair ${entity.name}`}
        maxWidth="su-sheet-mech-repair-modal"
      >
        <div style={CONFIRM}>
          <p style={{ ...BODY_SM, margin: 0 }}>
            Repairing costs {cost} Scrap (Tech {Math.max(1, itemTl ?? 1)} or higher) from the
            crawler pool.
          </p>
          <div style={CONFIRM_ACTIONS}>
            <Button
              size="compact"
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
              size="compact"
              aria-label={`Repair ${entity.name} without deducting scrap`}
              onClick={() => {
                onRepair(null, cost)
                setConfirmingRepair(false)
              }}
            >
              Repair without deducting
            </Button>
            <Button size="compact" variant="ghost" onClick={() => setConfirmingRepair(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </ModalShell>
    ) : null

  return (
    <>
      <SheetItemLine
        token={<Entity form="token" entity={entity} instance={{ condition }} />}
        name={entity.name}
        condition={condition}
        readOnly={readOnly}
        onConditionCycle={onStatusCycle}
        uses={maxUses > 0 ? { remaining, max: maxUses, onChange: onUsesChange } : undefined}
        actions={
          condition === 'damaged' && (
            <Button
              size="compact"
              variant="danger"
              className="su-sheet-item__repair"
              aria-label={`Repair ${entity.name}`}
              onClick={() => setConfirmingRepair(true)}
            >
              Repair · {cost} Scrap
            </Button>
          )
        }
        onRemove={onRemove}
      />
      {repairModal}
    </>
  )
}
