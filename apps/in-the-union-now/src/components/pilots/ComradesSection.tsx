import { useMemo } from 'react'
import type { SURefChassis, ItemCondition } from 'salvageunion-reference'
import { Text } from 'suref-react'
import { extractComrades } from '../../lib/comradeUtils'
import { SubEntityCard } from '../shared/SubEntityCard'
import type { EntityRefRow } from '../../types/common'

type ComradesSectionProps = {
  pilotRefs: EntityRefRow[]
  mechRefs: EntityRefRow[]
  mechChassis?: SURefChassis
  compact?: boolean
  mechId?: string
  userId?: string
  readOnly?: boolean
  onConditionChange?: (refId: string, condition: ItemCondition) => void
}

export function ComradesSection({
  pilotRefs,
  mechRefs,
  mechChassis,
  compact,
  mechId,
  userId,
  readOnly,
  onConditionChange,
}: ComradesSectionProps) {
  const comrades = useMemo(
    () => extractComrades(pilotRefs, mechRefs, mechChassis),
    [pilotRefs, mechRefs, mechChassis]
  )

  if (comrades.length === 0) return null

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {comrades.map((entry) => (
        <div key={entry.entity.id}>
          <Text className="mb-1 text-xs text-su-fg-muted">From {entry.sourceName}</Text>
          <SubEntityCard
            entity={entry.entity}
            mechId={mechId}
            mechRefs={mechRefs}
            userId={userId}
            readOnly={readOnly}
            compact
            onConditionChange={onConditionChange}
          />
        </div>
      ))}
    </div>
  )
}
