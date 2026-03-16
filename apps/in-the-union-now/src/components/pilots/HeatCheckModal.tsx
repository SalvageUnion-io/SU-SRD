import { useState, useMemo, useCallback } from 'react'
import { ModalShell, Text } from 'suref-react'
import { Button } from '../ui/button'
import { SalvageUnionReference, resultForTable } from 'salvageunion-reference'
import { useApplyDamage } from '../../hooks/useApplyDamage'
import { TargetPicker } from './TargetPicker'
import type { EntityRefRow, MechRow, PilotRow } from '../../types/common'

/** Roll a d20 — returns 1-20 inclusive */
function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1
}

/**
 * Map a reactor overload roll result (1-20) to its outcome category.
 *
 * Per Salvage Union rules and the Reactor Overload Table:
 *  - 20: miraculous (reactor overdrive)
 *  - 11–19: core damage (auto-apply SP = current heat)
 *  - 6–10: module destroyed (target picker)
 *  - 2–5: system destroyed (target picker)
 *  - 1: catastrophic meltdown (player handles manually)
 */
type ReactorOverloadCategory = 'miraculous' | 'core-damage' | 'destructive' | 'catastrophic'

function getOverloadCategory(roll: number): ReactorOverloadCategory {
  if (roll === 20) return 'miraculous'
  if (roll >= 11) return 'core-damage'
  if (roll >= 2) return 'destructive'
  return 'catastrophic'
}

type HeatCheckModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The mech's current heat value (used as SP damage amount for 11–19 result) */
  currentHeat: number
  mech: MechRow
  pilot: PilotRow
  mechRefs: EntityRefRow[]
  userId: string
}

type ModalPhase =
  | 'idle'
  | 'result-miraculous'
  | 'result-core-damage'
  | 'result-destructive'
  | 'result-catastrophic'
  | 'target-picker'

/**
 * HeatCheckModal — presents the Reactor Overload flow after a heat check is triggered.
 *
 * Flow per ADR-006 and ADR-008:
 * 1. Roll d20, look up Reactor Overload Table entry.
 * 2. Roll 20 (miraculous): show text, dismiss.
 * 3. Roll 11–19 (core damage): auto-apply SP damage equal to current heat. Show new SP.
 * 4. Roll 6–10 (module) or 2–5 (system): show text, open target picker for confirmation.
 * 5. Roll 1 (catastrophic): show text, player handles manually.
 *
 * Non-destructive outcomes (11–19) are auto-applied.
 * Destructive outcomes (6–10, 2–5) always require explicit player confirmation.
 */
