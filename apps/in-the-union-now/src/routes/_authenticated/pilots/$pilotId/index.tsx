import { useState, useMemo, useCallback } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SalvageUnionReference, isHybridClass, getAssetUrl } from 'salvageunion-reference'
import type { EntitySchemaName, SURefEntity } from 'salvageunion-reference'
import {
  DisplayCard,
  EntityDisplay,
  SectionSeparator,
  StatDisplay,
  Text,
  ValueDisplay,
  navigateControl,
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
import { useMech } from '../../../../hooks/useMechs'
import { useAutosave } from '../../../../hooks/useAutosave'
import { useSaveStatus } from '../../../../hooks/useSaveStatus'
import { getPatternAccess } from '../../../../lib/patternAccess'
import { PatternImageSlot } from '../../../../components/patterns/PatternImageSlot'
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
  const [customPilotImage, setCustomPilotImage] = useState<string | null>(null)

  const { data: mech } = useMech(pilot?.mech_id ?? undefined)

  const pilotSaveStatus = useSaveStatus({ isSaving: updatePilot.isPending })

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

  const mechChassis = useMemo(
    () => (mech ? SalvageUnionReference.Chassis.find((c) => c.id === mech.chassis_ref) : undefined),
    [mech]
  )
  const mechLabel = mechChassis
    ? `${mechChassis.name} \u201C${mech!.pattern_name ?? 'Unnamed'}\u201D`
    : undefined

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

  const saveStatusText = pilotSaveStatus.statusText

  function handlePilotUpdate(input: Partial<PilotUpdate>) {
    if (!user) return
    updatePilot.mutate(
      { pilotId: pilot!.id, input, userId: user.id },
      {
        onSuccess: () => toast.success('Pilot updated'),
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }

  function handleStatChange(field: 'hp' | 'ap' | 'tp', newValue: number) {
    handlePilotUpdate({ [field]: newValue })
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
    handlePilotUpdate({ visible: !pilot!.visible })
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
                {mechLabel && (
                  <span className="inline-flex shrink-0 cursor-default whitespace-nowrap border border-su-black">
                    <span className="bg-su-black px-1 font-mono text-xs font-normal uppercase leading-none text-su-white">
                      {mechLabel}
                    </span>
                    <button
                      type="button"
                      className="cursor-pointer px-1 font-mono text-xs font-normal uppercase leading-none text-su-white transition-opacity hover:opacity-80"
                      style={{ backgroundColor: 'rgb(122, 151, 138)' }}
                    >
                      Load in
                    </button>
                  </span>
                )}
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
                {saveStatusText && (
                  <span className="font-mono text-xs text-su-white/70">{saveStatusText}</span>
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
        <div className="p-4">
          <PatternImageSlot
            defaultImageUrl={pilotClass ? getAssetUrl(pilotClass) : undefined}
            customImageUrl={customPilotImage}
            onSetCustomImage={setCustomPilotImage}
            alt={pilot.callsign}
          />
          <div className="space-y-4">
            <PilotPersonalInfo pilot={pilot} readOnly={!canEdit} onUpdate={handlePilotUpdate} />
            <PilotMechSection pilot={pilot} readOnly={!canEdit} />
            <PilotEntityRefs refs={pilotRefs ?? []} />
          </div>
          <div className="clear-both" />
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

function PilotPersonalInfo({
  pilot,
  readOnly,
  onUpdate,
}: {
  pilot: PilotRow
  readOnly?: boolean
  onUpdate: (input: Partial<PilotUpdate>) => void
}) {
  const handleFieldBlur = useCallback(
    (field: keyof PilotUpdate, value: string) => {
      const currentValue = pilot[field as keyof PilotRow] ?? ''
      if (value === currentValue) return
      onUpdate({ [field]: value || null })
    },
    [pilot, onUpdate]
  )

  const handleToggleUsed = useCallback(
    (field: 'background_used' | 'motto_used' | 'keepsake_used', currentValue: boolean | null) => {
      onUpdate({ [field]: !currentValue })
    },
    [onUpdate]
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
          onSave={(v) => handleFieldBlur('background', v)}
          onToggleUsed={() => handleToggleUsed('background_used', pilot.background_used)}
        />
        <PersonalField
          label="Motto"
          value={pilot.motto ?? ''}
          used={pilot.motto_used}
          readOnly={readOnly}
          onSave={(v) => handleFieldBlur('motto', v)}
          onToggleUsed={() => handleToggleUsed('motto_used', pilot.motto_used)}
        />
        <PersonalField
          label="Keepsake"
          value={pilot.keepsake ?? ''}
          used={pilot.keepsake_used}
          readOnly={readOnly}
          onSave={(v) => handleFieldBlur('keepsake', v)}
          onToggleUsed={() => handleToggleUsed('keepsake_used', pilot.keepsake_used)}
        />
        <PersonalField
          label="Appearance"
          value={pilot.appearance ?? ''}
          readOnly={readOnly}
          onSave={(v) => handleFieldBlur('appearance', v)}
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
  onSave,
  onToggleUsed,
}: {
  label: string
  value: string
  used?: boolean | null
  readOnly?: boolean
  onSave: (value: string) => void
  onToggleUsed?: () => void
}) {
  const [localValue, setLocalValue] = useState(value)
  const { flush } = useAutosave({
    value: localValue,
    onSave,
    delay: 1000,
  })

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
            className="inline-flex shrink-0 cursor-pointer border border-su-black"
          >
            <span className="inline-flex h-full w-[1.1em] items-center justify-center bg-su-white font-mono text-xs font-bold leading-none text-su-black">
              {used ? 'X' : '\u00A0'}
            </span>
            <span className="bg-su-black px-1 font-mono text-xs font-bold uppercase leading-none text-su-white">
              Used
            </span>
          </button>
        )}
      </div>
      <Input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={flush}
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
// Mech Section (compact listing like dashboard)
// ---------------------------------------------------------------------------

function PilotMechSection({ pilot, readOnly }: { pilot: PilotRow; readOnly?: boolean }) {
  const navigate = useNavigate()
  const { data: mech, isLoading: mechLoading } = useMech(pilot.mech_id ?? undefined)

  const chassis = useMemo(
    () => (mech ? SalvageUnionReference.Chassis.find((c) => c.id === mech.chassis_ref) : undefined),
    [mech]
  )

  const handleNavigateToMechBay = useCallback(() => {
    navigate({ to: '/pilots/$pilotId/mech-bay', params: { pilotId: pilot.id } })
  }, [navigate, pilot.id])

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
      ) : mechLoading ? (
        <Skeleton className="h-[40px] rounded-md" />
      ) : mech && chassis ? (
        <EntityDisplay
          data={chassis}
          listing
          compact
          patternOverride={{
            name: mech.pattern_name ?? 'Unnamed Mech',
            systems: [],
            modules: [],
          }}
          controls={[navigateControl(handleNavigateToMechBay)]}
        />
      ) : null}
    </div>
  )
}
