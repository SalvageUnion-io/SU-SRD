/**
 * MechItemMini — ONE installed system/module as the entity display language's
 * TOKEN (R35: a sheet's Systems, Modules and Related units are Minis that
 * Peek, not cards that expand). Hover, focus or a long
 * press Peeks the whole card; a damaged or destroyed item's pill greys.
 *
 * Its controls sit ON the Mini's line (`SheetItemLine`, which a pilot's
 * equipment shares): the condition, Uses, Repair (Damaged only: shows the
 * half-SV scrap cost and opens a MODAL confirm offering an OPTIONAL crawler
 * scrap-pool deduction; the no-deduction path is always available —
 * advisory, never blocks, but never a silent free flip either), Details where
 * the item asks a choice (`MechItemDetails`, saved as `Mech.itemChoices`) and
 * Remove.
 *
 * An unresolvable slug falls back to a plain chit (raw slug + status badge)
 * so unknown data never crashes the sheet.
 */

import type { ScrapPool } from 'game-domain/schemas/crawler'
import type { ItemCondition } from 'game-domain/schemas/itemCondition'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { DialogActions } from '../../components/app'
import { Button, Entity, ModalShell, tokens } from '../../components/index'
import { poolShortfall } from '../../lib/rules/crawlerEconomy'
import type { MechItem } from '../../lib/rules/mechItems'
import { itemEconomy, itemUsesRemaining, repairScrapCost } from '../../lib/rules/mechItems'
import { buildSheetCopy } from '../../messages/build-sheet'
import { choicesOf } from '../wizard/pickColumns'
import type { MechItemChoices } from './MechItemDetails'
import { MechItemDetails } from './MechItemDetails'
import { ConditionStep, SheetRemoveButton, UsesStep } from './rowControls'
import { SheetItemLine } from './SheetItemLine'
import { UnknownItemLine } from './UnknownItemLine'

/** The small body size and its own line-height. */
const BODY_SM = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.body,
  lineHeight: 'calc(1.25 / 0.875)',
} satisfies CSSProperties

const CONFIRM = {
  backgroundColor: tokens.color.paper,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  padding: tokens.space[20],
} satisfies CSSProperties

type MechItemMiniProps = {
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
  /**
   * Where the item's chosen options are saved (`Mech.itemChoices`). With it, an
   * editable item that asks a choice offers Details, where they are chosen.
   */
  choices?: MechItemChoices
}

export function MechItemMini({
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
  choices,
}: MechItemMiniProps) {
  if (!entity) {
    // Unresolvable slug: plain chit, never a crash. The status badge still
    // cycles so conditions stay editable for unknown items.
    return (
      <UnknownItemLine
        slug={slug}
        schemaName="systems"
        condition={condition}
        readOnly={readOnly}
        onConditionCycle={onStatusCycle}
        onRemove={onRemove}
      />
    )
  }

  const { maxUses } = itemEconomy(entity)
  // Its options are chosen on its Page, in Edit.
  const asksAChoice = !readOnly && choicesOf(entity).length > 0
  const remaining = itemUsesRemaining(maxUses, usesRemaining)

  return (
    <SheetItemLine
      token={
        <Entity
          size="mini"
          context="loadout"
          entity={entity}
          instance={{ condition, ...(choices?.seed ? { selections: choices.seed } : {}) }}
          mode={{ kind: 'link' }}
          body={{}}
        />
      }
      name={entity.name}
      condition={condition}
      readOnly={readOnly}
      onConditionCycle={onStatusCycle}
      uses={maxUses > 0 ? { remaining, max: maxUses, onChange: onUsesChange } : undefined}
      actions={
        <>
          {condition === 'damaged' && (
            <RepairControl
              entity={entity}
              scrapPool={scrapPool}
              scrapPoolLocked={scrapPoolLocked}
              onRepair={onRepair}
            />
          )}
          {asksAChoice && choices && <MechItemDetails slug={slug} entity={entity} {...choices} />}
        </>
      }
      onRemove={onRemove}
    />
  )
}

type RepairControlProps = Pick<MechItemMiniProps, 'scrapPool' | 'scrapPoolLocked' | 'onRepair'> & {
  entity: MechItem
}

/**
 * A Damaged item's Repair: its half-SV scrap cost on a button that opens a
 * modal confirm offering an optional crawler scrap-pool deduction; the
 * no-deduction path is always there (advisory, never a silent free flip).
 */
