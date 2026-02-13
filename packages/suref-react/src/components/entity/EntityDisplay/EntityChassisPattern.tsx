import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefChassis, SURefModule, SURefSystem } from 'salvageunion-reference'
import { SheetDisplay } from '../../shared/SheetDisplay'
import { EntityDisplay } from './index'
import { getParagraphString } from '../../../lib/contentBlockHelpers'

type EntityChassisPatternProps = {
  pattern: SURefChassis['patterns'][0]
}

export function EntityChassisPattern({ pattern }: EntityChassisPatternProps) {
  const systems = pattern.systems
    ? pattern.systems.flatMap((system) => {
        const found = SalvageUnionReference.findIn('systems', (s) => s.name === system.name)
        if (!found) return []
        const count = 'count' in system && typeof system.count === 'number' ? system.count : 1
        const preselectedChoices =
          'preselectedChoices' in system && system.preselectedChoices
            ? system.preselectedChoices
            : undefined
        return Array(count).fill({ entity: found, preselectedChoices }) as Array<{
          entity: SURefSystem
          preselectedChoices?: Record<string, string>
        }>
      })
    : []

  const modules = pattern.modules
    ? pattern.modules.flatMap((module) => {
        const found = SalvageUnionReference.findIn('modules', (m) => m.name === module.name)
        if (!found) return []
        const count = 'count' in module && typeof module.count === 'number' ? module.count : 1
        const preselectedChoices =
          'preselectedChoices' in module && module.preselectedChoices
            ? module.preselectedChoices
            : undefined
        return Array(count).fill({ entity: found, preselectedChoices }) as Array<{
          entity: SURefModule
          preselectedChoices?: Record<string, string>
        }>
      })
    : []

  const isLegalStarting = 'legalStarting' in pattern && pattern.legalStarting

  return (
    <div className="space-y-4 px-2">
      {isLegalStarting && (
        <div className="bg-su-green px-4 py-2 text-center font-bold text-su-white">
          LEGAL STARTING PATTERN
        </div>
      )}

      <SheetDisplay compact={false}>{getParagraphString(pattern.content)}</SheetDisplay>

      <div className="space-y-2">
        {systems.map((system, idx) => (
          <EntityDisplay
            key={`${system.entity.id}-${idx}`}
            data={system.entity}
            label={idx === 0 ? 'Systems' : undefined}
            compact
            userChoices={system.preselectedChoices}
            collapsible
          />
        ))}
        {modules.length > 0 && systems.length > 0 && <div className="pt-4" />}
        {modules.map((module, idx) => (
          <EntityDisplay
            key={`${module.entity.id}-${idx}`}
            data={module.entity}
            label={idx === 0 ? 'Modules' : undefined}
            compact
            userChoices={module.preselectedChoices}
            collapsible
          />
        ))}
      </div>
    </div>
  )
}
