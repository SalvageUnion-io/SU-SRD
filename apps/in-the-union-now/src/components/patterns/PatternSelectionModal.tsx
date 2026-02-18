import { useMemo, useState } from 'react'
import { findChassisById } from '../../lib/entityHelpers'
import { patternItemsToOverride } from '../../lib/builderUtils'
import { usePatterns } from '../../hooks/usePatterns'
import type { SURefEntity, SURefObjectPattern } from 'salvageunion-reference'
import type { SelectedPattern, TypedPatternRow } from '../../types/common'
import { ReferenceEntityDisplay, Text, FilterChip, addControl, useChassisPatternConfig } from 'suref-react'
import type { PatternOverrideData } from 'suref-react'
import { Button } from '../ui/button'
import { actionButtonClasses } from '../shared/actionButtonClasses'
import { ModalShell } from '../shared/ModalShell'

type SourceFilter = 'reference' | 'player'

type PatternSelectionModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  chassisRef: string
  onSelect: (selection: SelectedPattern) => void
  userId?: string
}

export function PatternSelectionModal({
  open,
  onOpenChange,
  chassisRef,
  onSelect,
  userId,
}: PatternSelectionModalProps) {
  const [pendingSelection, setPendingSelection] = useState<SelectedPattern | null>(null)
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('reference')

  const chassis = useMemo(() => findChassisById(chassisRef), [chassisRef])
  const referencePatterns = chassis?.patterns ?? []
  const chassisName = chassis?.name ?? 'Unknown'

  const { data: allPlayerPatterns } = usePatterns(userId)
  const playerPatterns = useMemo(
    () => (allPlayerPatterns ?? []).filter((p) => p.chassis_ref === chassisRef),
    [allPlayerPatterns, chassisRef]
  )

  const hasPlayerPatterns = playerPatterns.length > 0

  function handleConfirm() {
    if (!pendingSelection) return
    onSelect(pendingSelection)
    setPendingSelection(null)
    onOpenChange(false)
  }

  function handleCancel() {
    setPendingSelection(null)
  }

  function handleClose(next: boolean) {
    onOpenChange(next)
    if (!next) setPendingSelection(null)
  }

  const pendingName =
    pendingSelection?.source === 'reference'
      ? pendingSelection.pattern.name
      : pendingSelection?.source === 'player'
        ? pendingSelection.pattern.name
        : ''

  return (
    <ModalShell
      open={open}
      onOpenChange={handleClose}
      title="Apply Pattern"
      subtitle={`Select a ${chassisName} pattern to apply.`}
    >
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-hidden bg-su-white p-3">
        {/* Confirmation banner */}
        {pendingSelection && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-su-orange bg-su-orange/10 px-3 py-2">
            <Text as="span" className="text-sm font-medium text-su-black">
              Apply <strong>&ldquo;{pendingName}&rdquo;</strong>? This will replace all
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

        {/* Filter chips — only show if user has player patterns */}
        {hasPlayerPatterns && (
          <div className="flex gap-1.5">
            <FilterChip
              label="Reference"
              active={sourceFilter === 'reference'}
              onClick={() => setSourceFilter('reference')}
            />
            <FilterChip
              label="My Patterns"
              active={sourceFilter === 'player'}
              onClick={() => setSourceFilter('player')}
            />
          </div>
        )}

        <div
          className="flex flex-col gap-2 overflow-y-auto px-1 pr-3 [&>*]:ring-1 [&>*]:ring-su-black"
          style={{ scrollbarGutter: 'stable' }}
        >
          {sourceFilter === 'reference' ? (
            referencePatterns.length === 0 ? (
              <p className="py-4 text-center text-sm text-su-grey-dark">
                No reference patterns found for {chassisName}.
              </p>
            ) : (
              referencePatterns.map((pattern) => (
                <ReferencePatternOption
                  key={pattern.name}
                  chassis={chassis!}
                  pattern={pattern}
                  chassisRef={chassisRef}
                  onSelect={(selection) => setPendingSelection(selection)}
                />
              ))
            )
          ) : playerPatterns.length === 0 ? (
            <p className="py-4 text-center text-sm text-su-grey-dark">
              No saved patterns for {chassisName}.
            </p>
          ) : (
            playerPatterns.map((pattern) => (
              <PlayerPatternOption
                key={pattern.id}
                chassis={chassis!}
                pattern={pattern}
                onSelect={(selection) => setPendingSelection(selection)}
              />
            ))
          )}
        </div>
      </div>
    </ModalShell>
  )
}

function ReferencePatternOption({
  chassis,
  pattern,
  chassisRef,
  onSelect,
}: {
  chassis: SURefEntity
  pattern: SURefObjectPattern
  chassisRef: string
  onSelect: (selection: SelectedPattern) => void
}) {
  const patternOverride: PatternOverrideData = useMemo(
    () => ({ name: pattern.name, systems: pattern.systems, modules: pattern.modules }),
    [pattern.name, pattern.systems, pattern.modules]
  )
  const patternConfig = useChassisPatternConfig(chassis, patternOverride, true)

  const selection: SelectedPattern = useMemo(
    () => ({ source: 'reference', pattern, refPatternId: `${chassisRef}::${pattern.name}` }),
    [pattern, chassisRef]
  )

  return (
    <ReferenceEntityDisplay
      data={chassis}
      compact
      hide={{ patterns: true, content: true }}
      titleOverride={patternConfig?.titleOverride}
      subtitleExtra={patternConfig?.subtitleExtra}
      statsOverride={patternConfig?.statsOverride}
      primaryStatsOnly={patternConfig?.primaryStatsOnly}
      abilitiesSection={patternConfig?.abilitiesSection}
      controls={[addControl(() => onSelect(selection))]}
    />
  )
}

function PlayerPatternOption({
  chassis,
  pattern,
  onSelect,
}: {
  chassis: SURefEntity
  pattern: TypedPatternRow
  onSelect: (selection: SelectedPattern) => void
}) {
  const overrideData: PatternOverrideData = useMemo(
    () => {
      const override = patternItemsToOverride(pattern.pattern_items)
      return { name: pattern.name, systems: override.systems, modules: override.modules }
    },
    [pattern.name, pattern.pattern_items]
  )
  const patternConfig = useChassisPatternConfig(chassis, overrideData, true)

  const selection: SelectedPattern = useMemo(
    () => ({ source: 'player', pattern }),
    [pattern]
  )

  return (
    <ReferenceEntityDisplay
      data={chassis}
      compact
      hide={{ patterns: true, content: true }}
      titleOverride={patternConfig?.titleOverride}
      subtitleExtra={patternConfig?.subtitleExtra}
      statsOverride={patternConfig?.statsOverride}
      primaryStatsOnly={patternConfig?.primaryStatsOnly}
      abilitiesSection={patternConfig?.abilitiesSection}
      controls={[addControl(() => onSelect(selection))]}
    />
  )
}
