import type { ReactNode } from 'react'
import type { SURefObjectGuideStep } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Text } from '../base/Text'
import { BlockContentRendererView } from './BlockContentRendererView'
import { borderColorFromHeaderBg } from './entityDisplayHelpers'
import type { getEntityFontSizes, getEntitySpacing } from './EntityDisplay/entityDisplayTypes'
import { cn } from '../../utils/cn'

type GuideStepsDisplayProps = {
  steps: SURefObjectGuideStep[]
  compact: boolean
  headerBg: string
  headerBgColor?: string
  fontSize: ReturnType<typeof getEntityFontSizes>
  spacing: ReturnType<typeof getEntitySpacing>
  /** Render prop for entity display. Called with (entityData, schemaName, key, listing, compact). */
  renderEntityListing?: (
    entityData: unknown,
    schemaName: string,
    key: string,
    listing: boolean,
    compact?: boolean
  ) => ReactNode
}

/** Compute per-step display numbers, resetting when a step has a `section` value */
function getStepNumbers(steps: SURefObjectGuideStep[]): number[] {
  const numbers: number[] = []
  let counter = 0
  for (const step of steps) {
    if (step.section) counter = 0
    counter++
    numbers.push(counter)
  }
  return numbers
}

/** Resolve a roll table entity by name */
function resolveRollTableEntity(name: string) {
  return SalvageUnionReference.RollTables.find((rt) => rt.name === name) ?? null
}

/** Resolve schema entities by name from the first schema in the step's schema list.
 *  If schemaEntities is not specified, returns all entities from the schema. */
function resolveSchemaEntities(step: SURefObjectGuideStep) {
  if (!step.schema) return []
  const schemaName = step.schema[0]
  if (!schemaName || schemaName === 'actions') return []

  // No explicit entity list — return all entities from the schema
  if (!step.schemaEntities || step.schemaEntities.length === 0) {
    const model = SalvageUnionReference.findAllIn(schemaName, () => true)
    return model.map((entity) => ({ data: entity, schemaName }))
  }

  const nameSet = new Set(step.schemaEntities)
  const entities = SalvageUnionReference.findAllIn(schemaName, (e) => nameSet.has(e.name))
  // Preserve the order from schemaEntities
  const byName = new Map(entities.map((e) => [e.name, e]))
  return step.schemaEntities
    .map((name) => {
      const entity = byName.get(name)
      return entity ? { data: entity, schemaName } : null
    })
    .filter(Boolean) as { data: unknown; schemaName: string }[]
}

/** Down arrow SVG rendered between sidebar entities */
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

export function GuideStepsDisplay({
  steps,
  compact,
  headerBg,
  headerBgColor,
  fontSize,
  spacing,
  renderEntityListing,
}: GuideStepsDisplayProps) {
  if (!steps || steps.length === 0) return null

  const borderColor = borderColorFromHeaderBg(headerBg, headerBgColor)
  const stepNumbers = getStepNumbers(steps)

  return (
    <div className={spacing.sectionSpaceYClass}>
      {steps.map((step, index) => {
        const rollTableEntity =
          !compact && step.rollTable ? resolveRollTableEntity(step.rollTable) : null
        const resolvedEntities = !compact && renderEntityListing ? resolveSchemaEntities(step) : []
        const hasEntityListings = !!rollTableEntity || resolvedEntities.length > 0
        const isSidebarLayout =
          step.entityLayout === 'sidebar' && resolvedEntities.length > 0 && renderEntityListing
        const stepContent =
          hasEntityListings && step.content
            ? step.content.filter((block) => block.type !== 'hint')
            : step.content

        return (
          <div key={step.id} className="overflow-hidden bg-transparent">
            {step.section && (
              <Text
                variant="pseudoheader"
                className={cn(
                  'w-fit',
                  compact ? 'text-base px-0.5 py-[1px] mt-2' : 'text-2xl px-1 py-1 mt-4'
                )}
                style={{ backgroundColor: 'var(--color-su-black)', color: 'var(--color-su-white)' }}
              >
                {step.section}
              </Text>
            )}
            {!isSidebarLayout && (
              <div
                className={cn(
                  'flex flex-wrap items-center gap-2 bg-transparent',
                  compact ? 'py-1' : 'py-2'
                )}
              >
                <Text
                  variant="pseudoheader"
                  className={cn(
                    'w-fit',
                    compact ? 'text-sm px-0.5 py-[1px]' : 'text-xl px-1 py-0.5'
                  )}
                >
                  {stepNumbers[index]}. {step.name}
                </Text>
              </div>
            )}
            <div
              className={compact ? 'pl-2' : 'pl-3'}
              style={borderColor ? { borderLeft: `3px solid ${borderColor}` } : undefined}
            >
              {isSidebarLayout ? (
                <div className="flex flex-col md:flex-row gap-4 mt-1">
                  <div className="flex flex-col items-center md:flex-1 min-w-0">
                    {resolvedEntities.map(({ data, schemaName }, i) => (
                      <div key={(data as { id: string }).id} className="w-full">
                        {renderEntityListing(
                          data,
                          schemaName,
                          `${step.id}-${schemaName}-${(data as { id: string }).id}`,
                          true,
                          true
                        )}
                        {i < resolvedEntities.length - 1 && <SidebarArrow />}
                      </div>
                    ))}
                  </div>
                  {stepContent && stepContent.length > 0 && (
                    <div className="flex-1 min-w-0">
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
              ) : (
                <>
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
                  {rollTableEntity && renderEntityListing && (
                    <div className="mt-2">
                      {renderEntityListing(
                        rollTableEntity,
                        'roll-tables',
                        `${step.id}-roll-table-${rollTableEntity.id}`,
                        true
                      )}
                    </div>
                  )}
                  {resolvedEntities.length > 0 && renderEntityListing && (
                    <div
                      className={cn(
                        'grid gap-2 mt-2',
                        compact ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'
                      )}
                    >
                      {resolvedEntities.map(({ data, schemaName }) =>
                        renderEntityListing(
                          data,
                          schemaName,
                          `${step.id}-${schemaName}-${(data as { id: string }).id}`,
                          true
                        )
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
