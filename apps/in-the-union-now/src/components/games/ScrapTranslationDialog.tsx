import { useState, useMemo, useCallback } from 'react'
import { Text } from 'suref-react'
import { computeScrapTranslation } from '../../lib/crawlerUtils'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
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
        // Auto-pick a different target
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-su-grey-dark bg-su-grey-dark sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-su-white">Translate Scrap</DialogTitle>
          <DialogDescription className="text-su-white/60">
            Convert scrap between tech levels. Rate: N TL1 = 1 TL N.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* From TL */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-su-white/50">From</span>
            <div className="flex gap-1.5">
              {TECH_LEVELS.map((tl) => (
                <button
                  key={tl}
                  type="button"
                  onClick={() => handleFromChange(tl)}
                  className={`flex h-10 flex-1 cursor-pointer flex-col items-center justify-center rounded border text-xs font-mono transition-colors ${
                    fromTL === tl
                      ? 'border-su-pink bg-su-pink/20 text-su-pink'
                      : 'border-su-grey-light/20 text-su-white/60 hover:border-su-white/30'
                  }`}
                >
                  <span className="font-bold">TL{tl}</span>
                  <span className="text-[10px] opacity-70">{getScrapField(crawler, tl)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* To TL */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-su-white/50">To</span>
            <div className="flex gap-1.5">
              {TECH_LEVELS.filter((tl) => tl !== fromTL).map((tl) => (
                <button
                  key={tl}
                  type="button"
                  onClick={() => handleToChange(tl)}
                  className={`flex h-10 flex-1 cursor-pointer flex-col items-center justify-center rounded border text-xs font-mono transition-colors ${
                    toTL === tl
                      ? 'border-su-green bg-su-green/20 text-su-green'
                      : 'border-su-grey-light/20 text-su-white/60 hover:border-su-white/30'
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
            <label className="text-xs font-medium text-su-white/50">
              Amount of TL{fromTL} to convert (have: {available})
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAmount((a) => Math.max(1, a - 1))}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded bg-su-grey-dark/80 font-mono text-sm font-bold text-su-white/70 transition-colors hover:bg-su-rust/80"
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
                className="h-8 w-16 rounded border border-su-grey-light/20 bg-transparent text-center font-mono text-sm text-su-white"
              />
              <button
                type="button"
                onClick={() => setAmount((a) => Math.min(available, a + 1))}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded bg-su-grey-dark/80 font-mono text-sm font-bold text-su-white/70 transition-colors hover:bg-su-green/80"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setAmount(available)}
                className="rounded px-2 py-1 text-xs text-su-white/50 transition-colors hover:text-su-white cursor-pointer"
              >
                Max
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded border border-su-grey-light/20 p-3">
            {result ? (
              <Text variant="default" as="p" className="text-center text-sm text-su-white">
                <span className="font-mono font-bold text-su-pink">
                  {result.sourceConsumed} TL{fromTL}
                </span>
                {' → '}
                <span className="font-mono font-bold text-su-green">
                  {result.targetAmount} TL{toTL}
                </span>
              </Text>
            ) : (
              <Text variant="default" as="p" className="text-center text-sm text-su-white/40">
                {amount > available
                  ? 'Not enough scrap'
                  : 'Not enough to convert (need more source scrap)'}
              </Text>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-su-white/70">
            Cancel
          </Button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!result || isPending || amount > available}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-su-green px-3 py-1.5 font-mono text-sm font-semibold uppercase text-su-white transition-colors hover:bg-emerald-600 disabled:pointer-events-none disabled:opacity-50"
          >
            {isPending ? 'Translating...' : 'Translate'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
