import { Link } from '@tanstack/react-router'
import { Cog } from 'lucide-react'
import { cn, ResourceBar } from 'suref-react'
import { getNameById } from 'salvageunion-reference'
import type { Mech } from '../../types/common'

type MechCardProps = {
  mech: Mech
}

export function MechCard({ mech }: MechCardProps) {
  return (
    <Link
      to="/mech/$id"
      params={{ id: mech.id }}
      className="group block rounded-xl border-2 border-mech/30 bg-[var(--card)] p-4 transition-all hover:border-mech hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-mech/20 text-mech">
          <Cog className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold leading-tight">{mech.name || 'Unnamed Mech'}</h3>
          {mech.chassis_ref && (
            <p className="text-xs text-su-grey-dark">{getNameById('chassis', mech.chassis_ref)}</p>
          )}
          <div className="mt-2 space-y-1">
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
      </div>
    </Link>
  )
}
