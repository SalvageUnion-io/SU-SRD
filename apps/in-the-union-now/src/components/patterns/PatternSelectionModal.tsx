import { useMemo, useState } from 'react'
import { findChassisById } from '../../lib/entityHelpers'
import type { SURefEntity, SURefObjectPattern } from 'salvageunion-reference'
import { EntityDisplay, Text, addControl, useChassisPatternConfig } from 'suref-react'
import type { PatternOverrideData } from 'suref-react'
import { Button } from '../ui/button'
import { actionButtonClasses } from '../shared/actionButtonClasses'
import { ModalShell } from '../shared/ModalShell'

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

  const chassis = useMemo(() => findChassisById(chassisRef), [chassisRef])

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
    <ModalShell
      open={open}
      onOpenChange={handleClose}
      title="Apply Pattern"
      subtitle={`Select a ${chassisName} pattern to apply.`}
    >
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-hidden bg-su-white p-3">
        {/* Confirmation banner */}
        {pendingPattern && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-su-orange bg-su-orange/10 px-3 py-2">
            <Text as="span" className="text-sm font-medium text-su-black">
              Apply <strong>&ldquo;{pendingPattern.name}&rdquo;</strong>? This will replace all
              current systems and modules.
            </Text>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" className="cursor-pointer" onClick={handleCancel}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={handleConfirm}
                className={actionButtonClasses('orange')}
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
              <PatternOption
                key={pattern.name}
                chassis={chassis!}
                pattern={pattern}
                onSelect={() => setPendingPattern(pattern)}
              />
            ))
          )}
        </div>
      </div>
    </ModalShell>
  )
}

function PatternOption({
  chassis,
  pattern,
  onSelect,
}: {
  chassis: SURefEntity
  pattern: SURefObjectPattern
  onSelect: () => void
}) {
  const patternOverride: PatternOverrideData = useMemo(
    () => ({ name: pattern.name, systems: pattern.systems, modules: pattern.modules }),
    [pattern.name, pattern.systems, pattern.modules]
  )
  const patternConfig = useChassisPatternConfig(chassis, patternOverride, true)

  return (
    <EntityDisplay
      data={chassis}
      compact
      hide={{ patterns: true, content: true }}
      titleOverride={patternConfig?.titleOverride}
      subtitleExtra={patternConfig?.subtitleExtra}
      statsOverride={patternConfig?.statsOverride}
      primaryStatsOnly={patternConfig?.primaryStatsOnly}
      abilitiesSection={patternConfig?.abilitiesSection}
      controls={[addControl(onSelect)]}
    />
  )
}
