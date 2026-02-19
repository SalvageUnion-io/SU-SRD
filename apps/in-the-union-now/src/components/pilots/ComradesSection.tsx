import { useCallback, useMemo } from 'react'
import type { SURefChassis } from 'salvageunion-reference'
import { getParagraphString } from 'salvageunion-reference'
import { ReferenceEntityDisplay, Text } from 'suref-react'
import type { ChoiceInputRenderer } from 'suref-react'
import { extractComrades } from '../../lib/comradeUtils'
import { hasModificationSlots } from '../../lib/entityModificationUtils'
import { useComradeChoices } from '../../hooks/useComradeChoices'
import { EntityModificationSlots } from '../shared/EntityModificationSlots'
import { LabeledInput } from '../shared/LabeledInput'
import type { EntityRefRow } from '../../types/common'

type ComradesSectionProps = {
  pilotRefs: EntityRefRow[]
  mechRefs: EntityRefRow[]
  mechChassis?: SURefChassis
  compact?: boolean
  mechId?: string
  userId?: string
  readOnly?: boolean
}

export function ComradesSection({
  pilotRefs,
  mechRefs,
  mechChassis,
  compact,
  mechId,
  userId,
  readOnly,
}: ComradesSectionProps) {
  const comrades = useMemo(
    () => extractComrades(pilotRefs, mechRefs, mechChassis),
    [pilotRefs, mechRefs, mechChassis]
  )

  const { getLocalValue, setLocalValue, saveChoice } = useComradeChoices({
    mechId,
    userId,
    readOnly,
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

  if (comrades.length === 0) return null

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {comrades.map((entry) => (
        <div key={entry.entity.id}>
          <Text className="mb-1 text-xs text-su-fg-muted">From {entry.sourceName}</Text>
          <ReferenceEntityDisplay
            data={entry.entity}
            compact
            choiceInputRenderer={choiceInputRenderer}
            afterChoicesContent={
              !readOnly && mechId && userId && hasModificationSlots(entry.entity) ? (
                <EntityModificationSlots
                  entity={entry.entity}
                  mechId={mechId}
                  mechRefs={mechRefs}
                  userId={userId}
                  compact
                  readOnly={readOnly}
                />
              ) : undefined
            }
          />
        </div>
      ))}
    </div>
  )
}
