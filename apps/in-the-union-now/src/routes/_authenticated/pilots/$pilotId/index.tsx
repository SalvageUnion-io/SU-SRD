import { useState, useMemo, useCallback } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { EntitySchemaName, SURefEntity } from 'salvageunion-reference'
import { EntityDisplay, SectionSeparator, Text, useDetailModal } from 'suref-react'
import { toast } from 'sonner'
import { Trash2, Plus } from 'lucide-react'
import { useAuthStore } from '../../../../stores/authStore'
import {
  usePilot,
  usePilotEntityRefs,
  useUpdatePilot,
  useDeletePilot,
} from '../../../../hooks/usePilots'
import { useMech, useMechEntityRefs, useUpdateMechLoadout } from '../../../../hooks/useMechs'
import { entityRefsToBuilderState, builderStateToPatchOps } from '../../../../lib/mechUtils'
import { patternToBuilderState } from '../../../../lib/builderUtils'
import { MechBuilder } from '../../../../components/patterns/MechBuilder'
import { Button } from '../../../../components/ui/button'
import { Input } from '../../../../components/ui/input'
import { Skeleton } from '../../../../components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../../../components/ui/dialog'
import { getErrorMessage } from '../../../../lib/errors'
import type {
  PilotRow,
  EntityRefRow,
  PilotUpdate,
  CreatePatternInput,
} from '../../../../types/common'

export const Route = createFileRoute('/_authenticated/pilots/$pilotId/')({
  component: PilotDetailPage,
})

