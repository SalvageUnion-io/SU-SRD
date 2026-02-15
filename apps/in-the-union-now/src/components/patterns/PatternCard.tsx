import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { SalvageUnionReference } from 'salvageunion-reference'
import { DisplayCard } from 'suref-react'
import type { TypedPatternRow } from '../../types/common'

type PatternCardProps = {
  pattern: TypedPatternRow
}

export function PatternCard({ pattern }: PatternCardProps) {
  const chassis = useMemo(
    () => SalvageUnionReference.Chassis.find((c) => c.id === pattern.chassis_ref),
    [pattern.chassis_ref]
  )

  const systemCount = pattern.pattern_items.filter((i) => i.schema_name === 'systems').length
  const moduleCount = pattern.pattern_items.filter((i) => i.schema_name === 'modules').length

  return (
    <Link to="/patterns/$patternId" params={{ patternId: pattern.id }} className="block">
      <DisplayCard
        mode="compact"
        headerBg="bg-su-green"
        headerContent={<span className="px-2 text-sm font-bold text-su-white">{pattern.name}</span>}
      >
        <div className="flex flex-col gap-1 p-2 text-xs text-su-grey-dark">
          <span>{chassis?.name ?? 'Unknown chassis'}</span>
          <span>
            {systemCount} system{systemCount !== 1 ? 's' : ''} &middot; {moduleCount} module
            {moduleCount !== 1 ? 's' : ''}
          </span>
        </div>
      </DisplayCard>
    </Link>
  )
}
