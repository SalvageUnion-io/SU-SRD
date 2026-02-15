import { resolveFormationMember, normalizePatternName, getFormation } from 'salvageunion-reference'
import type { SURefMetaEntity } from 'salvageunion-reference'
import { EntityDisplay } from './index'
import { Text } from '../../base/Text'
import { cn } from '../../../utils/cn'

type EntityFormationProps = {
  data: SURefMetaEntity
  headerFontSize?: string
  compact?: boolean
}

export function EntityFormation({ data, headerFontSize, compact = false }: EntityFormationProps) {
  const formation = getFormation(data)
  if (!formation || formation.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-su-grey-light" aria-hidden="true" />
        <Text variant="pseudoheader" className={cn(headerFontSize ?? 'text-lg')}>
          Formation
        </Text>
        <div className="h-px flex-1 bg-su-grey-light" aria-hidden="true" />
      </div>
      <div className={cn('grid grid-cols-1 gap-2', !compact && 'lg:grid-cols-2')}>
        {formation.flatMap((mech, mechIdx) => {
          const count = mech.quantity ?? 1
          const resolved = resolveFormationMember(mech)
          return Array.from({ length: count }, (_, copyIdx) => {
            if (!resolved) {
              return (
                <div key={`${mechIdx}-${copyIdx}`} className="rounded border p-2 text-sm">
                  {mech.chassis}
                  {mech.pattern && <> &mdash; {mech.pattern}</>} (p.{mech.page})
                </div>
              )
            }
            const patternOverride = resolved.pattern
              ? {
                  name: normalizePatternName(resolved.pattern.name),
                  systems: resolved.pattern.systems,
                  modules: resolved.pattern.modules,
                }
              : undefined
            return (
              <EntityDisplay
                key={`${resolved.entity.id}-${mechIdx}-${copyIdx}`}
                data={resolved.entity}
                compact
                listing
                patternOverride={patternOverride}
              />
            )
          })
        })}
      </div>
    </div>
  )
}
