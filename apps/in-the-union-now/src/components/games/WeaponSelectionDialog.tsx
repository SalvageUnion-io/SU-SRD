import { useState, useMemo, useCallback } from 'react'
import { SalvageUnionReference, getTechLevel, getDamage } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { DisplayCard, EntityDisplay, Text, addControl } from 'suref-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Input } from '../ui/input'

type WeaponSelectionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (entityId: string) => void
  currentWeaponId?: string
}

export function WeaponSelectionDialog({
  open,
  onOpenChange,
  onSelect,
  currentWeaponId,
}: WeaponSelectionDialogProps) {
  const [search, setSearch] = useState('')

  // Filter to TL1 weapon systems (systems with damage)
  const weapons = useMemo(() => {
    return SalvageUnionReference.Systems.all().filter((s) => {
      const tl = getTechLevel(s)
      const dmg = getDamage(s)
      return tl === 1 && dmg !== undefined
    })
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return weapons
    const lower = search.toLowerCase()
    return weapons.filter((w) => w.name.toLowerCase().includes(lower))
  }, [weapons, search])

  const handleSelect = useCallback(
    (entityId: string) => {
      onSelect(entityId)
      setSearch('')
    },
    [onSelect]
  )

  const handleClose = useCallback(
    (next: boolean) => {
      onOpenChange(next)
      if (!next) setSearch('')
    },
    [onOpenChange]
  )

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleClose}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 overflow-y-auto bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <div className="flex min-h-full items-start justify-center px-4 py-8">
            <DialogPrimitive.Content className="relative w-full max-w-3xl bg-transparent outline-none">
              <DialogPrimitive.Title className="sr-only">
                Choose Weapons System
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">
                Select a TL1 weapon system for your crawler.
              </DialogPrimitive.Description>

              <DisplayCard
                headerBg="bg-su-orange"
                bodyPadding="p-0"
                headerContent={
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <Text
                        as="span"
                        variant="pseudoheader"
                        className="text-[1.75rem] text-su-white"
                      >
                        Weapons System
                      </Text>
                      <Text as="span" variant="pseudoheader" className="text-xs text-su-white/80">
                        Select a TL1 weapon system.
                      </Text>
                    </div>
                    <DialogPrimitive.Close className="flex shrink-0 cursor-pointer items-center justify-center rounded p-1 text-su-black/60 transition-colors hover:bg-su-black/20 hover:text-su-black">
                      <X className="h-5 w-5" />
                      <span className="sr-only">Close</span>
                    </DialogPrimitive.Close>
                  </div>
                }
              >
                <div className="flex max-h-[70vh] flex-col gap-3 overflow-hidden bg-su-white p-3">
                  <Input
                    placeholder="Search weapons..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="border-su-grey-light/50 bg-su-white text-su-black placeholder:text-su-grey-dark"
                  />

                  <div
                    className="flex flex-col gap-2 overflow-y-auto px-1 pr-3 [&>*]:ring-1 [&>*]:ring-su-black"
                    style={{ scrollbarGutter: 'stable' }}
                  >
                    {filtered.length === 0 ? (
                      <p className="py-4 text-center text-sm text-su-grey-dark">
                        No weapons found.
                      </p>
                    ) : (
                      filtered.map((weapon) => {
                        const isCurrent = weapon.id === currentWeaponId
                        return (
                          <div
                            key={weapon.id}
                            className={isCurrent ? 'ring-2 ring-su-green/50' : ''}
                          >
                            <EntityDisplay
                              data={weapon as unknown as SURefEntity}
                              compact
                              controls={
                                isCurrent ? undefined : [addControl(() => handleSelect(weapon.id))]
                              }
                            />
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </DisplayCard>
            </DialogPrimitive.Content>
          </div>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
