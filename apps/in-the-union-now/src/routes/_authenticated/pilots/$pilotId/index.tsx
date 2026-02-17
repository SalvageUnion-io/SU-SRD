import { useState, useMemo, useCallback } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SalvageUnionReference, isHybridClass, getAssetUrl } from 'salvageunion-reference'
import { DisplayCard, Text, ValueDisplay } from 'suref-react'
import { toast } from 'sonner'
import { Eye, EyeOff, Trash2 } from 'lucide-react'
import { useAuthStore } from '../../../../stores/authStore'
import {
  usePilot,
  usePilotEntityRefs,
  useUpdatePilot,
  useDeletePilot,
  useUpdateEntityRef,
} from '../../../../hooks/usePilots'
import {
  useMech,
  useMechEntityRefs,
  useUpdateMech,
  useUpdateMechEntityRef,
} from '../../../../hooks/useMechs'
import { useSaveStatus } from '../../../../hooks/useSaveStatus'
import { getEntityAccess } from '../../../../lib/entityAccess'
import { findChassisById } from '../../../../lib/entityHelpers'
import { PatternImageSlot } from '../../../../components/patterns/PatternImageSlot'
import { PageSkeleton } from '../../../../components/shared/PageSkeleton'
import { NotFoundState } from '../../../../components/shared/NotFoundState'
import { DeleteConfirmDialog } from '../../../../components/shared/DeleteConfirmDialog'
import { getErrorMessage } from '../../../../lib/errors'
import { SheetFooter } from '../../../../components/shared/SheetFooter'
import { actionButtonClasses } from '../../../../components/shared/actionButtonClasses'
import { PilotStatControl } from '../../../../components/pilots/PilotStatControl'
import { PilotPersonalInfo } from '../../../../components/pilots/PilotPersonalInfo'
import { PilotEntityRefs } from '../../../../components/pilots/PilotEntityRefs'
import { PilotMechSection } from '../../../../components/pilots/PilotMechSection'
import { PilotActionsSection } from '../../../../components/pilots/PilotActionsSection'
import { MechActionsSection } from '../../../../components/pilots/MechActionsSection'
import type { EntityRefUpdate, MechUpdate, PilotUpdate } from '../../../../types/common'

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
  const updateEntityRef = useUpdateEntityRef()
  const deletePilot = useDeletePilot()
  const [showDelete, setShowDelete] = useState(false)

  const { data: mech, isLoading: mechLoading } = useMech(pilot?.mech_id ?? undefined)
  const { data: mechRefs } = useMechEntityRefs(mech?.id)
  const updateMech = useUpdateMech()
  const updateMechEntityRef = useUpdateMechEntityRef()

  const pilotSaveStatus = useSaveStatus({
    isSaving:
      updatePilot.isPending ||
      updateEntityRef.isPending ||
      updateMech.isPending ||
      updateMechEntityRef.isPending,
  })

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

  const mechChassis = useMemo(() => (mech ? findChassisById(mech.chassis_ref) : undefined), [mech])
  const chassisName = mechChassis?.name
  const patternName = mech?.pattern_name ? `\u201C${mech.pattern_name}\u201D` : undefined

  // Deduplicated save toast — uses a fixed ID so rapid saves don't spam
  const showSaveToast = useCallback(() => {
    toast.success('Saved', { id: 'autosave', duration: 1500 })
  }, [])

  const handleUpdateEntityRef = useCallback(
    (refId: string, input: EntityRefUpdate) => {
      if (!pilot) return
      updateEntityRef.mutate(
        { refId, input, pilotId: pilot.id },
        {
          onSuccess: showSaveToast,
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [pilot, updateEntityRef, showSaveToast]
  )

  const handleUpdateMech = useCallback(
    (input: Partial<MechUpdate>) => {
      if (!mech) return
      updateMech.mutate(
        { mechId: mech.id, input },
        {
          onSuccess: showSaveToast,
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [mech, updateMech, showSaveToast]
  )

  const handleUpdateMechEntityRef = useCallback(
    (refId: string, input: EntityRefUpdate) => {
      if (!mech) return
      updateMechEntityRef.mutate(
        { refId, input, mechId: mech.id },
        {
          onSuccess: showSaveToast,
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [mech, updateMechEntityRef, showSaveToast]
  )

  if (isLoading) return <PageSkeleton />

  const access = pilot ? getEntityAccess(pilot, user?.id) : undefined

  if (error || !pilot || !access?.canView) {
    return <NotFoundState message="Pilot not found." />
  }

  const canEdit = access.canEdit

  const saveStatusText = pilotSaveStatus.statusText

  function handlePilotUpdate(input: Partial<PilotUpdate>) {
    if (!user) return
    updatePilot.mutate(
      { pilotId: pilot!.id, input, userId: user.id },
      {
        onSuccess: showSaveToast,
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
                <ValueDisplay label="Class" value={pilotClassName} />
                <ValueDisplay label="Abilities" value={abilityCount} />
                {chassisName && (
                  <span className="inline-flex shrink-0 cursor-default whitespace-nowrap border border-su-black">
                    <Text
                      variant="pseudoheader"
                      as="span"
                      className="text-base font-semibold uppercase"
                      style={{ backgroundColor: 'rgb(122, 151, 138)' }}
                    >
                      {chassisName}
                    </Text>
                    {patternName && (
                      <Text
                        variant="pseudoheader"
                        as="span"
                        className="text-base font-semibold uppercase"
                      >
                        {patternName}
                      </Text>
                    )}
                    <button
                      type="button"
                      className="cursor-pointer px-1 font-mono text-base font-semibold uppercase leading-none text-su-white transition-opacity hover:opacity-80"
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
            <SheetFooter
              saveStatusText={saveStatusText}
              leftContent={
                <button
                  type="button"
                  onClick={handleToggleVisibility}
                  className={`flex cursor-pointer items-center gap-1.5 text-xs font-semibold transition-colors hover:text-su-white ${pilot.visible ? 'text-su-white' : 'text-su-white/70'}`}
                  title={pilot.visible ? 'Pilot is visible' : 'Pilot is hidden'}
                >
                  {pilot.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  <span>{pilot.visible ? 'Visible' : 'Hidden'}</span>
                </button>
              }
              rightContent={
                <button
                  type="button"
                  onClick={() => setShowDelete(true)}
                  className={actionButtonClasses('rust')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              }
            />
          ) : undefined
        }
      >
        <div className="p-4">
          <PatternImageSlot
            defaultImageUrl={pilotClass ? getAssetUrl(pilotClass) : undefined}
            alt={pilot.callsign}
            readOnly
          />
          <div className="space-y-4">
            <PilotPersonalInfo pilot={pilot} readOnly={!canEdit} onUpdate={handlePilotUpdate} />
            <PilotMechSection
              pilot={pilot}
              readOnly={!canEdit}
              mech={mech}
              mechChassis={mechChassis}
              mechLoading={mechLoading}
            />
          </div>
          <div className="clear-both" />
          <div className="space-y-4">
            <PilotActionsSection
              refs={pilotRefs ?? []}
              pilot={pilot}
              readOnly={!canEdit}
              onUpdatePilot={handlePilotUpdate}
              onUpdateEntityRef={handleUpdateEntityRef}
            />
            {mech && mechRefs && (
              <MechActionsSection
                mechRefs={mechRefs}
                mech={mech}
                readOnly={!canEdit}
                onUpdateMech={handleUpdateMech}
                onUpdateMechEntityRef={handleUpdateMechEntityRef}
              />
            )}
            <PilotEntityRefs refs={pilotRefs ?? []} />
          </div>
        </div>
      </DisplayCard>

      <DeleteConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        entityType="Pilot"
        entityName={pilot.callsign}
        onConfirm={handleDelete}
        isDeleting={deletePilot.isPending}
      />
    </>
  )
}
