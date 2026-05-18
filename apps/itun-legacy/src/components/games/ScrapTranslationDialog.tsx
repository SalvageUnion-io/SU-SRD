import { useState, useMemo, useCallback } from 'react'
import { DisplayCard, Text } from 'suref-react'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { computeScrapTranslation } from '../../lib/crawlerUtils'
import type { CrawlerRow } from '../../types/common'

type ScrapTranslationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  crawler: CrawlerRow
  onTranslate: (fromTL: number, toTL: number, sourceConsumed: number, targetAmount: number) => void
  isPending: boolean
}

const TECH_LEVELS = [1, 2, 3, 4, 5, 6] as const

function getScrapField(crawler: CrawlerRow, tl: number): number {
  return crawler[`scrap_tl${tl}` as keyof CrawlerRow] as number
}

export function ScrapTranslationDialog({
  open,
  onOpenChange,
  crawler,
  onTranslate,
  isPending,
}: ScrapTranslationDialogProps) {
  const [fromTL, setFromTL] = useState(1)
  const [toTL, setToTL] = useState(2)
  const [amount, setAmount] = useState(1)

  const available = getScrapField(crawler, fromTL)

  const result = useMemo(
    () => computeScrapTranslation(fromTL, toTL, amount),
    [fromTL, toTL, amount]
  )

  const handleFromChange = useCallback(
    (tl: number) => {
      setFromTL(tl)
      if (tl === toTL) {
        setToTL(tl === 1 ? 2 : 1)
      }
      setAmount(1)
    },
    [toTL]
  )

  const handleToChange = useCallback(
    (tl: number) => {
      setToTL(tl)
      if (tl === fromTL) {
        setFromTL(tl === 1 ? 2 : 1)
      }
    },
    [fromTL]
  )

  const handleSubmit = useCallback(() => {
    if (!result) return
    onTranslate(fromTL, toTL, result.sourceConsumed, result.targetAmount)
    setAmount(1)
  }, [fromTL, toTL, result, onTranslate])

  const canSubmit = !!result && !isPending && amount <= available

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/80 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0" />
        <Dialog.Popup className="fixed inset-0 z-50 mx-auto mt-8 mb-auto h-fit max-h-[calc(100vh-4rem)] w-full max-w-lg overflow-y-auto bg-transparent outline-none">
          <Dialog.Title className="sr-only">Scrap Conversion</Dialog.Title>
          <Dialog.Description className="sr-only">
            Convert scrap between tech levels.
          </Dialog.Description>

          <DisplayCard
            headerBg="bg-su-pink"
            headerContent={
              <div className="flex w-full items-center justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Text as="span" variant="pseudoheader" className="text-[1.75rem] text-su-white">
                    Scrap Conversion
                  </Text>
                  <Text as="span" variant="pseudoheader" className="text-xs text-su-white/80">
                    Rate: N TL1 = 1 TL N
                  </Text>
                </div>
                <Dialog.Close className="flex shrink-0 cursor-pointer items-center justify-center rounded p-1 text-su-black/60 transition-colors hover:bg-su-black/20 hover:text-su-black">
                  <X className="h-5 w-5" />
                  <span className="sr-only">Close</span>
                </Dialog.Close>
              </div>
            }
          >
            <div className="flex flex-col gap-4 bg-su-white p-4">
              {/* From TL */}
              <div className="flex flex-col gap-1.5">
                <Text variant="pseudoheader" as="span" className="text-xs text-su-white">
                  From
                </Text>
                <div className="flex gap-1.5">
                  {TECH_LEVELS.map((tl) => {
                    const scrap = getScrapField(crawler, tl)
                    const isEmpty = scrap === 0
                    return (
                      <button
                        key={tl}
                        type="button"
                        onClick={() => handleFromChange(tl)}
                        disabled={isEmpty}
                        className={`flex h-12 flex-1 flex-col items-center justify-center border-2 font-mono text-xs transition-colors ${
                          isEmpty
                            ? 'pointer-events-none border-su-black/10 text-su-black/25'
                            : fromTL === tl
                              ? 'cursor-pointer border-su-pink bg-su-pink/10 text-su-pink'
                              : 'cursor-pointer border-su-black/20 text-su-black/60 hover:border-su-black/40'
                        }`}
                      >
                        <span className="font-bold">TL{tl}</span>
                        <span className="text-[10px] opacity-70">{scrap}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* To TL */}
              <div className="flex flex-col gap-1.5">
                <Text variant="pseudoheader" as="span" className="text-xs text-su-white">
                  To
                </Text>
                <div className="flex gap-1.5">
                  {TECH_LEVELS.filter((tl) => tl !== fromTL).map((tl) => (
                    <button
                      key={tl}
                      type="button"
                      onClick={() => handleToChange(tl)}
                      className={`flex h-12 flex-1 cursor-pointer flex-col items-center justify-center border-2 font-mono text-xs transition-colors ${
                        toTL === tl
                          ? 'border-su-green bg-su-green/10 text-su-green'
                          : 'border-su-black/20 text-su-black/60 hover:border-su-black/40'
                      }`}
                    >
                      <span className="font-bold">TL{tl}</span>
                      <span className="text-[10px] opacity-70">{getScrapField(crawler, tl)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div className="flex flex-col gap-1.5">
                <Text variant="pseudoheader" as="span" className="text-xs text-su-white">
                  Amount of TL{fromTL} to convert (have: {available})
                </Text>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAmount((a) => Math.max(1, a - 1))}
                    className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center border-2 border-su-black bg-su-black font-mono text-sm font-bold text-su-white transition-opacity hover:opacity-80"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={available}
                    value={amount}
                    onChange={(e) =>
                      setAmount(Math.max(1, Math.min(available, parseInt(e.target.value) || 1)))
                    }
                    className="h-9 w-16 border-2 border-su-black/20 bg-su-white text-center font-mono text-sm text-su-black"
                  />
                  <button
                    type="button"
                    onClick={() => setAmount((a) => Math.min(available, a + 1))}
                    className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center border-2 border-su-black bg-su-black font-mono text-sm font-bold text-su-white transition-opacity hover:opacity-80"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmount(available)}
                    className="cursor-pointer px-2 py-1 font-mono text-xs font-bold text-su-black/50 transition-colors hover:text-su-black"
                  >
                    Max
                  </button>
                </div>
              </div>

              {/* Preview */}
              <div className="border-2 border-su-black/20 p-3">
                {result ? (
                  <div className="flex flex-col items-center gap-1">
                    <Text variant="default" as="p" className="text-sm text-su-black">
                      <span className="font-mono font-bold text-su-pink">
                        {result.sourceConsumed} TL{fromTL}
                      </span>
                      {' → '}
                      <span className="font-mono font-bold text-su-green">
                        {result.targetAmount} TL{toTL}
                      </span>
                    </Text>
                    {result.remainderTL1 > 0 && (
                      <Text variant="default" as="p" className="font-mono text-xs text-su-black/50">
                        ({1} TL{result.remainderTL1} left over)
                      </Text>
                    )}
                  </div>
                ) : (
                  <Text variant="default" as="p" className="text-center text-sm text-su-black/40">
                    {amount > available
                      ? 'Not enough scrap'
                      : 'Not enough to convert (need more source scrap)'}
                  </Text>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="cursor-pointer px-3 py-2 font-mono text-sm text-su-black/50 transition-colors hover:text-su-black"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="cursor-pointer bg-su-black px-4 py-2 transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-40"
                >
                  <Text variant="pseudoheader" as="span" className="text-sm text-su-white">
                    {isPending ? 'Converting...' : 'Convert'}
                  </Text>
                </button>
              </div>
            </div>
          </DisplayCard>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
