import type { ReactNode } from 'react'
import type { SURefObjectGuideStep, SURefObjectTable } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Text } from '../base/Text'
import { BlockContentRendererView } from './BlockContentRendererView'
import { RollTable } from '../shared/RollTable'
import { borderColorFromHeaderBg } from './entityDisplayHelpers'
import { getStepNumbers, matchesFilter, enrichForFiltering } from './guideStepsHelpers'
import type { getEntityFontSizes, getEntitySpacing } from './EntityDisplay/entityDisplayTypes'
import type { EntityControl } from './EntityDisplay/entityControlTypes'
import { selectControl } from './EntityDisplay/entityControls'
import { cn } from '../../utils/cn'

// ---------------------------------------------------------------------------
// Interactive types (exported for consuming apps)
// ---------------------------------------------------------------------------

export type GuideStepInteractiveState = {
  isCurrent: boolean
  isComplete: boolean
  isUnlocked: boolean
  /** Step has been previously activated (has selections) — stays editable and non-greyed */
  isActivated?: boolean
}

export type GuideStepSelectionState = {
  selectedIds: Set<string>
  countBadge?: { current: number; max: number } | null
}

export type GuideStepRollState = {
  textValue: string
}

export type GuideStepsInteractiveConfig = {
  getStepState: (step: SURefObjectGuideStep, index: number) => GuideStepInteractiveState
  getStepSelectionState?: (step: SURefObjectGuideStep) => GuideStepSelectionState | null
  getStepRollState?: (step: SURefObjectGuideStep) => GuideStepRollState | null
  onEntityToggle?: (stepId: string, entityId: string, schemaName: string) => void
  onRoll?: (stepId: string) => void
  onTextChange?: (stepId: string, value: string) => void
  onStepClick?: (step: SURefObjectGuideStep, index: number) => void
  resolveEntities?: (
    step: SURefObjectGuideStep
  ) => { data: unknown; schemaName: string; disabled?: boolean }[]
  renderRollInteraction?: (
    step: SURefObjectGuideStep,
    rollState: GuideStepRollState,
    onRoll: () => void,
    onTextChange: (value: string) => void
  ) => ReactNode
  renderFooter?: () => ReactNode
  renderStepHeaderExtra?: (step: SURefObjectGuideStep, index: number) => ReactNode
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type GuideStepsDisplayProps = {
  steps: SURefObjectGuideStep[]
  compact: boolean
  headerBg: string
  headerBgColor?: string
  fontSize: ReturnType<typeof getEntityFontSizes>
  spacing: ReturnType<typeof getEntitySpacing>
  renderEntityListing?: (
    entityData: unknown,
    schemaName: string,
    key: string,
    listing: boolean,
    compact?: boolean,
    controls?: EntityControl[],
    disabled?: boolean
  ) => ReactNode
  interactive?: GuideStepsInteractiveConfig
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sort entities disabled by choice filtering (contextFrom) after enabled ones. */
function sortDisabledAfterEnabled(
  entities: { data: unknown; schemaName: string; disabled?: boolean }[]
): { data: unknown; schemaName: string; disabled?: boolean }[] {
  if (!entities.some((e) => e.disabled)) return entities
  const enabled: typeof entities = []
  const disabled: typeof entities = []
  for (const entry of entities) {
    if (entry.disabled) {
      disabled.push(entry)
    } else {
      enabled.push(entry)
    }
  }
  return [...enabled, ...disabled]
}

function resolveRollTableEntity(name: string) {
  return SalvageUnionReference.RollTables.find((rt) => rt.name === name) ?? null
}

function resolveSchemaEntities(
  step: SURefObjectGuideStep
): { data: unknown; schemaName: string; disabled?: boolean }[] {
  if (!step.schema) return []
  const schemaName = step.schema[0]
  if (!schemaName || schemaName === 'actions') return []

  const filters = step.filters

  if (!step.schemaEntities || step.schemaEntities.length === 0) {
    const model = SalvageUnionReference.findAllIn(schemaName, (e) => {
      if (!filters || filters.length === 0) return true
      const enriched = enrichForFiltering(e as Record<string, unknown>, schemaName)
      return filters.every((f) => matchesFilter(enriched, f))
    })
    return model.map((entity) => ({ data: entity, schemaName }))
  }

  const nameSet = new Set(step.schemaEntities)
  const entities = SalvageUnionReference.findAllIn(schemaName, (e) => {
    if (!nameSet.has(e.name)) return false
    if (!filters || filters.length === 0) return true
    const enriched = enrichForFiltering(e as Record<string, unknown>, schemaName)
    return filters.every((f) => matchesFilter(enriched, f))
  })
  const byName = new Map(entities.map((e) => [e.name, e]))
  return step.schemaEntities
    .map((name) => {
      const entity = byName.get(name)
      return entity ? { data: entity, schemaName } : null
    })
    .filter(Boolean) as { data: unknown; schemaName: string; disabled?: boolean }[]
}

/** Compute the interaction state for a single entity within a step */
function computeEntityInteractionState(
  step: SURefObjectGuideStep,
  entityId: string,
  schemaName: string,
  entityDisabled: boolean | undefined,
  selectionState: GuideStepSelectionState | null,
  interactive: GuideStepsInteractiveConfig | undefined
): { isGreyedOut: boolean; entityControls: EntityControl[] | undefined } {
  const isSelected = selectionState?.selectedIds.has(entityId) ?? false
  const hasSelection = (selectionState?.selectedIds.size ?? 0) > 0
  const isAtMax = selectionState?.countBadge
    ? selectionState.countBadge.current >= selectionState.countBadge.max
    : false
  const isGreyedOut =
    !entityDisabled &&
    !isSelected &&
    ((step.stepType === 'select-one' && hasSelection) ||
      (step.stepType === 'select-many' && isAtMax))
  const entityControls =
    !entityDisabled && interactive?.onEntityToggle
      ? [
          selectControl(
            () => interactive.onEntityToggle!(step.id, entityId, schemaName),
            isSelected
          ),
        ]
      : undefined
  return { isGreyedOut, entityControls }
}

/** Shared roll section: roll table + freeform input */
function StepRollSection({
  step,
  rollTableEntity,
  rollState,
  isRollStep,
  interactive,
}: {
  step: SURefObjectGuideStep
  rollTableEntity: { name: string; table?: SURefObjectTable } | null
  rollState: GuideStepRollState | null
  isRollStep: boolean
  interactive: GuideStepsInteractiveConfig | undefined
}) {
  return (
    <>
      {rollTableEntity && 'table' in rollTableEntity && rollTableEntity.table && (
        <div className="mt-2">
          {rollState && isRollStep && (
            <div className="mb-2">
              {interactive?.renderRollInteraction ? (
                interactive.renderRollInteraction(
                  step,
                  rollState,
                  () => interactive.onRoll?.(step.id),
                  (value) => interactive.onTextChange?.(step.id, value)
                )
              ) : (
                <input
                  type="text"
                  value={rollState.textValue}
                  onChange={(e) => interactive?.onTextChange?.(step.id, e.target.value)}
                  placeholder={`Roll or type your ${step.name.toLowerCase()}...`}
                  className="h-9 w-full rounded-md border border-su-grey-light/30 px-3 text-sm"
                />
              )}
            </div>
          )}
          <RollTable
            table={rollTableEntity.table as SURefObjectTable}
            compact
            showCommand
            tableName={rollTableEntity.name}
            onRollResult={
              interactive ? (text) => interactive.onTextChange?.(step.id, text) : undefined
            }
          />
        </div>
      )}
      {rollState && isRollStep && !rollTableEntity && (
        <div className="mt-2">
          {interactive?.renderRollInteraction ? (
            interactive.renderRollInteraction(
              step,
              rollState,
              () => interactive.onRoll?.(step.id),
              (value) => interactive.onTextChange?.(step.id, value)
            )
          ) : (
            <input
              type="text"
              value={rollState.textValue}
              onChange={(e) => interactive?.onTextChange?.(step.id, e.target.value)}
              placeholder={`Enter your ${step.name.toLowerCase()}...`}
              className="h-9 w-full rounded-md border border-su-grey-light/30 px-3 text-sm"
            />
          )}
        </div>
      )}
    </>
  )
}

function SidebarArrow() {
  return (
    <div className="flex justify-center py-0.5">
      <svg
        width="20"
        height="24"
        viewBox="0 0 20 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M10 2v16m0 0l-5-5m5 5l5-5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component — single rendering path for both static and interactive
// ---------------------------------------------------------------------------

export function GuideStepsDisplay({
  steps,
  compact,
  headerBg,
  headerBgColor,
  fontSize,
  spacing,
  renderEntityListing,
  interactive,
}: GuideStepsDisplayProps) {
  if (!steps || steps.length === 0) return null

  const borderColor = borderColorFromHeaderBg(headerBg, headerBgColor)
  const stepNumbers = getStepNumbers(steps)
  const showStepNumbers = !compact || stepNumbers.some((n) => n > 1)

  return (
    <div className={spacing.sectionSpaceYClass}>
      {steps.map((step, index) => {
        // --- Interactive state (all null/false when no interactive config) ---
        const stepState = interactive?.getStepState(step, index)
        const isLocked = interactive ? !(stepState?.isUnlocked ?? true) : false
        const isCurrent = stepState?.isCurrent ?? false
        const isActivated = stepState?.isActivated ?? false
        const isInactiveStep = interactive ? !(isCurrent || isActivated) : false
        const selectionState = interactive?.getStepSelectionState?.(step) ?? null
        const rollState = interactive?.getStepRollState?.(step) ?? null
        const isRollStep = step.stepType === 'roll-table' || step.stepType === 'freeform'

        // --- Entity / content resolution ---
        const rollTableEntity = step.rollTable ? resolveRollTableEntity(step.rollTable) : null
        const resolvedEntities =
          !compact && renderEntityListing
            ? interactive?.resolveEntities
              ? interactive.resolveEntities(step)
              : resolveSchemaEntities(step)
            : []
        const hasEntityListings = !!rollTableEntity || resolvedEntities.length > 0
        const isSidebarLayout =
          step.entityLayout === 'sidebar' && resolvedEntities.length > 0 && renderEntityListing
        const stepContent =
          hasEntityListings && step.content
            ? step.content.filter((block) => block.type !== 'hint')
            : step.content
        const isRight = !compact && stepNumbers[index]! % 2 === 0

        return (
          <div
            key={step.id}
            className={cn(
              'overflow-visible bg-transparent',
              isLocked && 'opacity-40 pointer-events-none'
            )}
          >
            {/* Section header */}
            {step.section && (
              <Text
                variant="pseudoheader"
                className={cn(
                  'w-fit',
                  compact ? 'text-base px-0.5 py-[1px] mt-2' : 'text-2xl px-1 py-1 mt-4',
                  isRight && 'ml-auto'
                )}
                style={{ backgroundColor: 'var(--color-su-black)', color: 'var(--color-su-white)' }}
              >
                {step.section}
              </Text>
            )}

            {/* Step header */}
            {!isSidebarLayout && (
              <div
                className={cn(
                  'flex flex-wrap items-center gap-2 bg-transparent',
                  compact ? 'py-1' : 'py-2',
                  isRight && 'justify-end',
                  interactive && 'cursor-pointer'
                )}
                role={interactive?.onStepClick ? 'button' : undefined}
                tabIndex={interactive?.onStepClick ? 0 : undefined}
                onClick={
                  interactive?.onStepClick ? () => interactive.onStepClick!(step, index) : undefined
                }
                onKeyDown={
                  interactive?.onStepClick
                    ? (e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          interactive.onStepClick!(step, index)
                        }
                      }
                    : undefined
                }
              >
                {isRight && interactive?.renderStepHeaderExtra?.(step, index)}
                <Text
                  variant="pseudoheader"
                  className={cn(
                    'w-fit',
                    compact ? 'text-sm px-0.5 py-[1px]' : 'text-xl px-1 py-0.5'
                  )}
                >
                  {showStepNumbers && !isRight ? `${stepNumbers[index]}. ` : ''}
                  {step.name}
                  {showStepNumbers && isRight ? ` .${stepNumbers[index]}` : ''}
                </Text>
                {!isRight && interactive?.renderStepHeaderExtra?.(step, index)}
              </div>
            )}

            {/* Content area — identical structure for both modes */}
            {isSidebarLayout ? (
              <>
                <div
                  className={cn(
                    'flex flex-col md:flex-row gap-4 mt-1',
                    isRight && 'md:flex-row-reverse'
                  )}
                >
                  <div className="flex flex-col items-center md:flex-1 min-w-0">
                    {sortDisabledAfterEnabled(resolvedEntities).map(
                      ({ data, schemaName, disabled: entityDisabled }, i) => {
                        const entityId = (data as { id: string }).id
                        const { isGreyedOut, entityControls } = computeEntityInteractionState(
                          step,
                          entityId,
                          schemaName,
                          entityDisabled,
                          selectionState,
                          interactive
                        )
                        return (
                          <div key={entityId} className="w-full">
                            {renderEntityListing!(
                              data,
                              schemaName,
                              `${step.id}-${schemaName}-${entityId}`,
                              true,
                              true,
                              entityControls,
                              entityDisabled || isGreyedOut || isInactiveStep
                            )}
                            {i < resolvedEntities.length - 1 && <SidebarArrow />}
                          </div>
                        )
                      }
                    )}
                  </div>
                  {stepContent && stepContent.length > 0 && (
                    <div
                      className={cn(
                        'flex-1 min-w-0',
                        isRight ? (compact ? 'pr-2' : 'pr-3') : compact ? 'pl-2' : 'pl-3'
                      )}
                      style={
                        borderColor
                          ? isRight
                            ? { borderRight: `3px solid ${borderColor}` }
                            : { borderLeft: `3px solid ${borderColor}` }
                          : undefined
                      }
                    >
                      <BlockContentRendererView
                        content={stepContent}
                        fontSize={fontSize.sm}
                        compact={compact}
                        damaged={false}
                        headerBg={headerBg}
                        headerBgColor={headerBgColor}
                      />
                    </div>
                  )}
                </div>

                <StepRollSection
                  step={step}
                  rollTableEntity={rollTableEntity}
                  rollState={rollState}
                  isRollStep={isRollStep}
                  interactive={interactive}
                />
              </>
            ) : (
              <div
                className={cn(isRight ? (compact ? 'pr-2' : 'pr-3') : compact ? 'pl-2' : 'pl-3')}
                style={
                  borderColor
                    ? isRight
                      ? { borderRight: `3px solid ${borderColor}` }
                      : { borderLeft: `3px solid ${borderColor}` }
                    : undefined
                }
              >
                {stepContent && stepContent.length > 0 && (
                  <BlockContentRendererView
                    content={stepContent}
                    fontSize={fontSize.sm}
                    compact={compact}
                    damaged={false}
                    headerBg={headerBg}
                    headerBgColor={headerBgColor}
                  />
                )}
                {resolvedEntities.length > 0 && renderEntityListing && (
                  <div
                    className={cn(
                      'grid gap-2 mt-2',
                      compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                    )}
                  >
                    {sortDisabledAfterEnabled(resolvedEntities).map(
                      ({ data, schemaName, disabled: entityDisabled }) => {
                        const entityId = (data as { id: string }).id
                        const { isGreyedOut, entityControls } = computeEntityInteractionState(
                          step,
                          entityId,
                          schemaName,
                          entityDisabled,
                          selectionState,
                          interactive
                        )
                        return renderEntityListing(
                          data,
                          schemaName,
                          `${step.id}-${schemaName}-${entityId}`,
                          true,
                          undefined,
                          entityControls,
                          entityDisabled || isGreyedOut
                        )
                      }
                    )}
                  </div>
                )}

                <StepRollSection
                  step={step}
                  rollTableEntity={rollTableEntity}
                  rollState={rollState}
                  isRollStep={isRollStep}
                  interactive={interactive}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
