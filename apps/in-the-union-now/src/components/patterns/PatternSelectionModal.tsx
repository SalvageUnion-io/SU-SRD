import { useMemo, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefObjectPattern } from 'salvageunion-reference'
import { DisplayCard, EntityDisplay, Text } from 'suref-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Button } from '../ui/button'

type PatternSelectionModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  chassisRef: string
  onSelect: (pattern: SURefObjectPattern) => void
}

export function PatternSelectionModal({
  open,
  onOpenChange,
  chassisRef,
  onSelect,
}: PatternSelectionModalProps) {
  const [pendingPattern, setPendingPattern] = useState<SURefObjectPattern | null>(null)

  const chassis = useMemo(
    () => SalvageUnionReference.Chassis.find((c) => c.id === chassisRef),
    [chassisRef]
  )

  const patterns = chassis?.patterns ?? []
  const chassisName = chassis?.name ?? 'Unknown'

  function handleConfirm() {
    if (!pendingPattern) return
    onSelect(pendingPattern)
    setPendingPattern(null)
    onOpenChange(false)
  }

  function handleCancel() {
    setPendingPattern(null)
  }

  function handleClose(next: boolean) {
    onOpenChange(next)
    if (!next) setPendingPattern(null)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleClose}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 overflow-y-auto bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <div className="flex min-h-full items-start justify-center px-4 py-8">
            <DialogPrimitive.Content className="relative w-full max-w-3xl bg-transparent outline-none">
              <DialogPrimitive.Title className="sr-only">Apply Pattern</DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">
                Select a {chassisName} pattern to apply.
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
                        Apply Pattern
                      </Text>
                      <Text as="span" variant="pseudoheader" className="text-xs text-su-white/80">
                        Select a {chassisName} pattern to apply.
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
                  {/* Confirmation banner */}
                  {pendingPattern && (
                    <div className="flex items-center justify-between gap-3 rounded-md border border-su-orange bg-su-orange/10 px-3 py-2">
                      <Text as="span" className="text-sm font-medium text-su-black">
                        Apply <strong>&ldquo;{pendingPattern.name}&rdquo;</strong>? This will
                        replace all current systems and modules.
                      </Text>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer"
                          onClick={handleCancel}
                        >
                          Cancel
                        </Button>
                        <button
                          type="button"
                          onClick={handleConfirm}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-su-orange px-3 py-1.5 font-mono text-sm font-semibold uppercase text-su-white transition-colors hover:bg-orange-700"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}

                  <div
                    className="flex flex-col gap-2 overflow-y-auto px-1 pr-3 [&>*]:ring-1 [&>*]:ring-su-black"
                    style={{ scrollbarGutter: 'stable' }}
                  >
                    {patterns.length === 0 ? (
                      <p className="py-4 text-center text-sm text-su-grey-dark">
                        No patterns found for {chassisName}.
                      </p>
                    ) : (
                      patterns.map((pattern) => (
                        <EntityDisplay
                          key={pattern.name}
                          data={chassis!}
                          compact
                          hidePatterns
                          hideContent
                          patternOverride={{
                            name: pattern.name,
                            systems: pattern.systems,
                            modules: pattern.modules,
                          }}
                          onAdd={() => setPendingPattern(pattern)}
                        />
                      ))
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
