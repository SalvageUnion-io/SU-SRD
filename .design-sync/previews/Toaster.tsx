/*
 * Ported from packages/component-lib/src/components/ui/toaster.stories.tsx.
 *
 * Three changes from the story, all forced by the fact that a card cannot click:
 *  - the toast fires on mount with an infinite duration, instead of from a
 *    button; without that the card is an empty region and the chip, which is the
 *    whole subject, never appears.
 *  - ONE toast per cell. Two earlier drafts raised all three at once and
 *    rendered a single chip: sonner stacks toasts at one position and collapses
 *    them, and passing `expand` did not change that under capture. A cell whose
 *    caption promises three states and shows one is worse than three cells.
 *  - `toast.dismiss()` runs on mount and on unmount, because the toast store is
 *    module-global and would otherwise leak between cells.
 */
import { toast, Toaster } from 'component-lib'
import { useEffect } from 'react'
import { Caption } from '../preview-lib/harness'

const STICKY = { duration: Number.POSITIVE_INFINITY }

function useToast(raise: () => void) {
  useEffect(() => {
    toast.dismiss()
    const id = setTimeout(raise, 0)
    return () => {
      clearTimeout(id)
      toast.dismiss()
    }
  }, [raise])
}

/*
 * What actually renders is a dark ink chip with paper text, a coloured status
 * dot, and a muted description line — not the off-white chip the styling
 * ruleset describes. Recorded here rather than papered over: these cards are
 * the shipped rendering, and the doc should match the pixels.
 */

/** `toast.success` — the confirmation chip, green status dot. */
export function Success() {
  useToast(() =>
    toast.success('Saved to workspace.', { description: 'Your build is up to date.', ...STICKY })
  )
  return (
    <div className="min-h-[300px] bg-paper p-4">
      <Toaster />
      <Caption>success</Caption>
    </div>
  )
}

/** `toast.error` — the failure chip. */
export function Error() {
  useToast(() =>
    toast.error('Save failed.', { description: 'Could not reach local storage.', ...STICKY })
  )
  return (
    <div className="min-h-[300px] bg-paper p-4">
      <Toaster />
      <Caption>error</Caption>
    </div>
  )
}

/** A bare `toast` — no status, message only. */
export function Default() {
  useToast(() => toast('Nothing to report.', STICKY))
  return (
    <div className="min-h-[300px] bg-paper p-4">
      <Toaster />
      <Caption>default</Caption>
    </div>
  )
}
