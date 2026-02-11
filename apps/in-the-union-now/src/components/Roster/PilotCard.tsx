import { Link } from '@tanstack/react-router'
import { User, Cog } from 'lucide-react'
import { cn, ResourceBar } from 'suref-react'
import { getNameById } from 'salvageunion-reference'
import type { PilotWithActiveMech } from '../../types/common'

type PilotCardProps = {
  pilot: PilotWithActiveMech
}

export function PilotCard({ pilot }: PilotCardProps) {
  const mech = pilot.active_mech

  return (
    <Link
      to="/pilot/$id"
      params={{ id: pilot.id }}
      className="group block rounded-xl border-2 border-pilot/30 bg-[var(--card)] p-4 transition-all hover:border-pilot hover:shadow-md"
    >
      {/* Pilot header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pilot/20 text-pilot">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold leading-tight">{pilot.callsign || 'Unnamed Pilot'}</h3>
            {pilot.class_ref && (
              <p className="text-xs text-su-grey-dark">{getNameById('classes', pilot.class_ref)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Pilot resources */}
      <div className="mb-3 space-y-1">
        <ResourceBar
          label="HP"
          current={pilot.current_hp}
          max={pilot.max_hp}
          colorClass="bg-pilot"
          compact
        />
        <div className="flex gap-4 text-xs">
          <span>
            AP:{' '}
            <span className="font-bold">
              {pilot.current_ap}/{pilot.max_ap}
            </span>
          </span>
          <span>
            TP: <span className="font-bold">{pilot.current_tp}</span>
          </span>
        </div>
      </div>

      {/* Active mech strip */}
      {mech && (
        <div className="rounded-lg border border-mech/30 bg-mech/5 p-2">
          <div className="mb-1 flex items-center gap-2">
            <Cog className="h-3.5 w-3.5 text-mech" />
            <span className="text-xs font-medium">
              {mech.name || 'Unnamed Mech'}
              {mech.chassis_ref && (
                <span className="ml-1 text-su-grey-dark">
                  ({getNameById('chassis', mech.chassis_ref)})
                </span>
              )}
            </span>
          </div>
          <div className="space-y-0.5">
            <ResourceBar
              label="SP"
              current={mech.current_sp}
              max={mech.max_sp}
              colorClass="bg-mech"
              compact
            />
            <div className="flex gap-3 text-xs">
              <span>
                EP:{' '}
                <span className="font-bold">
                  {mech.current_ep}/{mech.max_ep}
                </span>
              </span>
              <span
                className={cn(
                  mech.heat_capacity > 0 && mech.current_heat / mech.heat_capacity > 0.75
                    ? 'text-heat-critical'
                    : ''
                )}
              >
                HT:{' '}
                <span className="font-bold">
                  {mech.current_heat}/{mech.heat_capacity}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}

      {!mech && <p className="text-xs italic text-su-grey">No active mech</p>}
    </Link>
  )
}