function PilotDetailPage() {
  const { pilotId } = Route.useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { data: pilot, isLoading, error } = usePilot(pilotId)
  const { data: pilotRefs } = usePilotEntityRefs(pilotId)
  const deletePilot = useDeletePilot()
  const [showDelete, setShowDelete] = useState(false)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !pilot) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-su-grey-dark">Pilot not found.</p>
        <Button variant="outline" onClick={() => navigate({ to: '/' })}>
          Back to Dashboard
        </Button>
      </div>
    )
  }

  function handleDelete() {
    if (!user) return
    deletePilot.mutate(
      { pilotId, userId: user.id },
      {
        onSuccess: () => {
          toast.success('Pilot deleted')
          navigate({ to: '/' })
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <PilotHeader pilot={pilot} />

      {/* Personal Info */}
      <PilotPersonalInfo pilot={pilot} />

      {/* Abilities & Equipment */}
      <PilotEntityRefs refs={pilotRefs ?? []} />

      {/* Mech section */}
      <PilotMechSection pilot={pilot} />

      {/* Actions */}
      <div className="flex justify-end pt-4">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={() => setShowDelete(true)}
        >
          <Trash2 className="h-4 w-4" />
          Delete Pilot
        </Button>
      </div>

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="bg-su-dark sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-su-orange">Delete Pilot</DialogTitle>
            <DialogDescription className="text-su-grey-dark">
              Are you sure you want to delete{' '}
              <strong className="text-su-white">{pilot.callsign}</strong>? This will also remove all
              associated entity refs. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDelete(false)}
              disabled={deletePilot.isPending}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deletePilot.isPending}>
              {deletePilot.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pilot Header
// ---------------------------------------------------------------------------

function PilotHeader({ pilot }: { pilot: PilotRow }) {
  const pilotClass = useMemo(
    () => SalvageUnionReference.get('classes', pilot.class_ref),
    [pilot.class_ref]
  )

  return (
    <div>
      {pilotClass && (
        <EntityDisplay
          data={pilotClass as Parameters<typeof EntityDisplay>[0]['data']}
          compact
          listing
          hideStats
          label={pilot.callsign}
        />
      )}
      <div className="mt-2 flex flex-wrap gap-3">
        <StatBadge label="HP" current={pilot.hp} max={pilot.max_hp} />
        <StatBadge label="AP" current={pilot.ap} max={pilot.max_ap} />
        <StatBadge label="TP" current={pilot.tp} />
      </div>
    </div>
  )
}

function StatBadge({ label, current, max }: { label: string; current: number; max?: number }) {
  return (
    <div className="flex items-center gap-1 font-mono text-sm">
      <span className="font-bold text-su-orange">{label}:</span>
      <span className="text-su-white">
        {current}
        {max !== undefined && `/${max}`}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Personal Info (editable inline)
// ---------------------------------------------------------------------------

function PilotPersonalInfo({ pilot }: { pilot: PilotRow }) {
  const updatePilot = useUpdatePilot()
  const user = useAuthStore((s) => s.user)

  const handleFieldBlur = useCallback(
    (field: keyof PilotUpdate, value: string) => {
      if (!user) return
      const currentValue = pilot[field as keyof PilotRow] ?? ''
      if (value === currentValue) return
      updatePilot.mutate(
        { pilotId: pilot.id, input: { [field]: value || null }, userId: user.id },
        { onError: (err) => toast.error(getErrorMessage(err)) }
      )
    },
    [pilot, user, updatePilot]
  )

  const handleToggleUsed = useCallback(
    (field: 'background_used' | 'motto_used' | 'keepsake_used', currentValue: boolean | null) => {
      if (!user) return
      updatePilot.mutate(
        { pilotId: pilot.id, input: { [field]: !currentValue }, userId: user.id },
        { onError: (err) => toast.error(getErrorMessage(err)) }
      )
    },
    [pilot.id, user, updatePilot]
  )

  return (
    <div className="space-y-3">
      <SectionSeparator label="Personal Info" fontSize="text-sm" />
      <div className="grid gap-3 sm:grid-cols-2">
        <PersonalField
          label="Background"
          value={pilot.background ?? ''}
          used={pilot.background_used}
          onBlur={(v) => handleFieldBlur('background', v)}
          onToggleUsed={() => handleToggleUsed('background_used', pilot.background_used)}
        />
        <PersonalField
          label="Motto"
          value={pilot.motto ?? ''}
          used={pilot.motto_used}
          onBlur={(v) => handleFieldBlur('motto', v)}
          onToggleUsed={() => handleToggleUsed('motto_used', pilot.motto_used)}
        />
        <PersonalField
          label="Keepsake"
          value={pilot.keepsake ?? ''}
          used={pilot.keepsake_used}
          onBlur={(v) => handleFieldBlur('keepsake', v)}
          onToggleUsed={() => handleToggleUsed('keepsake_used', pilot.keepsake_used)}
        />
        <PersonalField
          label="Appearance"
          value={pilot.appearance ?? ''}
          onBlur={(v) => handleFieldBlur('appearance', v)}
        />
      </div>
    </div>
  )
}

function PersonalField({
  label,
  value,
  used,
  onBlur,
  onToggleUsed,
}: {
  label: string
  value: string
  used?: boolean | null
  onBlur: (value: string) => void
  onToggleUsed?: () => void
}) {
  const [localValue, setLocalValue] = useState(value)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Text variant="pseudoheader" className="text-xs">
          {label}
        </Text>
        {onToggleUsed !== undefined && (
          <button
            type="button"
            onClick={onToggleUsed}
            className="flex items-center gap-1 text-xs text-su-grey-dark hover:text-su-orange transition-colors"
          >
            <div
              className={`h-3 w-3 rounded-full border ${used ? 'border-green-500 bg-green-500' : 'border-su-grey-dark'}`}
            />
            {used ? 'Used' : 'Unused'}
          </button>
        )}
      </div>
      <Input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => onBlur(localValue)}
        placeholder={`Enter ${label.toLowerCase()}...`}
        className="h-8 text-sm"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pilot Entity Refs (Abilities + Equipment)
// ---------------------------------------------------------------------------

function PilotEntityRefs({ refs }: { refs: EntityRefRow[] }) {
  const abilityRefs = useMemo(() => refs.filter((r) => r.schema_name === 'abilities'), [refs])
  const equipmentRefs = useMemo(() => refs.filter((r) => r.schema_name === 'equipment'), [refs])

  return (
    <div className="space-y-3">
      {abilityRefs.length > 0 && (
        <div>
          <SectionSeparator label="Abilities" fontSize="text-sm" />
          <div className="mt-2 flex flex-col gap-2">
            {abilityRefs.map((ref) => {
              const entity = SalvageUnionReference.get(
                ref.schema_name as EntitySchemaName,
                ref.schema_ref_id
              )
              if (!entity) return null
              return <PilotEntityRefListing key={ref.id} entity={entity as SURefEntity} />
            })}
          </div>
        </div>
      )}

      {equipmentRefs.length > 0 && (
        <div>
          <SectionSeparator label="Equipment" fontSize="text-sm" />
          <div className="mt-2 flex flex-col gap-2">
            {equipmentRefs.map((ref) => {
              const entity = SalvageUnionReference.get(
                ref.schema_name as EntitySchemaName,
                ref.schema_ref_id
              )
              if (!entity) return null
              return <PilotEntityRefListing key={ref.id} entity={entity as SURefEntity} />
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function PilotEntityRefListing({ entity }: { entity: SURefEntity }) {
  const detailModal = useDetailModal(entity)

  return (
    <>
      <EntityDisplay data={entity} listing compact controls={[detailModal.control]} />
      {detailModal.modal}
    </>
  )
}

// ---------------------------------------------------------------------------
// Mech Section (inline editing)
// ---------------------------------------------------------------------------

function PilotMechSection({ pilot }: { pilot: PilotRow }) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { data: mech } = useMech(pilot.mech_id ?? undefined)
  const { data: mechRefs } = useMechEntityRefs(pilot.mech_id ?? undefined)
  const updateLoadout = useUpdateMechLoadout()

  const mechBuilderState = useMemo(() => {
    if (!mech || !mechRefs) return null
    return entityRefsToBuilderState(mech, mechRefs)
  }, [mech, mechRefs])

  const handleSaveMechLoadout = useCallback(
    (input: CreatePatternInput) => {
      if (!user || !mech || !mechRefs) return
      const newState = patternToBuilderState({
        name: input.name,
        chassis_ref: input.chassis_ref,
        description: input.description ?? null,
        visible: input.visible ?? true,
        pattern_items: input.pattern_items,
      })
      const ops = builderStateToPatchOps(mechRefs, newState, mech.id, user.id)
      updateLoadout.mutate(
        {
          mechId: mech.id,
          userId: user.id,
          inserts: ops.inserts,
          deleteIds: ops.deleteIds,
        },
        {
          onSuccess: () => toast.success('Mech loadout updated'),
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [user, mech, mechRefs, updateLoadout]
  )

  return (
    <div className="space-y-3">
      <SectionSeparator label="Mech" fontSize="text-sm" />

      {!pilot.mech_id ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-su-grey-light/50 p-6">
          <p className="text-sm text-su-grey-dark">No mech assigned yet.</p>
          <Button
            size="sm"
            onClick={() =>
              navigate({ to: '/pilots/$pilotId/create-mech', params: { pilotId: pilot.id } })
            }
            className="font-mono text-xs uppercase"
          >
            <Plus className="h-4 w-4" />
            Create Starting Mech
          </Button>
        </div>
      ) : mechBuilderState ? (
        <MechBuilder
          initialState={mechBuilderState}
          onSave={handleSaveMechLoadout}
          isSaving={updateLoadout.isPending}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}
    </div>
  )
}
