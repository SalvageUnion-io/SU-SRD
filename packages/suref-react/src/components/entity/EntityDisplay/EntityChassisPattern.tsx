import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefChassis, SURefModule, SURefSystem } from 'salvageunion-reference'
import { SheetDisplay } from '../../shared/SheetDisplay'
import { EntityDisplay } from './index'
import { Text } from '../../base/Text'
import { getParagraphString } from '../../../lib/contentBlockHelpers'

type EntityChassisPatternProps = {
  pattern: SURefChassis['patterns'][0]
  /** Drone entity name to resolve and render as header above drone equipment */
  droneEntityName?: string
}

export function EntityChassisPattern({ pattern, droneEntityName }: EntityChassisPatternProps) {
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

  const droneSystems = pattern.drone?.systems
    ? pattern.drone.systems.flatMap((name) => {
        const found = SalvageUnionReference.findIn('systems', (s) => s.name === name)
        return found ? [found] : []
      })
    : []

  const droneModules = pattern.drone?.modules
    ? pattern.drone.modules.flatMap((name) => {
        const found = SalvageUnionReference.findIn('modules', (m) => m.name === name)
        return found ? [found] : []
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
      {(pattern.source || pattern.page) && (
        <div className="flex items-center gap-2">
          {pattern.source && (
            <Text variant="pseudoheader" as="span" className="text-xs font-semibold uppercase">
              {pattern.source}
            </Text>
          )}
          {pattern.page && (
            <Text variant="pseudoheader" as="span" className="text-xs font-bold uppercase">
              Page {pattern.page}
            </Text>
          )}
        </div>
      )}
      <div className="pt-2" />

      {systems.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {systems.map((system, idx) => (
              <EntityDisplay
                key={`${system.entity.id}-${idx}`}
                data={system.entity}
                label={idx === 0 ? 'Systems' : undefined}
                compact
                listing
              />
            ))}
          </div>
        </div>
      )}
      {modules.length > 0 && systems.length > 0 && <div className="pt-4" />}
      {modules.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {modules.map((module, idx) => (
              <EntityDisplay
                key={`${module.entity.id}-${idx}`}
                data={module.entity}
                label={idx === 0 ? 'Modules' : undefined}
                compact
                listing
              />
            ))}
          </div>
        </div>
      )}
      {(droneSystems.length > 0 || droneModules.length > 0) &&
        (modules.length > 0 || systems.length > 0) && <div className="pt-4" />}
      {(droneSystems.length > 0 || droneModules.length > 0) && droneEntityName && (
        <DroneWithEquipment
          droneName={droneEntityName}
          droneSystems={droneSystems}
          droneModules={droneModules}
        />
      )}
    </div>
  )
}

function DroneWithEquipment({
  droneName,
  droneSystems,
  droneModules,
}: {
  droneName: string
  droneSystems: SURefSystem[]
  droneModules: SURefModule[]
}) {
  const droneEntity = SalvageUnionReference.findIn('drones', (d) => d.name === droneName)
  if (!droneEntity) return null

  return (
    <EntityDisplay data={droneEntity} compact hideActions hidePatterns listing>
      {droneSystems.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {droneSystems.map((system, idx) => (
              <EntityDisplay
                key={`drone-sys-${system.id}-${idx}`}
                data={system}
                label={idx === 0 ? 'Systems' : undefined}
                compact
                listing
              />
            ))}
          </div>
        </div>
      )}
      {droneModules.length > 0 && droneSystems.length > 0 && <div className="pt-4" />}
      {droneModules.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {droneModules.map((module, idx) => (
              <EntityDisplay
                key={`drone-mod-${module.id}-${idx}`}
                data={module}
                label={idx === 0 ? 'Modules' : undefined}
                compact
                listing
              />
            ))}
          </div>
        </div>
      )}
    </EntityDisplay>
  )
}
