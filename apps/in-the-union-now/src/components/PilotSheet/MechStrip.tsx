import { Cog, ChevronDown } from 'lucide-react'
import { ResourceStepper, HeatBar } from 'suref-react'
import { getNameById } from 'salvageunion-reference'
import type { Mech } from '../../types/common'

type MechStripProps = {
  mech: Mech
  allMechs: Mech[]
  onUpdate: (field: string, value: unknown) => void
  onSwitchMech: (mechId: string) => void
}

export function MechStrip({ mech, allMechs, onUpdate, onSwitchMech }: MechStripProps) {
  return (
    <div className="border-b-2 border-mech/30 bg-mech/5 px-4 py-3">
      {/* Mech name + switcher */}
      <div className="mb-2 flex items-center gap-2">
        <Cog className="h-4 w-4 text-mech" />
        <span className="text-sm font-bold">{mech.name || 'Unnamed Mech'}</span>
        {mech.chassis_ref && (
          <span className="text-xs text-su-grey-dark">
            ({getNameById('chassis', mech.chassis_ref)})
          </span>
        )}
        {allMechs.length > 1 && (
          <div className="relative ml-auto">
            <select
              value={mech.id}
              onChange={(e) => onSwitchMech(e.target.value)}
              className="appearance-none rounded border border-mech/30 bg-transparent py-0.5 pl-2 pr-6 text-xs"
            >
              {allMechs.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || (m.chassis_ref ? getNameById('chassis', m.chassis_ref) : 'Unnamed')}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2 text-su-grey" />
          </div>
        )}
      </div>

      {/* Mech resources */}
      <div className="flex flex-wrap gap-3">
        <ResourceStepper
          label="SP"
          current={mech.current_sp}
          max={mech.max_sp}
          onChange={(v) => onUpdate('current_sp', v)}
          colorClass="text-mech"
        />
        <ResourceStepper
          label="EP"
          current={mech.current_ep}
          max={mech.max_ep}
          onChange={(v) => onUpdate('current_ep', v)}
          colorClass="text-su-blue"
        />
      </div>
      <div className="mt-2">
        <HeatBar current={mech.current_heat} capacity={mech.heat_capacity} />
      </div>
    </div>
  )
}
