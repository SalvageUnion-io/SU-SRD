import { useMemo, useState, useRef, useEffect } from 'react'
import type { SURefEntity, ItemCondition } from 'salvageunion-reference'
import {
  getEnergyPoints,
  getHeatCapacity,
  getChoices,
  getDisplayName,
} from 'salvageunion-reference'
import type { SURefEnumSchemaName } from 'salvageunion-reference'
import { ReferenceEntityDisplay, ENTITY_STATS_CONFIG, ValueDisplay, Text } from 'suref-react'
import type { StatItem } from 'suref-react'
import { hasModificationSlots } from '../../lib/entityModificationUtils'
import { useComradeChoices } from '../../hooks/useComradeChoices'
import { EntityModificationSlots } from './EntityModificationSlots'
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
  headerBgColor?: string
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
  headerBgColor,
}: SubEntityCardProps) {
  const { getLocalValue, setLocalValue, saveChoice, saveStat } = useComradeChoices({
    mechId,
    userId,
    readOnly: false, // Always allow condition tracking, even if readOnly for other inputs
  })

  const isInputDisabled = !mechId || !userId || readOnly

  // Detect "Name" choice for dynamic comrade naming
  const choices = useMemo(() => getChoices(entity), [entity])
  const nameChoice = useMemo(() => choices?.find((c) => c.name === 'Name'), [choices])
  const customName = nameChoice ? getLocalValue(nameChoice.id) : ''
  const entityName = 'name' in entity ? String(entity.name) : ''
  const schemaName = 'schemaName' in entity ? (entity.schemaName as SURefEnumSchemaName) : undefined

  const showModSlots = !!mechId && !!mechRefs && hasModificationSlots(entity)
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

  // Build title slot and subtitle extra when entity has a "Name" choice
  const titleSlot = nameChoice ? (
    isInputDisabled ? (
      customName ? (
        <div className={compact ? '' : 'overflow-hidden text-ellipsis whitespace-nowrap'}>
          <Text
            variant="pseudoheader"
            as="span"
            className={`relative z-10 uppercase tracking-[-0.02em] transition-transform duration-300 ${compact ? 'py-[3px] text-base' : 'text-[1.75rem]'}`}
            style={compact ? { lineHeight: 1 } : undefined}
          >
            {customName}
          </Text>
        </div>
      ) : undefined
    ) : (
      <ComradeNameInput
        value={customName}
        placeholder={entityName}
        compact={compact}
        onChange={(val) => setLocalValue(nameChoice.id, val)}
        onBlur={() => saveChoice(nameChoice, getLocalValue(nameChoice.id))}
      />
    )
  ) : undefined

  const subtitleExtra =
    nameChoice && schemaName ? (
      <ValueDisplay label={getDisplayName(schemaName)} value={entityName} compact={compact} />
    ) : undefined

  return (
    <ReferenceEntityDisplay
      data={entity}
      compact={compact}
      hide={{ footer: true, ...hide }}
      stats={interactiveStats}
      titleOverride={nameChoice && customName ? customName : undefined}
      titleSlot={titleSlot}
      subtitleExtra={subtitleExtra}
      headerBgColor={headerBgColor}
      afterChoicesContent={
        showModSlots ? (
          <EntityModificationSlots
            entity={entity}
            mechId={mechId}
            mechRefs={mechRefs}
            userId={userId}
            compact
            readOnly={readOnly}
            onConditionChange={onConditionChange}
          />
        ) : undefined
      }
    />
  )
}

function ComradeNameInput({
  value,
  placeholder,
  onChange,
  onBlur,
  compact,
}: {
  value: string
  placeholder: string
  onChange: (value: string) => void
  onBlur: () => void
  compact?: boolean
}) {
  const measureRef = useRef<HTMLSpanElement>(null)
  const [inputWidth, setInputWidth] = useState(0)

  useEffect(() => {
    if (measureRef.current) {
      setInputWidth(measureRef.current.scrollWidth)
    }
  }, [value, placeholder])

  const fontClass = compact ? 'text-base' : 'text-[1.75rem]'

  return (
    <span className="relative inline-flex items-baseline">
      {/* Hidden measuring span — mirrors input font to get content width */}
      <span
        ref={measureRef}
        aria-hidden
        className={`pointer-events-none invisible absolute whitespace-pre font-mono ${fontClass} font-bold uppercase leading-none tracking-tight`}
      >
        {value || placeholder}
      </span>
      <Text
        variant="pseudoheader"
        as="span"
        className={`inline-flex items-center ${fontClass}`}
        style={compact ? { lineHeight: 1 } : undefined}
      >
        <input
          type="text"
          size={1}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={`border-none bg-transparent p-0 font-mono ${fontClass} font-bold uppercase leading-none tracking-tight text-su-white outline-none placeholder:text-su-white/50`}
          style={{ width: inputWidth || undefined }}
        />
      </Text>
    </span>
  )
}
