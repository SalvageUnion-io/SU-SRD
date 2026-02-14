import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useRef, useState } from 'react'
import { ArrowLeft, Cog, Minus, Plus, Package, Trash2 } from 'lucide-react'
import { useMech, useUpdateMech } from '../../hooks/useMech'
import { useEntityRefs, useUpdateEntityRef } from '../../hooks/useEntityRefs'
import { useCargo, useCreateCargoItem, useDeleteCargoItem } from '../../hooks/useCargo'
import {
  ResourceStepper,
  InlineEdit,
  HeatBar,
  ConditionControl,
  DEBOUNCE_TIMINGS,
} from 'suref-react'
import { getNameById } from 'salvageunion-reference'
import { DiceRollFAB } from '../../components/shared/DiceRollFAB'
import { DiceRollSheet } from '../../components/shared/DiceRollSheet'
import type { ItemCondition } from '../../types/common'
import type { UpdateMechInput } from '../../lib/validation'

export const Route = createFileRoute('/_authenticated/mech/$id')({
  component: MechSheetPage,
})

function MechSheetPage() {
  const { id } = Route.useParams()
  const { data: mech, isLoading } = useMech(id)
  const updateMech = useUpdateMech(id)
  const { data: refs = [] } = useEntityRefs('mech', id)
  const updateEntityRef = useUpdateEntityRef('mech', id)
  const { data: cargo = [] } = useCargo('mech', id)
  const createCargoItem = useCreateCargoItem('mech', id)
  const deleteCargoItem = useDeleteCargoItem('mech', id)

  const [newCargoName, setNewCargoName] = useState('')

  // Debounced mech update
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const handleUpdate = useCallback(
    <K extends keyof UpdateMechInput>(field: K, value: UpdateMechInput[K]) => {
      clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        updateMech.mutate({ [field]: value } as UpdateMechInput)
      }, DEBOUNCE_TIMINGS.autoSave)
    },
    [updateMech]
  )

  // Immediate update (for steppers - no debounce needed since user clicks discretely)
  const handleImmediateUpdate = useCallback(
    <K extends keyof UpdateMechInput>(field: K, value: UpdateMechInput[K]) => {
      updateMech.mutate({ [field]: value } as UpdateMechInput)
    },
    [updateMech]
  )

  const handleConditionChange = useCallback(
    (refId: string, condition: ItemCondition) => {
      updateEntityRef.mutate({ id: refId, input: { condition } })
    },
    [updateEntityRef]
  )

  const handleHeatChange = useCallback(
    (newHeat: number) => {
      updateMech.mutate({ current_heat: newHeat })
    },
    [updateMech]
  )

  const handleAddCargo = () => {
    const name = newCargoName.trim()
    if (!name) return
    createCargoItem.mutate({ name, amount: 1 })
    setNewCargoName('')
  }

  const systems = refs.filter((r) => r.schema_name === 'systems')
  const modules = refs.filter((r) => r.schema_name === 'modules')

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-mech border-t-transparent" />
      </div>
    )
  }

  if (!mech) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <p className="text-su-grey">Mech not found</p>
        <Link to="/" className="text-mech underline">
          Back to roster
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col pb-24">
      {/* Back nav */}
      <div className="flex items-center gap-2 px-4 py-2">
        <Link to="/" className="flex items-center gap-1 text-sm text-su-grey-dark hover:text-mech">
          <ArrowLeft className="h-4 w-4" />
          Roster
        </Link>
      </div>

      {/* Mech header */}
      <div className="border-b-2 border-mech/30 bg-mech/5 px-4 py-3">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mech/20 text-mech">
            <Cog className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <InlineEdit
              value={mech.name}
              onSave={(v) => handleUpdate('name', v)}
              placeholder="Mech name..."
              className="text-lg font-bold"
            />
            {mech.chassis_ref && (
              <p className="text-xs text-su-grey-dark">
                {getNameById('chassis', mech.chassis_ref)}
              </p>
            )}
            {mech.pattern_name && (
              <p className="text-xs text-su-grey-dark">Pattern: {mech.pattern_name}</p>
            )}
          </div>
        </div>

        {/* Resource tracking */}
        <div className="flex flex-wrap gap-3">
          <ResourceStepper
            label="SP"
            current={mech.current_sp}
            max={mech.max_sp}
            onChange={(v) => handleImmediateUpdate('current_sp', v)}
            colorClass="text-mech"
          />
          <ResourceStepper
            label="EP"
            current={mech.current_ep}
            max={mech.max_ep}
            onChange={(v) => handleImmediateUpdate('current_ep', v)}
            colorClass="text-su-blue"
          />
        </div>

        {/* Heat bar with +/- controls */}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() =>
              handleImmediateUpdate('current_heat', Math.max(0, mech.current_heat - 1))
            }
            disabled={mech.current_heat <= 0}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--border)] transition-colors hover:bg-su-grey-light/20 disabled:opacity-30"
            aria-label="Decrease heat"
          >
            <Minus className="h-3 w-3" />
          </button>
          <div className="flex-1">
            <HeatBar current={mech.current_heat} capacity={mech.heat_capacity} />
          </div>
          <button
            onClick={() =>
              handleImmediateUpdate(
                'current_heat',
                Math.min(mech.heat_capacity, mech.current_heat + 1)
              )
            }
            disabled={mech.current_heat >= mech.heat_capacity}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--border)] transition-colors hover:bg-su-grey-light/20 disabled:opacity-30"
            aria-label="Increase heat"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Chassis stats grid */}
      <div className="px-4 py-4">
        <h3 className="mb-2 text-sm font-bold text-mech">Chassis Stats</h3>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-mech/10 p-2">
            <div className="text-lg font-bold">{mech.max_sp}</div>
            <div className="text-su-grey-dark">Max SP</div>
          </div>
          <div className="rounded-lg bg-mech/10 p-2">
            <div className="text-lg font-bold">{mech.max_ep}</div>
            <div className="text-su-grey-dark">Max EP</div>
          </div>
          <div className="rounded-lg bg-mech/10 p-2">
            <div className="text-lg font-bold">{mech.heat_capacity}</div>
            <div className="text-su-grey-dark">Heat Cap</div>
          </div>
        </div>
      </div>

      {/* Quirk + Appearance */}
      <div className="space-y-3 px-4">
        <div>
          <span className="text-xs font-medium text-su-grey-dark">Quirk</span>
          <InlineEdit
            value={mech.quirk}
            onSave={(v) => handleUpdate('quirk', v)}
            placeholder="Mech quirk..."
            className="text-sm"
          />
        </div>
        <div>
          <span className="text-xs font-medium text-su-grey-dark">Appearance</span>
          <InlineEdit
            value={mech.appearance}
            onSave={(v) => handleUpdate('appearance', v)}
            placeholder="Mech appearance..."
            className="text-sm"
            multiline
          />
        </div>
      </div>

      {/* Systems */}
      <div className="px-4 pt-6">
        <h3 className="mb-2 text-sm font-bold text-mech">Systems ({systems.length})</h3>
        {systems.length === 0 ? (
          <p className="text-xs italic text-su-grey">No systems equipped</p>
        ) : (
          <div className="space-y-2">
            {systems.map((sys) => (
              <div
                key={sys.id}
                className="flex items-center justify-between rounded-lg border border-mech/30 bg-mech/5 px-3 py-2"
              >
                <span className="text-sm">{sys.schema_ref_id}</span>
                <ConditionControl
                  condition={sys.condition as ItemCondition}
                  onChange={(condition) => handleConditionChange(sys.id, condition)}
                  compact
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modules */}
      <div className="px-4 pt-6">
        <h3 className="mb-2 text-sm font-bold text-mech">Modules ({modules.length})</h3>
        {modules.length === 0 ? (
          <p className="text-xs italic text-su-grey">No modules equipped</p>
        ) : (
          <div className="space-y-2">
            {modules.map((mod) => (
              <div
                key={mod.id}
                className="flex items-center justify-between rounded-lg border border-mech/30 bg-mech/5 px-3 py-2"
              >
                <span className="text-sm">{mod.schema_ref_id}</span>
                <ConditionControl
                  condition={mod.condition as ItemCondition}
                  onChange={(condition) => handleConditionChange(mod.id, condition)}
                  compact
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cargo */}
      <div className="px-4 pt-6">
        <h3 className="mb-2 text-sm font-bold text-mech">
          <Package className="mr-1 inline-block h-4 w-4" />
          Cargo ({cargo.length})
        </h3>
        {cargo.length > 0 && (
          <div className="mb-3 space-y-1">
            {cargo.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2"
              >
                <span className="flex-1 text-sm">{item.name || item.schema_ref_id || 'Item'}</span>
                <span className="text-xs text-su-grey-dark">x{item.amount}</span>
                <button
                  onClick={() => deleteCargoItem.mutate(item.id)}
                  className="rounded p-1 text-su-grey-dark transition-colors hover:bg-destroyed/10 hover:text-destroyed"
                  aria-label={`Delete ${item.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newCargoName}
            onChange={(e) => setNewCargoName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCargo()}
            placeholder="Add cargo item..."
            className="flex-1 rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-sm placeholder:text-su-grey focus:outline-none focus:ring-1 focus:ring-mech"
          />
          <button
            onClick={handleAddCargo}
            disabled={!newCargoName.trim()}
            className="flex items-center gap-1 rounded-md bg-mech px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
      </div>

      {/* Notes */}
      <div className="px-4 pt-6 pb-4">
        <span className="text-xs font-medium text-su-grey-dark">Notes</span>
        <InlineEdit
          value={mech.notes}
          onSave={(v) => handleUpdate('notes', v)}
          placeholder="Notes..."
          className="text-sm"
          multiline
        />
      </div>

      {/* Dice rolling */}
      <DiceRollFAB />
      <DiceRollSheet
        currentHeat={mech.current_heat}
        heatCapacity={mech.heat_capacity}
        onHeatChange={handleHeatChange}
      />
    </div>
  )
}
