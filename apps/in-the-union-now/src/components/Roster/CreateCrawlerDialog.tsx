import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X } from 'lucide-react'
import { useCreateCrawler } from '../../hooks/useCrawler'
import { useNavigate } from '@tanstack/react-router'
import { cn } from 'suref-react'
import { SalvageUnionReference } from 'salvageunion-reference'

export function CreateCrawlerDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [crawlerRef, setCrawlerRef] = useState<string | null>(null)
  const createCrawler = useCreateCrawler()
  const navigate = useNavigate()

  const crawlerTypes = SalvageUnionReference.Crawlers.all()

  const handleCreate = async () => {
    if (!name.trim()) return

    const crawler = await createCrawler.mutateAsync({
      name: name.trim(),
      crawler_ref: crawlerRef,
    })

    setOpen(false)
    setName('')
    setCrawlerRef(null)
    navigate({ to: '/crawler/$id', params: { id: crawler.id } })
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="flex h-full min-h-[80px] items-center justify-center rounded-xl border-2 border-dashed border-su-grey-light p-4 text-su-grey transition-colors hover:border-crawler hover:text-crawler">
          <div className="flex flex-col items-center gap-2">
            <Plus className="h-6 w-6" />
            <span className="text-sm font-medium">New Crawler</span>
          </div>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-[var(--background)] p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-lg font-bold">New Crawler</Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded-md p-1 hover:bg-su-grey-light/20">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="crawler-name">
                Name
              </label>
              <input
                id="crawler-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter crawler name..."
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-crawler"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {crawlerTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setCrawlerRef(crawlerRef === type.id ? null : type.id)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                      crawlerRef === type.id
                        ? 'border-crawler bg-crawler/10 font-medium'
                        : 'border-[var(--border)] hover:border-crawler/50'
                    )}
                  >
                    {type.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={!name.trim() || createCrawler.isPending}
              className="w-full rounded-lg bg-crawler px-4 py-2 font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {createCrawler.isPending ? 'Creating...' : 'Create Crawler'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
