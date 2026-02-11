import { User } from 'lucide-react'
import { ResourceStepper, InlineEdit } from 'suref-react'
import { getNameById } from 'salvageunion-reference'
import type { Pilot } from '../../types/common'

type PilotHeaderProps = {
  pilot: Pilot
  onUpdate: (field: string, value: unknown) => void
}

export function PilotHeader({ pilot, onUpdate }: PilotHeaderProps) {
  return (
    <div className="border-b-2 border-pilot/30 bg-pilot/5 px-4 py-3">
      {/* Name + class row */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pilot/20 text-pilot">
          <User className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <InlineEdit
            value={pilot.callsign}
            onSave={(v) => onUpdate('callsign', v)}
            placeholder="Callsign..."
            className="text-lg font-bold"
          />
          {pilot.class_ref && (
            <p className="text-xs text-su-grey-dark">{getNameById('classes', pilot.class_ref)}</p>
          )}
        </div>
      </div>

      {/* Resource steppers */}
      <div className="flex flex-wrap gap-3">
        <ResourceStepper
          label="HP"
          current={pilot.current_hp}
          max={pilot.max_hp}
          onChange={(v) => onUpdate('current_hp', v)}
          colorClass="text-pilot"
        />
        <ResourceStepper
          label="AP"
          current={pilot.current_ap}
          max={pilot.max_ap}
          onChange={(v) => onUpdate('current_ap', v)}
          colorClass="text-su-blue"
        />
        <ResourceStepper
          label="TP"
          current={pilot.current_tp}
          onChange={(v) => onUpdate('current_tp', v)}
          colorClass="text-su-grey-dark"
        />
      </div>
    </div>
  )
}
