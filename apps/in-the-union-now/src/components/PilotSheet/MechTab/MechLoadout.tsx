import { useEntityRefs } from '../../../hooks/useEntityRefs'
import { InlineEdit, ConditionControl } from 'suref-react'
import type { Mech } from '../../../types/common'
import { useUpdateMech } from '../../../hooks/useMech'

type MechLoadoutProps = {
  mech: Mech
}

export function MechLoadout({ mech }: MechLoadoutProps) {
  const { data: refs = [] } = useEntityRefs('mech', mech.id)
  const updateMech = useUpdateMech(mech.id)

  const systems = refs.filter((r) => r.schema_name === 'systems')
  const modules = refs.filter((r) => r.schema_name === 'modules')

  return (
    <div className="space-y-6 p-4">
      {/* Chassis stats */}
      <div>
        <h3 className="mb-2 text-sm font-bold text-mech">Chassis Stats</h3>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-mech/10 p-2">
            <div className="font-bold">{mech.max_sp}</div>
            <div className="text-su-grey-dark">SP</div>
          </div>
          <div className="rounded-lg bg-mech/10 p-2">
            <div className="font-bold">{mech.max_ep}</div>
            <div className="text-su-grey-dark">EP</div>
          </div>
          <div className="rounded-lg bg-mech/10 p-2">
            <div className="font-bold">{mech.heat_capacity}</div>
            <div className="text-su-grey-dark">Heat Cap</div>
          </div>
        </div>
      </div>

      {/* Quirk + Appearance */}
      <div className="space-y-2">
        <div>
          <label className="text-xs font-medium text-su-grey-dark">Quirk</label>
          <InlineEdit
            value={mech.quirk}
            onSave={(v) => updateMech.mutate({ quirk: v })}
            placeholder="Mech quirk..."
            className="text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-su-grey-dark">Appearance</label>
          <InlineEdit
            value={mech.appearance}
            onSave={(v) => updateMech.mutate({ appearance: v })}
            placeholder="Mech appearance..."
            className="text-sm"
            multiline
          />
        </div>
      </div>

      {/* Systems */}
      <div>
        <h3 className="mb-2 text-sm font-bold text-mech">Systems ({systems.length})</h3>
        {systems.length === 0 ? (
          <p className="text-xs italic text-su-grey">No systems equipped</p>
        ) : (
          <div className="space-y-2">
            {systems.map((sys) => (
              <div
                key={sys.id}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2"
              >
                <span className="text-sm">{sys.schema_ref_id}</span>
                <ConditionControl condition={sys.condition} onChange={() => {}} compact />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modules */}
      <div>
        <h3 className="mb-2 text-sm font-bold text-mech">Modules ({modules.length})</h3>
        {modules.length === 0 ? (
          <p className="text-xs italic text-su-grey">No modules equipped</p>
        ) : (
          <div className="space-y-2">
            {modules.map((mod) => (
              <div
                key={mod.id}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2"
              >
                <span className="text-sm">{mod.schema_ref_id}</span>
                <ConditionControl condition={mod.condition} onChange={() => {}} compact />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
