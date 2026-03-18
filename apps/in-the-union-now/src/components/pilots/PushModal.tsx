import { useState, useCallback } from 'react'
import { ModalShell, Text } from 'suref-react'
import { Button } from '../ui/button'
import { useUpdateMech } from '../../hooks/useMechs'
import { changeLogApi } from '../../lib/api/changeLogApi'
import { computePush } from '../../lib/pushUtils'
import { HeatCheckModal } from './HeatCheckModal'
import type { EntityRefRow, MechRow, PilotRow } from '../../types/common'

type PushModalPhase = 'idle' | 'applying'

type PushModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mech: MechRow
  pilot: PilotRow
  mechRefs: EntityRefRow[]
  userId: string
}

/**
 * PushModal — presents the Push action flow.
 *
 * Push: spend 2 Heat to reroll any d20. Heat is applied via the existing
 * mech mutation pipeline. If the resulting heat triggers a heat check,
 * HeatCheckModal is chained immediately after.
 *
 * Phase flow: idle → applying → (dismiss | chain into HeatCheckModal)
 */
export function PushModal({ open, onOpenChange, mech, pilot, mechRefs, userId }: PushModalProps) {
  const [phase, setPhase] = useState<PushModalPhase>('idle')
  const [heatCheckOpen, setHeatCheckOpen] = useState(false)
  const [heatCheckCurrentHeat, setHeatCheckCurrentHeat] = useState(0)

  const updateMech = useUpdateMech()
  const isPending = updateMech.isPending

  const { newHeat, heatCheckTriggered } = computePush(mech.current_heat, mech.heat_capacity)

  const handleDismiss = useCallback(() => {
    setPhase('idle')
    onOpenChange(false)
  }, [onOpenChange])

  const handleConfirm = useCallback(() => {
    setPhase('applying')

    updateMech.mutate(
      { mechId: mech.id, input: { current_heat: newHeat } },
      {
        onSuccess: () => {
          // Fire-and-forget change log entry (matches useActivateAction pattern)
          changeLogApi
            .log(userId, {
              targetId: mech.id,
              targetType: 'mech',
              action: 'update',
              field: 'current_heat',
              oldValue: mech.current_heat,
              newValue: newHeat,
              description: `Push: Heat ${mech.current_heat} → ${newHeat}`,
              reversible: true,
            })
            .catch(() => {})

          if (heatCheckTriggered) {
            setHeatCheckCurrentHeat(newHeat)
            handleDismiss()
            setHeatCheckOpen(true)
          } else {
            handleDismiss()
          }
        },
        onError: () => {
          // Reset to idle on failure so the user can retry
          setPhase('idle')
        },
      }
    )
  }, [updateMech, mech.id, mech.current_heat, newHeat, heatCheckTriggered, userId, handleDismiss])

  return (
    <>
      <ModalShell
        open={open}
        onOpenChange={handleDismiss}
        title="Push"
        description="Spend 2 Heat to reroll any d20."
        headerBg="bg-su-rust"
        maxWidth="max-w-sm"
        align="center"
      >
        <div className="space-y-4 p-4">
          {phase === 'idle' && (
            <>
              <div className="rounded border border-su-black/20 bg-su-black/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Text as="span" className="text-sm text-su-black/70">
                    Heat cost
                  </Text>
                  <Text as="span" className="text-sm font-mono font-semibold text-su-rust">
                    +2
                  </Text>
                </div>
                <div className="flex items-center justify-between">
                  <Text as="span" className="text-sm text-su-black/70">
                    Current Heat
                  </Text>
                  <Text as="span" className="text-sm font-mono font-semibold text-su-black">
                    {mech.current_heat} / {mech.heat_capacity}
                  </Text>
                </div>
                <div className="flex items-center justify-between border-t border-su-black/10 pt-2">
                  <Text as="span" className="text-sm text-su-black/70">
                    Heat after Push
                  </Text>
                  <Text
                    as="span"
                    className={`text-sm font-mono font-semibold ${heatCheckTriggered ? 'text-su-rust' : 'text-su-black'}`}
                  >
                    {newHeat} / {mech.heat_capacity}
                  </Text>
                </div>
                {heatCheckTriggered && (
                  <Text as="p" className="text-xs text-su-rust/80 pt-1">
                    Warning: this will trigger a Reactor Overload heat check.
                  </Text>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleDismiss}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleConfirm}
                  disabled={isPending}
                >
                  Confirm Push
                </Button>
              </div>
            </>
          )}

          {phase === 'applying' && (
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" disabled>
                Applying…
              </Button>
            </div>
          )}
        </div>
      </ModalShell>

      {heatCheckOpen && (
        <HeatCheckModal
          open={heatCheckOpen}
          onOpenChange={setHeatCheckOpen}
          currentHeat={heatCheckCurrentHeat}
          mech={mech}
          pilot={pilot}
          mechRefs={mechRefs}
          userId={userId}
        />
      )}
    </>
  )
}
