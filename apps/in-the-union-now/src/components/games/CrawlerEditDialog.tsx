import { useState, useCallback } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import type { CrawlerRow, CrawlerUpdate } from '../../types/common'

type CrawlerEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  crawler: CrawlerRow
  onSave: (input: Partial<CrawlerUpdate>) => void
  isPending: boolean
}

export function CrawlerEditDialog({
  open,
  onOpenChange,
  crawler,
  onSave,
  isPending,
}: CrawlerEditDialogProps) {
  const [name, setName] = useState(crawler.name ?? '')
  const [tag, setTag] = useState(crawler.tag ?? '')
  const [notes, setNotes] = useState(crawler.notes ?? '')

  // Reset form when dialog opens with fresh crawler data
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        setName(crawler.name ?? '')
        setTag(crawler.tag ?? '')
        setNotes(crawler.notes ?? '')
      }
      onOpenChange(next)
    },
    [crawler, onOpenChange]
  )

  const handleSubmit = useCallback(() => {
    const updates: Partial<CrawlerUpdate> = {}
    if (name !== (crawler.name ?? '')) updates.name = name || null
    if (tag !== (crawler.tag ?? '')) updates.tag = tag || null
    if (notes !== (crawler.notes ?? '')) updates.notes = notes || null

    if (Object.keys(updates).length === 0) {
      onOpenChange(false)
      return
    }

    onSave(updates)
  }, [name, tag, notes, crawler, onSave, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-su-grey-dark bg-su-grey-dark sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-su-white">Edit Crawler</DialogTitle>
          <DialogDescription className="text-su-white/60">
            Update your crawler&apos;s name, tag number, and notes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="crawler-name" className="text-xs font-medium text-su-white/50">
              Crawler Name
            </label>
            <Input
              id="crawler-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tin Lizzy"
              className="h-9"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="crawler-tag" className="text-xs font-medium text-su-white/50">
              Tag Number
            </label>
            <Input
              id="crawler-tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="e.g. 132"
              className="h-9"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="crawler-notes" className="text-xs font-medium text-su-white/50">
              Notes
            </label>
            <textarea
              id="crawler-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Campaign notes, backstory, etc."
              rows={4}
              className="rounded-md border border-su-grey-light/20 bg-transparent px-3 py-2 text-sm text-su-white placeholder:text-su-white/30 focus:border-su-pink focus:outline-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            className="text-su-white/70"
          >
            Cancel
          </Button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-su-green px-3 py-1.5 font-mono text-sm font-semibold uppercase text-su-white transition-colors hover:bg-emerald-600 disabled:pointer-events-none disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Save'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
