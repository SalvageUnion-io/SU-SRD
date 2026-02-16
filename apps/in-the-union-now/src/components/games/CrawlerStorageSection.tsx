import { useState, useCallback } from 'react'
import { SectionSeparator, Text } from 'suref-react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCrawlerCargo,
  useAddCrawlerCargo,
  useUpdateCrawlerCargo,
  useDeleteCrawlerCargo,
} from '../../hooks/useCrawlers'
import { getErrorMessage } from '../../lib/errors'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import type { CargoRow } from '../../types/common'

type CrawlerStorageSectionProps = {
  crawlerId: string
  userId: string
  readOnly: boolean
}

export function CrawlerStorageSection({ crawlerId, userId, readOnly }: CrawlerStorageSectionProps) {
  const { data: cargo } = useCrawlerCargo(crawlerId)
  const addCargo = useAddCrawlerCargo()
  const updateCargo = useUpdateCrawlerCargo()
  const deleteCargo = useDeleteCrawlerCargo()

  const [newItemName, setNewItemName] = useState('')

  const handleAdd = useCallback(() => {
    const name = newItemName.trim()
    if (!name) return
    addCargo.mutate(
      { crawlerId, userId, input: { name } },
      {
        onSuccess: () => {
          setNewItemName('')
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }, [crawlerId, userId, newItemName, addCargo])

  const handleUpdateAmount = useCallback(
    (item: CargoRow, delta: number) => {
      const newAmount = Math.max(0, item.amount + delta)
      if (newAmount === 0) {
        deleteCargo.mutate(
          { cargoId: item.id, crawlerId },
          { onError: (err) => toast.error(getErrorMessage(err)) }
        )
      } else {
        updateCargo.mutate(
          { cargoId: item.id, crawlerId, input: { amount: newAmount } },
          { onError: (err) => toast.error(getErrorMessage(err)) }
        )
      }
    },
    [crawlerId, updateCargo, deleteCargo]
  )

  const handleDelete = useCallback(
    (cargoId: string) => {
      deleteCargo.mutate(
        { cargoId, crawlerId },
        { onError: (err) => toast.error(getErrorMessage(err)) }
      )
    },
    [crawlerId, deleteCargo]
  )

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Storage" fontSize="text-sm" />

      {(!cargo || cargo.length === 0) && (
        <Text variant="default" as="p" className="text-sm text-su-white/40">
          No items in storage.
        </Text>
      )}

      {cargo && cargo.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {cargo.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-md border border-su-grey-light/20 px-3 py-1.5"
            >
              <div className="flex items-center gap-2">
                <Text variant="default" as="span" className="text-sm">
                  {item.name}
                </Text>
                {item.amount > 1 && (
                  <span className="font-mono text-xs text-su-white/50">x{item.amount}</span>
                )}
              </div>
              {!readOnly && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleUpdateAmount(item, -1)}
                    className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded bg-su-grey-dark/50 font-mono text-xs font-bold text-su-white/70 transition-colors hover:bg-su-rust/80 hover:text-su-white"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateAmount(item, 1)}
                    className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded bg-su-grey-dark/50 font-mono text-xs font-bold text-su-white/70 transition-colors hover:bg-su-green/80 hover:text-su-white"
                  >
                    +
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                    className="ml-1 h-6 w-6 p-0 text-su-white/40 hover:text-su-rust"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <div className="flex items-center gap-2">
          <Input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Add item to storage..."
            className="h-8 flex-1 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd()
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAdd}
            disabled={!newItemName.trim() || addCargo.isPending}
            className="h-8 gap-1 text-xs text-su-green hover:bg-su-green/20"
          >
            <Plus className="h-3 w-3" />
            Add
          </Button>
        </div>
      )}
    </div>
  )
}
