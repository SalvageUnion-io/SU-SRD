import { InlineEdit } from 'suref-react'
import { getNameById } from 'salvageunion-reference'
import { useEntityRefs } from '../../../hooks/useEntityRefs'
import type { Pilot } from '../../../types/common'

type BuildViewProps = {
  pilot: Pilot
  onUpdate: (field: string, value: unknown) => void
}

export function BuildView({ pilot, onUpdate }: BuildViewProps) {
  const { data: refs = [] } = useEntityRefs('pilot', pilot.id)
  const abilities = refs.filter((r) => r.schema_name === 'abilities')
  const equipment = refs.filter((r) => r.schema_name === 'equipment')

  return (
    <div className="space-y-6 p-4">
      {/* Class */}
      <div>
        <h3 className="mb-2 text-sm font-bold text-pilot">Class</h3>
        <p>{pilot.class_ref ? getNameById('classes', pilot.class_ref) : 'No class selected'}</p>
      </div>

      {/* Abilities */}
      <div>
        <h3 className="mb-2 text-sm font-bold text-pilot">Abilities ({abilities.length})</h3>
        {abilities.length === 0 ? (
          <p className="text-xs italic text-su-grey">No abilities selected</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {abilities.map((ab) => (
              <div key={ab.id} className="rounded-lg border border-pilot/30 px-3 py-2 text-sm">
                {ab.schema_ref_id}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Equipment */}
      <div>
        <h3 className="mb-2 text-sm font-bold text-pilot">Equipment ({equipment.length})</h3>
        {equipment.length === 0 ? (
          <p className="text-xs italic text-su-grey">No equipment</p>
        ) : (
          <div className="space-y-1">
            {equipment.map((eq) => (
              <div key={eq.id} className="text-sm">
                {eq.schema_ref_id}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Personal Info */}
      <div>
        <h3 className="mb-2 text-sm font-bold text-pilot">Personal Info</h3>
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-su-grey-dark">Background</label>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={pilot.background_used}
                  onChange={(e) => onUpdate('background_used', e.target.checked)}
                  className="h-3 w-3 accent-pilot"
                />
                Used
              </label>
            </div>
            <InlineEdit
              value={pilot.background}
              onSave={(v) => onUpdate('background', v)}
              placeholder="Background..."
              multiline
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-su-grey-dark">Keepsake</label>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={pilot.keepsake_used}
                  onChange={(e) => onUpdate('keepsake_used', e.target.checked)}
                  className="h-3 w-3 accent-pilot"
                />
                Used
              </label>
            </div>
            <InlineEdit
              value={pilot.keepsake}
              onSave={(v) => onUpdate('keepsake', v)}
              placeholder="Keepsake..."
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-su-grey-dark">Motto</label>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={pilot.motto_used}
                  onChange={(e) => onUpdate('motto_used', e.target.checked)}
                  className="h-3 w-3 accent-pilot"
                />
                Used
              </label>
            </div>
            <InlineEdit
              value={pilot.motto}
              onSave={(v) => onUpdate('motto', v)}
              placeholder="Motto..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-su-grey-dark">Appearance</label>
            <InlineEdit
              value={pilot.appearance}
              onSave={(v) => onUpdate('appearance', v)}
              placeholder="Appearance..."
              multiline
            />
          </div>
          <div>
            <label className="text-xs font-medium text-su-grey-dark">Notes</label>
            <InlineEdit
              value={pilot.notes}
              onSave={(v) => onUpdate('notes', v)}
              placeholder="Notes..."
              multiline
            />
          </div>
        </div>
      </div>
    </div>
  )
}