export function HeatCheckModal({
  open,
  onOpenChange,
  currentHeat,
  mech,
  pilot,
  mechRefs,
  userId,
}: HeatCheckModalProps) {
  const [phase, setPhase] = useState<ModalPhase>('idle')
  const [rollValue, setRollValue] = useState<number | null>(null)
  const [tableResult, setTableResult] = useState<{ label?: string; value: string } | null>(null)
  const [newSpAfterDamage, setNewSpAfterDamage] = useState<number | null>(null)

  const { applyDamage, isPending } = useApplyDamage()

  // Resolve the Reactor Overload Table once
  const reactorOverloadTable = useMemo(
    () => SalvageUnionReference.RollTables.find((t) => t.name === 'Reactor Overload'),
    []
  )

  const handleRoll = useCallback(() => {
    const roll = rollD20()
    setRollValue(roll)

    // Look up the table entry
    const tableData = reactorOverloadTable?.table
    const result = tableData ? resultForTable(tableData, roll) : null
    setTableResult(result?.success ? result.result : null)

    const category = getOverloadCategory(roll)

    if (category === 'miraculous') {
      setPhase('result-miraculous')
    } else if (category === 'core-damage') {
      // Auto-apply SP damage equal to current heat (ADR-006, ADR-008)
      const damage = currentHeat
      const newSp = Math.max(0, mech.current_sp - damage)
      setNewSpAfterDamage(newSp)
      setPhase('result-core-damage')

      // Auto-apply via applyDamage — no pilot HP damage (hpDamage: 0), no target
      // (non-destructive per ADR-008). Pilot HP is not affected.
      applyDamage({
        mech,
        pilot,
        userId,
        spDamage: damage,
        cascade: {
          newSp,
          hpDamage: 0,
          triggersCritical: false,
        },
      })
    } else if (category === 'destructive') {
      setPhase('result-destructive')
    } else {
      setPhase('result-catastrophic')
    }
  }, [reactorOverloadTable, currentHeat, mech, pilot, userId, applyDamage])

  const handleDismiss = useCallback(() => {
    setPhase('idle')
    setRollValue(null)
    setTableResult(null)
    setNewSpAfterDamage(null)
    onOpenChange(false)
  }, [onOpenChange])

  const handleProceedToTargetPicker = useCallback(() => {
    setPhase('target-picker')
  }, [])

  const handleTargetConfirm = useCallback(
    (targetRef: EntityRefRow) => {
      // Apply condition change to the selected target via applyDamage's condition path.
      // SP damage = 0 (reactor overload doesn't add more SP damage, just destroys the target).
      applyDamage({
        mech,
        pilot,
        userId,
        spDamage: 0,
        cascade: {
          newSp: mech.current_sp,
          hpDamage: 0,
          triggersCritical: true,
        },
        targetRef,
        onSuccess: handleDismiss,
      })
    },
    [mech, pilot, userId, applyDamage, handleDismiss]
  )

  const handleTargetCancel = useCallback(() => {
    setPhase('result-destructive')
  }, [])

  const rollCategoryLabel =
    rollValue !== null ? (
      <span
        className="font-mono font-semibold text-su-rust"
        aria-live="assertive"
        aria-atomic="true"
      >
        {rollValue}
      </span>
    ) : null

  return (
    <ModalShell
      open={open}
      onOpenChange={handleDismiss}
      title="Heat Check — Reactor Overload"
      description="Your mech has gained heat. Roll for a Reactor Overload."
      headerBg="bg-su-rust"
      maxWidth="max-w-sm"
      align="center"
    >
      <div className="space-y-4 p-4">
        {phase === 'idle' && (
          <>
            <Text as="p" className="text-sm text-su-black/80">
              Heat gained — roll d20 vs. current heat ({currentHeat}). Rolling at or below heat
              triggers Reactor Overload.
            </Text>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleRoll}
                disabled={isPending}
              >
                Roll d20
              </Button>
            </div>
          </>
        )}

        {phase === 'result-miraculous' && (
          <>
            <div
              className="rounded border border-su-black/20 bg-su-black/5 p-3 space-y-2"
              aria-live="assertive"
              aria-atomic="true"
            >
              <Text as="p" className="text-xs font-semibold uppercase text-su-black/60">
                Roll: {rollCategoryLabel} — Reactor Overdrive!
              </Text>
              {tableResult && (
                <>
                  {tableResult.label && (
                    <Text as="p" className="text-sm font-semibold text-su-black">
                      {tableResult.label}
                    </Text>
                  )}
                  <Text as="p" className="text-sm text-su-black/80">
                    {tableResult.value}
                  </Text>
                </>
              )}
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={handleDismiss}>
                Dismiss
              </Button>
            </div>
          </>
        )}

        {phase === 'result-core-damage' && (
          <>
            <div
              className="rounded border border-su-rust/40 bg-su-rust/10 p-3 space-y-2"
              aria-live="assertive"
              aria-atomic="true"
            >
              <Text as="p" className="text-xs font-semibold uppercase text-su-rust/80">
                Roll: {rollCategoryLabel} — Reactor Overheat
              </Text>
              {tableResult && (
                <>
                  {tableResult.label && (
                    <Text as="p" className="text-sm font-semibold text-su-black">
                      {tableResult.label}
                    </Text>
                  )}
                  <Text as="p" className="text-sm text-su-black/80">
                    {tableResult.value}
                  </Text>
                </>
              )}
              {newSpAfterDamage !== null && (
                <div className="flex items-center justify-between pt-1 border-t border-su-rust/20">
                  <Text as="span" className="text-sm font-mono text-su-black/70">
                    Mech SP
                  </Text>
                  <Text as="span" className="text-sm font-mono font-semibold text-su-rust">
                    {mech.current_sp} → {newSpAfterDamage}
                  </Text>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDismiss}
                disabled={isPending}
              >
                {isPending ? 'Applying...' : 'Dismiss'}
              </Button>
            </div>
          </>
        )}

        {phase === 'result-destructive' && (
          <>
            <div
              className="rounded border border-su-rust/40 bg-su-rust/10 p-3 space-y-2"
              aria-live="assertive"
              aria-atomic="true"
            >
              <Text as="p" className="text-xs font-semibold uppercase text-su-rust/80">
                Roll: {rollCategoryLabel} —{' '}
                {rollValue !== null && rollValue >= 6 ? 'Module Overload' : 'System Overload'}
              </Text>
              {tableResult && (
                <>
                  {tableResult.label && (
                    <Text as="p" className="text-sm font-semibold text-su-black">
                      {tableResult.label}
                    </Text>
                  )}
                  <Text as="p" className="text-sm text-su-black/80">
                    {tableResult.value}
                  </Text>
                </>
              )}
            </div>
            <Text as="p" className="text-sm text-su-black/70">
              Select a target to destroy. This requires your confirmation.
            </Text>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleDismiss}>
                Dismiss
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleProceedToTargetPicker}
              >
                Select Target
              </Button>
            </div>
          </>
        )}

        {phase === 'target-picker' && (
          <TargetPicker
            mechRefs={mechRefs}
            onConfirm={handleTargetConfirm}
            onCancel={handleTargetCancel}
            isPending={isPending}
          />
        )}

        {phase === 'result-catastrophic' && (
          <>
            <div
              className="rounded border border-red-600/40 bg-red-600/10 p-3 space-y-2"
              aria-live="assertive"
              aria-atomic="true"
            >
              <Text as="p" className="text-xs font-semibold uppercase text-red-600/80">
                Roll: {rollCategoryLabel} — Catastrophic Meltdown!
              </Text>
              {tableResult && (
                <>
                  {tableResult.label && (
                    <Text as="p" className="text-sm font-semibold text-su-black">
                      {tableResult.label}
                    </Text>
                  )}
                  <Text as="p" className="text-sm text-su-black/80">
                    {tableResult.value}
                  </Text>
                </>
              )}
            </div>
            <Text as="p" className="text-sm text-su-black/70">
              Handle the consequences manually using the sheet controls.
            </Text>
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={handleDismiss}>
                Dismiss
              </Button>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  )
}
