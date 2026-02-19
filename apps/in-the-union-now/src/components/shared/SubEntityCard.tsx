import { useCallback } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { getParagraphString } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from 'suref-react'
import type { ChoiceInputRenderer } from 'suref-react'
import { hasModificationSlots } from '../../lib/entityModificationUtils'
import { useComradeChoices } from '../../hooks/useComradeChoices'
import { EntityModificationSlots } from './EntityModificationSlots'
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
}

export function SubEntityCard({
  entity,
  mechId,
  mechRefs,
  userId,
  readOnly,
  compact = true,
  hide,
}: SubEntityCardProps) {
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

  const showModSlots = !readOnly && mechId && mechRefs && userId && hasModificationSlots(entity)

  return (
    <ReferenceEntityDisplay
      data={entity}
      compact={compact}
      hide={{ footer: true, ...hide }}
      choiceInputRenderer={choiceInputRenderer}
      afterChoicesContent={
        showModSlots ? (
          <EntityModificationSlots
            entity={entity}
            mechId={mechId}
            mechRefs={mechRefs!}
            userId={userId}
            compact
            readOnly={readOnly}
          />
        ) : undefined
      }
    />
  )
}
