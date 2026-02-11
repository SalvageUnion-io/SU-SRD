import * as Dialog from '@radix-ui/react-dialog'
import { X, Flame, History } from 'lucide-react'
import { useDiceStore } from '../../stores/diceStore'
import { RollResult } from 'suref-react'

type DiceRollSheetProps = {
  currentHeat?: number
  heatCapacity?: number
  onHeatChange?: (newHeat: number) => void
}

export function DiceRollSheet({
  currentHeat = 0,
  heatCapacity = 0,
  onHeatChange,
}: DiceRollSheetProps) {
  const { isOpen, close, currentResult, canPush, push, results, roll } = useDiceStore()

  const handlePush = () => {
    if (!canPush) return

    const newHeat = currentHeat + 2
    push()

    // Apply +2 heat
    onHeatChange?.(Math.min(newHeat, heatCapacity))
  }

  const canPushSafely = currentHeat + 2 <= heatCapacity

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-2xl bg-[var(--background)] p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-lg font-bold">Roll Result</Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded-md p-1 hover:bg-su-grey-light/20">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {currentResult && (
            <div className="mb-6">
              <RollResult
                value={currentResult.value}
                tier={currentResult.tier}
                tierColor={currentResult.tierColor}
                context={currentResult.context}
                pushed={currentResult.pushed}
              />

              {/* Push button */}
              {canPush && (
                <div className="mt-4 text-center">
                  <button
                    onClick={handlePush}
                    className="inline-flex items-center gap-2 rounded-lg bg-heat-critical px-4 py-2 font-medium text-white transition-colors hover:opacity-90"
                  >
                    <Flame className="h-4 w-4" />
                    Push (+2 Heat)
                  </button>
                  {!canPushSafely && (
                    <p className="mt-1 text-xs text-heat-cap">
                      Warning: This will trigger a Heat Check!
                    </p>
                  )}
                </div>
              )}

              {/* Roll again */}
              <div className="mt-4 text-center">
                <button
                  onClick={() => roll(currentResult.context)}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm transition-colors hover:bg-su-grey-light/20"
                >
                  Roll Again
                </button>
              </div>
            </div>
          )}

          {/* Roll history */}
          {results.length > 1 && (
            <div className="border-t border-[var(--border)] pt-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-su-grey-dark">
                <History className="h-3 w-3" />
                History
              </div>
              <div className="space-y-1">
                {results.slice(1, 10).map((r, i) => (
                  <RollResult
                    key={i}
                    value={r.value}
                    tier={r.tier}
                    tierColor={r.tierColor}
                    pushed={r.pushed}
                    compact
                  />
                ))}
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
