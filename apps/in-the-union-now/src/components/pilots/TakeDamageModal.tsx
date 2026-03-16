import { useState, useMemo } from 'react'
import { ModalShell, Text } from 'suref-react'
import { Button } from '../ui/button'
import { computeDamageCascade } from '../../lib/damageUtils'
import { useApplyDamage } from '../../hooks/useApplyDamage'
import { TargetPicker } from './TargetPicker'
import type { EntityRefRow, MechRow, PilotRow } from '../../types/common'

type TakeDamageModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mech: MechRow
  pilot: PilotRow
  mechRefs: EntityRefRow[]
  userId: string
}

/**
 * TakeDamageModal — player-facing modal for the Take Damage flow.
 *
 * Shows a reactive cascade preview of SP/HP damage before the player confirms.
 * When SP reaches 0, transitions to the TargetPicker for Critical Damage.
 *
 * Behavior is per ADR-003 (player chooses target), ADR-004 (reversibility),
 * ADR-007 (sequential mutations with RPC TODO), ADR-008 (automation boundary).
 */
export function TakeDamageModal({
  open,
  onOpenChange,
  mech,
  pilot,
  mechRefs,
  userId,
}: TakeDamageModalProps) {
  const [damageInput, setDamageInput] = useState('')
  const [showTargetPicker, setShowTargetPicker] = useState(false)
  const [pendingCascade, setPendingCascade] = useState<ReturnType<
    typeof computeDamageCascade
  > | null>(null)
  const { applyDamage, isPending } = useApplyDamage()

  const isBoarded = pilot.is_boarded && !!mech

  const spDamage = parseInt(damageInput, 10)
  const hasValidInput = !isNaN(spDamage) && spDamage > 0

  const cascade = useMemo(() => {
    if (!hasValidInput) return null
    return computeDamageCascade(mech.current_sp, spDamage, isBoarded)
  }, [mech.current_sp, spDamage, isBoarded, hasValidInput])

  const handleClose = () => {
    setDamageInput('')
    setShowTargetPicker(false)
    setPendingCascade(null)
    onOpenChange(false)
  }

  const handleConfirm = () => {
    if (!cascade || !hasValidInput) return

    if (cascade.triggersCritical) {
      // Transition to target picker before applying
      setPendingCascade(cascade)
      setShowTargetPicker(true)
      return
    }

    applyDamage({
      mech,
      pilot,
      userId,
      spDamage,
      cascade,
      onSuccess: handleClose,
    })
  }

  const handleTargetConfirm = (targetRef: EntityRefRow) => {
    if (!pendingCascade) return
    applyDamage({
      mech,
      pilot,
      userId,
      spDamage,
      cascade: pendingCascade,
      targetRef,
      onSuccess: handleClose,
    })
  }

  const handleTargetCancel = () => {
    setShowTargetPicker(false)
    setPendingCascade(null)
  }

  return (
    <ModalShell
      open={open}
      onOpenChange={handleClose}
      title="Take Damage"
      description="Apply SP damage to your mech"
      headerBg="bg-su-rust"
      maxWidth="max-w-sm"
      align="center"
    >
      <div className="space-y-4 p-4">
        {showTargetPicker && pendingCascade ? (
          <TargetPicker
            mechRefs={mechRefs}
            onConfirm={handleTargetConfirm}
            onCancel={handleTargetCancel}
            isPending={isPending}
          />
        ) : (
          <>
            {/* SP damage input */}
            <div>
              <label
                htmlFor="sp-damage-input"
                className="mb-1 block font-mono text-xs font-semibold uppercase text-su-black/70"
              >
                SP Damage Amount
              </label>
              <input
                id="sp-damage-input"
                type="number"
                min="1"
                value={damageInput}
                onChange={(e) => setDamageInput(e.target.value)}
                placeholder="Enter SP damage..."
                className="w-full rounded border border-su-black/30 bg-su-white px-3 py-2 font-mono text-sm text-su-black placeholder:text-su-black/40 focus:border-su-black focus:outline-none"
              />
            </div>

            {/* Cascade preview */}
            {cascade && (
              <div
                className="rounded border border-su-black/20 bg-su-black/5 p-3 space-y-2"
                aria-live="polite"
                aria-label="Damage preview"
              >
                <Text as="p" className="text-xs font-semibold uppercase text-su-black/60">
                  Preview
                </Text>

                <div className="flex items-center justify-between text-sm">
                  <span className="font-mono text-su-black/70">Mech SP</span>
                  <span className="font-mono font-semibold text-su-black">
                    {mech.current_sp} → {cascade.newSp}
                  </span>
                </div>

                {isBoarded && cascade.hpDamage > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono text-su-black/70">Pilot HP</span>
                    <span className="font-mono font-semibold text-su-rust">
                      {pilot.hp} → {Math.max(0, (pilot.hp ?? 0) - cascade.hpDamage)}
                    </span>
                  </div>
                )}

                {cascade.triggersCritical && (
                  <div className="rounded bg-su-rust/15 px-2 py-1.5">
                    <Text as="p" className="text-xs font-semibold text-su-rust">
                      SP reaches 0 — Critical Damage Table triggered!
                    </Text>
                    <Text as="p" className="text-xs text-su-rust/80">
                      You will select a target system or module to damage.
                    </Text>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirm}
                disabled={!hasValidInput || isPending}
              >
                {isPending
                  ? 'Applying...'
                  : cascade?.triggersCritical
                    ? 'Next: Select Target'
                    : 'Apply Damage'}
              </Button>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  )
}
