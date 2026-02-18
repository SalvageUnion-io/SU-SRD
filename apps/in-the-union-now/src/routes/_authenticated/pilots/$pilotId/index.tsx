import { useState, useMemo, useCallback } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SalvageUnionReference, isHybridClass, getAssetUrl } from 'salvageunion-reference'
import { DisplayCard, Text, ValueDisplay } from 'suref-react'
import { toast } from 'sonner'
import { showSaveToast } from '../../../../lib/toastUtils'
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
import { StatControl } from '../../../../components/shared/StatControl'
import { PilotPersonalInfo } from '../../../../components/pilots/PilotPersonalInfo'
import { PilotEntityRefs } from '../../../../components/pilots/PilotEntityRefs'
import { PilotMechSection } from '../../../../components/pilots/PilotMechSection'
import { PilotActionsSection } from '../../../../components/pilots/PilotActionsSection'
import { MechActionsSection } from '../../../../components/pilots/MechActionsSection'
import { MechLoadoutSection } from '../../../../components/pilots/MechLoadoutSection'
import { changeLogApi } from '../../../../lib/api/changeLogApi'
import { useRealtimeSubscription } from '../../../../hooks/useRealtimeSubscription'
import { pilotKeys } from '../../../../hooks/usePilots'
import { mechKeys } from '../../../../hooks/useMechs'
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

  // Realtime: sync pilot, entity refs, mech, and mech entity refs across clients
  useRealtimeSubscription('pilots', `id=eq.${pilotId}`, [pilotKeys.detail(pilotId)])
  useRealtimeSubscription('entity_refs', `parent_id=eq.${pilotId}`, [pilotKeys.entityRefs(pilotId)])
  useRealtimeSubscription('mechs', pilot?.mech_id ? `id=eq.${pilot.mech_id}` : undefined, [
    mechKeys.detail(pilot?.mech_id ?? ''),
  ])
  useRealtimeSubscription('entity_refs', mech ? `parent_id=eq.${mech.id}` : undefined, [
    mechKeys.entityRefs(mech?.id ?? ''),
  ])

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

  const handleUpdateEntityRef = useCallback(
    (refId: string, input: EntityRefUpdate) => {
      if (!pilot || !user) return
      const ref = (pilotRefs ?? []).find((r) => r.id === refId)
      updateEntityRef.mutate(
        { refId, input, pilotId: pilot.id },
        {
          onSuccess: () => {
            showSaveToast()
            if (input.condition && ref) {
              changeLogApi
                .log(user.id, {
                  targetId: refId,
                  targetType: 'entity_ref',
                  action: 'update',
                  field: 'condition',
                  oldValue: ref.condition,
                  newValue: input.condition,
                  description: `${pilot.callsign} equipment → ${input.condition}`,
                })
                .catch(() => {})
            }
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [pilot, user, pilotRefs, updateEntityRef]
  )

  const handleUpdateMech = useCallback(
    (input: Partial<MechUpdate>) => {
      if (!mech || !user) return
      updateMech.mutate(
        { mechId: mech.id, input },
        {
          onSuccess: () => {
            showSaveToast()
            for (const [field, newValue] of Object.entries(input)) {
              const oldValue = mech[field as keyof typeof mech]
              changeLogApi
                .log(user.id, {
                  targetId: mech.id,
                  targetType: 'mech',
                  action: 'update',
                  field,
                  oldValue: oldValue as unknown,
                  newValue,
                  description: `Mech ${field} ${oldValue} → ${newValue}`,
                })
                .catch(() => {})
            }
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [mech, user, updateMech]
  )

  const handleUpdateMechEntityRef = useCallback(
    (refId: string, input: EntityRefUpdate) => {
      if (!mech || !user) return
      const ref = (mechRefs ?? []).find((r) => r.id === refId)
      updateMechEntityRef.mutate(
        { refId, input, mechId: mech.id },
        {
          onSuccess: () => {
            showSaveToast()
            if (input.condition && ref) {
              changeLogApi
                .log(user.id, {
                  targetId: refId,
                  targetType: 'entity_ref',
                  action: 'update',
                  field: 'condition',
                  oldValue: ref.condition,
                  newValue: input.condition,
                  description: `Mech loadout → ${input.condition}`,
                })
                .catch(() => {})
            }
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [mech, user, mechRefs, updateMechEntityRef]
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
    const oldValue = pilot![field]
    handlePilotUpdate({ [field]: newValue })
    if (user) {
      changeLogApi
        .log(user.id, {
          targetId: pilot!.id,
          targetType: 'pilot',
          action: 'update',
          field,
          oldValue,
          newValue,
          description: `${pilot!.callsign} ${field.toUpperCase()} ${oldValue} → ${newValue}`,
        })
        .catch(() => {})
    }
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
              <StatControl
                label="HP"
                value={pilot.hp}
                max={pilot.max_hp}
                canEdit={canEdit}
                onChange={(v) => handleStatChange('hp', v)}
              />
              <StatControl
                label="AP"
                value={pilot.ap}
                max={pilot.max_ap}
                canEdit={canEdit}
                onChange={(v) => handleStatChange('ap', v)}
              />
              <StatControl
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
            {mech && (
              <div className="flex flex-wrap items-center gap-2">
                <StatControl
                  label="SP"
                  value={mech.current_sp}
                  max={mech.max_sp}
                  canEdit={canEdit}
                  onChange={(v) => handleUpdateMech({ current_sp: v })}
                />
                <StatControl
                  label="EP"
                  value={mech.current_ep}
                  max={mech.max_ep}
                  canEdit={canEdit}
                  onChange={(v) => handleUpdateMech({ current_ep: v })}
                />
                <StatControl
                  label="Heat"
                  value={mech.current_heat}
                  max={mech.heat_capacity}
                  canEdit={canEdit}
                  onChange={(v) => handleUpdateMech({ current_heat: v })}
                />
              </div>
            )}
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
              <>
                <MechLoadoutSection
                  mechRefs={mechRefs}
                  canEdit={canEdit}
                  onConditionChange={(refId, condition) =>
                    handleUpdateMechEntityRef(refId, { condition })
                  }
                />
                <MechActionsSection
                  mechRefs={mechRefs}
                  mech={mech}
                  readOnly={!canEdit}
                  onUpdateMech={handleUpdateMech}
                  onUpdateMechEntityRef={handleUpdateMechEntityRef}
                />
              </>
            )}
            <PilotEntityRefs
              refs={pilotRefs ?? []}
              canEdit={canEdit}
              onConditionChange={(refId, condition) => handleUpdateEntityRef(refId, { condition })}
            />
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
