import { useState, useMemo, useCallback } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SalvageUnionReference, isHybridClass } from 'salvageunion-reference'
import type { EntitySchemaName, SURefEntity } from 'salvageunion-reference'
import {
  DisplayCard,
  EntityDisplay,
  SectionSeparator,
  StatDisplay,
  Text,
  ValueDisplay,
  useDetailModal,
} from 'suref-react'
import { toast } from 'sonner'
import { Trash2, Plus, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../../../../stores/authStore'
import {
  usePilot,
  usePilotEntityRefs,
  useUpdatePilot,
  useDeletePilot,
} from '../../../../hooks/usePilots'
import { useMech, useMechEntityRefs, useUpdateMechLoadout } from '../../../../hooks/useMechs'
import { useAutosave } from '../../../../hooks/useAutosave'
import { useSaveStatus } from '../../../../hooks/useSaveStatus'
import { entityRefsToBuilderState, builderStateToPatchOps } from '../../../../lib/mechUtils'
import { patternToBuilderState, builderToCreateInput } from '../../../../lib/builderUtils'
import type { BuilderState } from '../../../../lib/builderUtils'
import { getPatternAccess } from '../../../../lib/patternAccess'
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
import type { PilotRow, EntityRefRow, PilotUpdate } from '../../../../types/common'

export const Route = createFileRoute('/_authenticated/pilots/$pilotId/')({
  component: PilotDetailPage,
})

function PilotDetailPage() {
  const { pilotId } = Route.useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { data: pilot, isLoading, error } = usePilot(pilotId)
  const { data: pilotRefs } = usePilotEntityRefs(pilotId)
  const updatePilot = useUpdatePilot()
  const deletePilot = useDeletePilot()
  const [showDelete, setShowDelete] = useState(false)

  // Mech autosave — lifted from PilotMechSection
  const { data: mech } = useMech(pilot?.mech_id ?? undefined)
  const { data: mechRefs } = useMechEntityRefs(pilot?.mech_id ?? undefined)
  const updateLoadout = useUpdateMechLoadout()
  const [mechBuilderState, setMechBuilderState] = useState<BuilderState | null>(null)

  const canMechAutosave =
    !!user &&
    !!mech &&
    !!mechRefs &&
    mechBuilderState !== null &&
    builderToCreateInput(mechBuilderState) !== null

  const handleMechAutosave = useCallback(
    (state: BuilderState | null) => {
      if (!user || !mech || !mechRefs || !state) return
      const newState = patternToBuilderState({
        name: state.name,
        chassis_ref: state.chassisRef!,
        description: state.description || null,
        visible: state.visible,
        pattern_items: state.items,
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
          onSuccess: () => toast.success('Mech loadout saved', { id: 'mech-autosave' }),
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [user, mech, mechRefs, updateLoadout]
  )

  useAutosave({
    value: mechBuilderState,
    onSave: handleMechAutosave,
    enabled: canMechAutosave,
  })

  const mechSaveStatus = useSaveStatus({ isSaving: updateLoadout.isPending })

  const pilotClass = useMemo(
    () => (pilot ? SalvageUnionReference.get('classes', pilot.class_ref) : undefined),
    [pilot]
  )
  const cardColor = pilotClass && isHybridClass(pilotClass) ? 'bg-su-pink' : 'bg-su-orange'
  const pilotClassName = pilotClass?.name ?? 'Unknown'
  const abilityCount = useMemo(
    () => (pilotRefs ?? []).filter((r) => r.schema_name === 'abilities').length,
    [pilotRefs]
  )

  const mechInitialState = useMemo(() => {
    if (!mech || !mechRefs) return null
    return entityRefsToBuilderState(mech, mechRefs)
  }, [mech, mechRefs])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const access = pilot ? getPatternAccess(pilot, user?.id) : undefined

  if (error || !pilot || !access?.canView) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-su-grey-dark">Pilot not found.</p>
        <Button variant="outline" onClick={() => navigate({ to: '/' })}>
          Back to Dashboard
        </Button>
      </div>
    )
  }

  const canEdit = access.canEdit

  function handleStatChange(field: 'hp' | 'ap' | 'tp', newValue: number) {
    if (!user) return
    updatePilot.mutate(
      { pilotId: pilot!.id, input: { [field]: newValue }, userId: user.id },
      { onError: (err) => toast.error(getErrorMessage(err)) }
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

  function handleToggleVisibility() {
    if (!user) return
    updatePilot.mutate(
      { pilotId: pilot!.id, input: { visible: !pilot!.visible }, userId: user.id },
      { onError: (err) => toast.error(getErrorMessage(err)) }
    )
  }

  return (
    <>
      <DisplayCard
        headerBg={cardColor}
        bodyPadding="p-0"
        headerContent={
          <>
            <div className="flex min-w-0 flex-col justify-center gap-0.5">
              <Text variant="pseudoheader" as="span" className="text-[1.75rem]">
                {pilot.callsign}
              </Text>
              <div className="flex flex-wrap items-center gap-1">
                <ValueDisplay label="Class" value={pilotClassName} compact />
                <ValueDisplay label="Abilities" value={abilityCount} compact />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <PilotStatControl
                label="HP"
                value={pilot.hp}
                max={pilot.max_hp}
                canEdit={canEdit}
                onChange={(v) => handleStatChange('hp', v)}
              />
              <PilotStatControl
                label="AP"
                value={pilot.ap}
                max={pilot.max_ap}
                canEdit={canEdit}
                onChange={(v) => handleStatChange('ap', v)}
              />
              <PilotStatControl
                label="TP"
                value={pilot.tp}
                canEdit={canEdit}
                onChange={(v) => handleStatChange('tp', v)}
              />
            </div>
          </>
        }
        footerContent={
          canEdit ? (
            <div className="flex w-full items-center justify-between px-2 py-1">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleVisibility}
                  className={`flex cursor-pointer items-center gap-1.5 text-xs font-semibold transition-colors hover:text-su-white ${pilot.visible ? 'text-su-white' : 'text-su-white/70'}`}
                  title={pilot.visible ? 'Pilot is visible' : 'Pilot is hidden'}
                >
                  {pilot.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  <span>{pilot.visible ? 'Visible' : 'Hidden'}</span>
                </button>
                {mechSaveStatus.statusText && (
                  <span className="font-mono text-xs text-su-white/70">
                    {mechSaveStatus.statusText}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-su-rust px-3 py-1.5 font-mono text-sm font-semibold uppercase text-su-white transition-colors hover:bg-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-4 p-4">
          <PilotPersonalInfo pilot={pilot} readOnly={!canEdit} />
          <PilotEntityRefs refs={pilotRefs ?? []} />
          <PilotMechSection
            pilot={pilot}
            readOnly={!canEdit}
            mechInitialState={mechInitialState}
            onMechChange={setMechBuilderState}
          />
        </div>
      </DisplayCard>

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
    </>
  )
}

// ---------------------------------------------------------------------------
// Pilot Stat Control (+/- buttons around StatDisplay)
// ---------------------------------------------------------------------------

function PilotStatControl({
  label,
  value,
  max,
  canEdit,
  onChange,
}: {
  label: string
  value: number
  max?: number
  canEdit: boolean
  onChange: (newValue: number) => void
}) {
  const atMin = value <= 0
  const atMax = max !== undefined && value >= max

  return (
    <div className="flex items-center gap-0.5">
      <StatDisplay label={label} value={value} outOfMax={max} />
      {canEdit && (
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
            disabled={!!atMax}
            className={`flex h-4 w-4 items-center justify-center border border-su-black bg-su-white font-mono text-xs font-bold leading-none text-su-black transition-colors ${
              atMax
                ? 'cursor-not-allowed opacity-30'
                : 'cursor-pointer hover:bg-su-black hover:text-su-white'
            }`}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => onChange(Math.max(0, value - 1))}
            disabled={atMin}
            className={`flex h-4 w-4 items-center justify-center border border-su-black bg-su-white font-mono text-xs font-bold leading-none text-su-black transition-colors ${
              atMin
                ? 'cursor-not-allowed opacity-30'
                : 'cursor-pointer hover:bg-su-black hover:text-su-white'
            }`}
          >
            −
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Personal Info (editable inline or read-only)
// ---------------------------------------------------------------------------

function PilotPersonalInfo({ pilot, readOnly }: { pilot: PilotRow; readOnly?: boolean }) {
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
          readOnly={readOnly}
          onBlur={(v) => handleFieldBlur('background', v)}
          onToggleUsed={() => handleToggleUsed('background_used', pilot.background_used)}
        />
        <PersonalField
          label="Motto"
          value={pilot.motto ?? ''}
          used={pilot.motto_used}
          readOnly={readOnly}
          onBlur={(v) => handleFieldBlur('motto', v)}
          onToggleUsed={() => handleToggleUsed('motto_used', pilot.motto_used)}
        />
        <PersonalField
          label="Keepsake"
          value={pilot.keepsake ?? ''}
          used={pilot.keepsake_used}
          readOnly={readOnly}
          onBlur={(v) => handleFieldBlur('keepsake', v)}
          onToggleUsed={() => handleToggleUsed('keepsake_used', pilot.keepsake_used)}
        />
        <PersonalField
          label="Appearance"
          value={pilot.appearance ?? ''}
          readOnly={readOnly}
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
  readOnly,
  onBlur,
  onToggleUsed,
}: {
  label: string
  value: string
  used?: boolean | null
  readOnly?: boolean
  onBlur: (value: string) => void
  onToggleUsed?: () => void
}) {
  const [localValue, setLocalValue] = useState(value)

  if (readOnly) {
    return (
      <div className="space-y-1">
        <Text variant="pseudoheader" className="text-xs">
          {label}
        </Text>
        <p className="text-sm text-su-grey-light">{value || '\u2014'}</p>
      </div>
    )
  }

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
// Mech Section (inline editing with autosave via parent)
// ---------------------------------------------------------------------------

function PilotMechSection({
  pilot,
  readOnly,
  mechInitialState,
  onMechChange,
}: {
  pilot: PilotRow
  readOnly?: boolean
  mechInitialState: BuilderState | null
  onMechChange: (state: BuilderState) => void
}) {
  const navigate = useNavigate()

  return (
    <div className="space-y-3">
      <SectionSeparator label="Mech" fontSize="text-sm" />

      {!pilot.mech_id ? (
        readOnly ? (
          <p className="text-sm text-su-grey-dark">No mech assigned.</p>
        ) : (
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
        )
      ) : mechInitialState ? (
        readOnly ? (
          <MechBuilder initialState={mechInitialState} readOnly compact hideFooterToggles />
        ) : (
          <MechBuilder
            initialState={mechInitialState}
            onChange={onMechChange}
            hideFooter
            compact
            hideFooterToggles
          />
        )
      ) : (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}
    </div>
  )
}