function RepairControl({
  entity,
  scrapPool,
  scrapPoolLocked = null,
  onRepair,
}: RepairControlProps) {
  const [confirmingRepair, setConfirmingRepair] = useState(false)
  const cost = repairScrapCost(entity.salvageValue)
  // techLevel can be 'B'/'N' (Bio/Nano) — only numeric TLs map to pool buckets.
  const itemTl = typeof entity.techLevel === 'number' ? entity.techLevel : undefined
  // Scrap of the item's Tech Level or higher pays; a short pool is advisory.
  const payFromTl = Math.max(1, itemTl ?? 1)
  const canPay = scrapPool !== null && scrapPoolLocked === null
  const short = scrapPool && canPay ? poolShortfall(scrapPool, payFromTl, cost) : 0

  const deductDisabledReason = canPay
    ? null
    : scrapPool && scrapPoolLocked !== null
      ? scrapPoolLocked
      : buildSheetCopy('noCrawlerNoPool')

  // Repair confirm — a modal (design: no inline confirm cluster / footer).
  const repairModal = confirmingRepair ? (
    <ModalShell
      open={confirmingRepair}
      onOpenChange={(next) => {
        if (!next) setConfirmingRepair(false)
      }}
      title={buildSheetCopy('repair2', { name: entity.name })}
      width="narrow"
    >
      <div style={CONFIRM}>
        <p style={{ ...BODY_SM, margin: 0 }}>
          {buildSheetCopy('repairingCostsScrapTechOr', { cost, max: payFromTl })}
        </p>
        {short > 0 && (
          <p style={{ ...BODY_SM, margin: 0 }}>{buildSheetCopy('repairPoolShort', { short })}</p>
        )}
        <DialogActions>
          <Button
            size="compact"
            variant="primary"
            disabled={!canPay}
            title={deductDisabledReason ?? undefined}
            aria-label={buildSheetCopy('repairAndDeductScrap', { name: entity.name })}
            onClick={() => {
              onRepair(payFromTl, cost)
              setConfirmingRepair(false)
            }}
          >
            {buildSheetCopy('deductFromTheTechPool', {
              cost,
              value: payFromTl,
            })}
          </Button>
          <Button
            size="compact"
            aria-label={buildSheetCopy('repairWithoutDeductingScrap', { name: entity.name })}
            onClick={() => {
              onRepair(null, cost)
              setConfirmingRepair(false)
            }}
          >
            {buildSheetCopy('repairWithoutDeducting')}
          </Button>
          <Button size="compact" variant="ghost" onClick={() => setConfirmingRepair(false)}>
            {buildSheetCopy('cancel')}
          </Button>
        </DialogActions>
      </div>
    </ModalShell>
  ) : null

  return (
    <>
      <Button
        size="mini"
        variant="primary"
        className="su-sheet-item__repair"
        aria-label={buildSheetCopy('repair2', { name: entity.name })}
        onClick={() => setConfirmingRepair(true)}
      >
        {buildSheetCopy('repairScrap', { cost })}
      </Button>
      {repairModal}
    </>
  )
}

type MechItemControlsProps = Omit<MechItemMiniProps, 'readOnly' | 'entity'> & {
  entity: MechItem | null
}

/**
 * An installed item's Edit controls on its Ledger row (C8): its condition,
 * Uses, Repair while Damaged, Details where it asks a choice, and Remove.
 */
export function MechItemControls({
  slug,
  entity,
  condition,
  usesRemaining,
  scrapPool,
  scrapPoolLocked = null,
  onStatusCycle,
  onUsesChange,
  onRepair,
  onRemove,
  choices,
}: MechItemControlsProps) {
  const name = entity?.name ?? slug
  const maxUses = entity ? itemEconomy(entity).maxUses : 0
  return (
    <>
      <ConditionStep name={name} condition={condition} onCycle={onStatusCycle} />
      {entity && maxUses > 0 && (
        <UsesStep
          name={name}
          remaining={itemUsesRemaining(maxUses, usesRemaining)}
          max={maxUses}
          onChange={onUsesChange}
        />
      )}
      {entity && condition === 'damaged' && (
        <RepairControl
          entity={entity}
          scrapPool={scrapPool}
          scrapPoolLocked={scrapPoolLocked}
          onRepair={onRepair}
        />
      )}
      {entity && choices && choicesOf(entity).length > 0 && (
        <MechItemDetails slug={slug} entity={entity} {...choices} />
      )}
      {onRemove && <SheetRemoveButton name={name} onRemove={onRemove} />}
    </>
  )
}
