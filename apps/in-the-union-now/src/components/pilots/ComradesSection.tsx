import type { ItemCondition } from 'salvageunion-reference'
import { Text } from 'suref-react'
import type { ComradeEntry } from '../../lib/comradeUtils'
import { SubEntityCard } from '../shared/SubEntityCard'
import type { EntityRefRow } from '../../types/common'

type ComradesSectionProps = {
  comrades: ComradeEntry[]
  mechRefs: EntityRefRow[]
  mechId?: string
  userId?: string
  readOnly?: boolean
  onConditionChange?: (refId: string, condition: ItemCondition) => void
}

export function ComradesSection({
  comrades,
  mechRefs,
  mechId,
  userId,
  readOnly,
  onConditionChange,
}: ComradesSectionProps) {
  if (comrades.length === 0) return null

  return (
    <div className="space-y-3">
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
