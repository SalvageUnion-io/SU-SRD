import { CardHeader, DisplayCard, StatDisplay, Text, ValueDisplay } from 'suref-react'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { CUSTOM_CARGO_CATEGORIES } from '../../lib/customCargoCategories'
import type { CargoRow } from '../../types/common'

type CustomItemDetailModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: CargoRow
  headerBg: string
  category?: string
  techLevel?: string | number
  metadata: Record<string, unknown> | null
}

/** Full-view modal for a custom cargo item */
export function CustomItemDetailModal({
  open,
  onOpenChange,
  item,
  headerBg,
  category,
  techLevel,
  metadata,
}: CustomItemDetailModalProps) {
  const categoryLabel = CUSTOM_CARGO_CATEGORIES.find((c) => c.value === category)?.label ?? 'Other'
  const description = (metadata?.description as string) ?? undefined

  // Build stat badges from metadata
  const stats: { label: string; value: number }[] = []
  if (metadata?.salvage_value !== undefined)
    stats.push({ label: 'SV', value: metadata.salvage_value as number })
  if (metadata?.slots_required !== undefined)
    stats.push({ label: 'Slots', value: metadata.slots_required as number })
  if (metadata?.structure_points !== undefined)
    stats.push({ label: 'SP', value: metadata.structure_points as number })
  if (metadata?.energy_points !== undefined)
    stats.push({ label: 'EP', value: metadata.energy_points as number })
  if (metadata?.heat_capacity !== undefined)
    stats.push({ label: 'Heat', value: metadata.heat_capacity as number })
  if (metadata?.hit_points !== undefined)
    stats.push({ label: 'HP', value: metadata.hit_points as number })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0" />
        <Dialog.Popup className="fixed inset-0 z-50 m-auto h-fit max-h-[calc(100vh-4rem)] w-full max-w-2xl overflow-y-auto bg-transparent outline-none">
          <Dialog.Close className="fixed top-4 right-4 z-[60] rounded-full bg-su-black/70 p-2 text-su-white opacity-70 transition-opacity hover:opacity-100">
            <X className="h-6 w-6" aria-hidden="true" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
          <Dialog.Title className="sr-only">{item.name}</Dialog.Title>
          <Dialog.Description className="sr-only">Custom item details</Dialog.Description>
          <DisplayCard
            headerBg={headerBg}
            headerContent={
              <CardHeader
                title={
                  <Text
                    variant="pseudoheader"
                    as="span"
                    className="text-[1.75rem] uppercase tracking-[-0.02em]"
                  >
                    {item.name}
                  </Text>
                }
                subtitle={
                  <div className="flex flex-wrap items-center gap-1">
                    <ValueDisplay
                      label="Custom Item"
                      compact
                      bgColor="var(--color-su-rust)"
                      textColor="var(--color-su-white)"
                    />
                    <ValueDisplay label="Category" value={categoryLabel} compact />
                    {item.amount > 1 && <ValueDisplay label="Qty" value={item.amount} compact />}
                  </div>
                }
                leftContent={
                  techLevel !== undefined ? (
                    <StatDisplay label="TL" value={String(techLevel)} inverse />
                  ) : undefined
                }
                rightContent={
                  stats.length > 0 ? (
                    <div className="flex items-center gap-0.5">
                      {stats.map((s) => (
                        <StatDisplay key={s.label} label={s.label} value={s.value} inverse />
                      ))}
                    </div>
                  ) : undefined
                }
              />
            }
          >
            {description && (
              <div className="bg-su-white p-4">
                <Text variant="default" className="text-sm leading-relaxed text-su-black">
                  {description}
                </Text>
              </div>
            )}
          </DisplayCard>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
