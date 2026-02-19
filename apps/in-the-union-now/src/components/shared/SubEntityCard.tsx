import { useCallback, useMemo } from 'react'
import type { SURefEntity, ItemCondition } from 'salvageunion-reference'
import {
  getParagraphString,
  SalvageUnionReference,
  getEnergyPoints,
  getHeatCapacity,
} from 'salvageunion-reference'
import { ReferenceEntityDisplay, SectionSeparator, ENTITY_STATS_CONFIG } from 'suref-react'
import type { ChoiceInputRenderer, StatItem } from 'suref-react'
import { hasModificationSlots } from '../../lib/entityModificationUtils'
import { useComradeChoices } from '../../hooks/useComradeChoices'
import { EntityModificationSlots } from './EntityModificationSlots'
import { ReferenceEntityListingItem } from './ReferenceEntityListingItem'
import { makeConditionControl } from './ConditionToggle'
import { LabeledInput } from './LabeledInput'
import type { EntityRefRow } from '../../types/common'

type SubEntityCardProps = {
  entity: SURefEntity
  mechId?: string
  mechRefs?: EntityRefRow[]
  userId?: string
  readOnly?: boolean
  compact?: boolean
  hide?: {
    actions?: boolean
    patterns?: boolean
    stats?: boolean
    content?: boolean
  }
  onConditionChange?: (refId: string, condition: ItemCondition) => void
}

export function SubEntityCard({
  entity,
  mechId,
  mechRefs,
  userId,
  readOnly,
  compact = true,
  hide,
  onConditionChange,
}: SubEntityCardProps) {
  const { getLocalValue, setLocalValue, saveChoice, saveStat } = useComradeChoices({
    mechId,
    userId,
    readOnly: false, // Always allow condition tracking, even if readOnly for other inputs
  })

  const isInputDisabled = !mechId || !userId || readOnly

  const choiceInputRenderer: ChoiceInputRenderer = useCallback(
    (choice, isCompact) => {
      const choiceId = choice.id ?? ''
      const placeholder = getParagraphString(choice.content) || 'Enter value...'
      const hasRollTable = 'rollTable' in choice && !!choice.rollTable

      return (
        <LabeledInput
          key={choiceId}
          label={choice.name}
          value={getLocalValue(choiceId)}
          onChange={(val) => setLocalValue(choiceId, val)}
          onBlur={() => saveChoice(choice, getLocalValue(choiceId))}
          placeholder={placeholder}
          variant={hasRollTable ? 'roll' : 'input'}
          rollTableName={hasRollTable ? choice.rollTable : undefined}
          compact={isCompact}
          readOnly={isInputDisabled}
        />
      )
    },
    [getLocalValue, setLocalValue, saveChoice, isInputDisabled]
  )

  const showModSlots = !!mechId && !!mechRefs && hasModificationSlots(entity)

  // Resolve built-in integrated systems for condition tracking
  const integratedSystems = useMemo(() => {
    if (!('systems' in entity) || !Array.isArray(entity.systems)) return []
    const names = entity.systems as string[]
    return names
      .map((name) => SalvageUnionReference.Systems.find((s) => s.name === name))
      .filter((s): s is NonNullable<typeof s> => s != null)
  }, [entity])

  const hasIntegratedSystems = integratedSystems.length > 0
  const canTrackCondition = !!mechId && !!userId

  // Build interactive stats (SP/EP/Heat with +/- controls) when tracking is available
  const interactiveStats = useMemo((): StatItem[] | undefined => {
    if (!canTrackCondition || hide?.stats) return undefined

    const items: StatItem[] = []
    for (let i = 0; i < ENTITY_STATS_CONFIG.length; i++) {
      const config = ENTITY_STATS_CONFIG[i]!
      const value = config.getter(entity)
      if (value === undefined || value === 0) continue

      const isEP = config.getter === getEnergyPoints
      const isHeat = config.getter === getHeatCapacity
      const isTrackable = isEP || isHeat

      if (isTrackable) {
        const statKey = isEP ? 'ep' : 'heat'
        const choiceKey = `stat:${statKey}:${entity.id}`
        // EP defaults to max, Heat defaults to 0
        const defaultValue = isHeat ? 0 : value
        const stored = getLocalValue(choiceKey)
        const current = stored !== '' ? Number(stored) : defaultValue

        items.push({
          key: `interactive-stat-${i}`,
          label: compact ? config.compactLabel : config.normalLabel,
          bottomLabel: compact ? config.compactBottomLabel : config.normalBottomLabel,
          value: current,
          outOfMax: value,
          hoverText: config.tooltip,
          onChange: (newValue: number) => {
            const clamped = Math.max(0, Math.min(newValue, value))
            setLocalValue(choiceKey, String(clamped))
            saveStat(choiceKey, String(clamped))
          },
          canEdit: !readOnly,
        })
      } else {
        items.push({
          key: `ref-stat-${i}`,
          label: compact ? config.compactLabel : config.normalLabel,
          bottomLabel: compact ? config.compactBottomLabel : config.normalBottomLabel,
          value: `${value}`,
          hoverText: config.tooltip,
        })
      }
    }

    return items.length > 0 ? items : undefined
  }, [
    canTrackCondition,
    hide?.stats,
    entity,
    compact,
    getLocalValue,
    setLocalValue,
    saveStat,
    readOnly,
  ])

  return (
    <ReferenceEntityDisplay
      data={entity}
      compact={compact}
      hide={{ footer: true, ...hide, integratedSystems: hasIntegratedSystems && canTrackCondition }}
      choiceInputRenderer={choiceInputRenderer}
      stats={interactiveStats}
      afterChoicesContent={
        showModSlots || (hasIntegratedSystems && canTrackCondition) ? (
          <>
            {showModSlots && (
              <EntityModificationSlots
                entity={entity}
                mechId={mechId}
                mechRefs={mechRefs}
                userId={userId}
                compact
                readOnly={readOnly}
                onConditionChange={onConditionChange}
              />
            )}
            {hasIntegratedSystems && canTrackCondition && (
              <IntegratedSystemsWithCondition
                systems={integratedSystems}
                compact={compact}
                getLocalValue={getLocalValue}
                setLocalValue={setLocalValue}
                saveStat={saveStat}
              />
            )}
          </>
        ) : undefined
      }
    />
  )
}

function IntegratedSystemsWithCondition({
  systems,
  compact,
  getLocalValue,
  setLocalValue,
  saveStat,
}: {
  systems: SURefEntity[]
  compact: boolean
  getLocalValue: (choiceId: string) => string
  setLocalValue: (choiceId: string, value: string) => void
  saveStat: (choiceId: string, value: string) => void
}) {
  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <SectionSeparator label="Integrated Systems" compact={compact} />
      {systems.map((system) => {
        const choiceKey = `condition:builtin:${system.id}`
        const stored = getLocalValue(choiceKey)
        const condition: ItemCondition =
          stored === 'damaged' || stored === 'destroyed' ? stored : 'intact'

        const handleChange = (next: ItemCondition) => {
          setLocalValue(choiceKey, next)
          saveStat(choiceKey, next)
        }

        return (
          <ReferenceEntityListingItem
            key={system.id}
            entity={system}
            disabled={condition === 'destroyed'}
            damaged={condition !== 'intact'}
            showDetailButton
            controls={[makeConditionControl(condition, handleChange)]}
          />
        )
      })}
    </div>
  )
}
