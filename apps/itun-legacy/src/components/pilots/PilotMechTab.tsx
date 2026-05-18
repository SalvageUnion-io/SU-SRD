import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { uploadEntityImage, deleteEntityImage } from '../../lib/api/storageApi'
import { showSaveToast } from '../../lib/toastUtils'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { useUpdateMech, useUpdateMechLoadout, useUpdateMechEntityRef } from '../../hooks/useMechs'
import { useUpdatePilot } from '../../hooks/usePilots'
import { useCreatePattern, usePattern } from '../../hooks/usePatterns'
import { useAutosave } from '../../hooks/useAutosave'
import { useSaveStatus } from '../../hooks/useSaveStatus'
import {
  entityRefsToBuilderState,
  builderStateToPatchOps,
  getMechSourcePattern,
  computeMechStatsFromRef,
} from '../../lib/mechUtils'
import { isSlotOwnerRef } from '../../lib/entityModificationUtils'
import { builderToCreateInput } from '../../lib/builderUtils'
import { hasDeviated, resolveSourcePatternItems } from '../../lib/deviationUtils'
import { computeShutdown, computeActivation } from '../../lib/shutdownUtils'
import { changeLogApi } from '../../lib/api/changeLogApi'
import type { BuilderState } from '../../lib/builderUtils'
import type { ItemCondition } from 'salvageunion-reference'
import type {
  SelectedPattern,
  PatternItem,
  PilotRow,
  MechRow,
  EntityRefRow,
} from '../../types/common'
import { MechBuilder } from '../patterns/MechBuilder'
import { SavePatternDialog } from '../patterns/SavePatternDialog'
import { RefPatternViewModal } from '../patterns/RefPatternViewModal'
import { PilotMechSection } from './PilotMechSection'
import { getErrorMessage } from '../../lib/errors'
import { Button } from '../ui/button'

type PilotMechTabProps = {
  pilot: PilotRow
  mech: MechRow | null | undefined
  mechRefs: EntityRefRow[]
  canEdit: boolean
  compact?: boolean
}

export function PilotMechTab({ pilot, mech, mechRefs, canEdit, compact }: PilotMechTabProps) {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const updateLoadout = useUpdateMechLoadout()
  const updateMechMutation = useUpdateMech()
  const updatePilotMutation = useUpdatePilot()
  const updateEntityRefMutation = useUpdateMechEntityRef()
  const createPatternMutation = useCreatePattern()
  const [builderState, setBuilderState] = useState<BuilderState | null>(null)
  const [showSavePatternDialog, setShowSavePatternDialog] = useState(false)
  const [showRefPatternModal, setShowRefPatternModal] = useState(false)

  // No mech: show the empty state
  if (!pilot.mech_id || !mech) {
    return (
      <div className={compact ? 'p-3' : 'p-4'}>
        <PilotMechSection
          pilot={pilot}
          compact={compact}
          readOnly={!canEdit}
          mech={null}
          mechLoading={false}
        />
      </div>
    )
  }

  const sourcePattern = getMechSourcePattern(mech)

  const initialState = entityRefsToBuilderState(mech, mechRefs)

  return (
    <PilotMechTabInner
      pilot={pilot}
      mech={mech}
      mechRefs={mechRefs}
      canEdit={canEdit}
      compact={compact}
      sourcePattern={sourcePattern}
      initialState={initialState}
      user={user}
      navigate={navigate}
      updateLoadout={updateLoadout}
      updateMechMutation={updateMechMutation}
      updatePilotMutation={updatePilotMutation}
      updateEntityRefMutation={updateEntityRefMutation}
      createPatternMutation={createPatternMutation}
      builderState={builderState}
      setBuilderState={setBuilderState}
      showSavePatternDialog={showSavePatternDialog}
      setShowSavePatternDialog={setShowSavePatternDialog}
      showRefPatternModal={showRefPatternModal}
      setShowRefPatternModal={setShowRefPatternModal}
    />
  )
}

// Inner component avoids hooks after early return
function PilotMechTabInner({
  pilot,
  mech,
  mechRefs,
  canEdit,
  compact,
  sourcePattern,
  initialState,
  user,
  navigate,
  updateLoadout,
  updateMechMutation,
  updatePilotMutation,
  updateEntityRefMutation,
  createPatternMutation,
  builderState,
  setBuilderState,
  showSavePatternDialog,
  setShowSavePatternDialog,
  showRefPatternModal,
  setShowRefPatternModal,
}: {
  pilot: PilotRow
  mech: MechRow
  mechRefs: EntityRefRow[]
  canEdit: boolean
  compact?: boolean
  sourcePattern: ReturnType<typeof getMechSourcePattern>
  initialState: BuilderState
  user: { id: string } | null
  navigate: ReturnType<typeof useNavigate>
  updateLoadout: ReturnType<typeof useUpdateMechLoadout>
  updateMechMutation: ReturnType<typeof useUpdateMech>
  updatePilotMutation: ReturnType<typeof useUpdatePilot>
  updateEntityRefMutation: ReturnType<typeof useUpdateMechEntityRef>
  createPatternMutation: ReturnType<typeof useCreatePattern>
  builderState: BuilderState | null
  setBuilderState: (s: BuilderState | null) => void
  showSavePatternDialog: boolean
  setShowSavePatternDialog: (v: boolean) => void
  showRefPatternModal: boolean
  setShowRefPatternModal: (v: boolean) => void
}) {
  const [isImageUploading, setIsImageUploading] = useState(false)

  const handleShutdown = useCallback(() => {
    if (!user) return
    const mechLabel = mech.pattern_name ?? 'Mech'
    const updates = computeShutdown(mech)
    updateMechMutation.mutate(
      { mechId: mech.id, input: { ...updates, active: false } },
      {
        onSuccess: () => {
          changeLogApi
            .log(user.id, {
              targetId: mech.id,
              targetType: 'mech',
              action: 'update',
              field: 'active',
              oldValue: true,
              newValue: false,
              description: `${mechLabel} shut down: heat ${mech.current_heat} → 0, EP ${mech.current_ep} → ${mech.max_ep}`,
              reversible: true,
            })
            .catch(() => {})
          toast(`${mechLabel} shut down`)
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }, [user, mech, updateMechMutation])

  const handleActivate = useCallback(() => {
    if (!user) return
    const mechLabel = mech.pattern_name ?? 'Mech'
    const pilotUpdates = computeActivation(pilot)
    updateMechMutation.mutate(
      { mechId: mech.id, input: { active: true } },
      {
        onSuccess: () => {
          changeLogApi
            .log(user.id, {
              targetId: mech.id,
              targetType: 'mech',
              action: 'update',
              field: 'active',
              oldValue: false,
              newValue: true,
              description: `${mechLabel} activated`,
              reversible: true,
            })
            .catch(() => {})
          updatePilotMutation.mutate(
            { pilotId: pilot.id, input: { ap: pilotUpdates.ap }, userId: user.id },
            {
              onSuccess: () => {
                changeLogApi
                  .log(user.id, {
                    targetId: pilot.id,
                    targetType: 'pilot',
                    action: 'update',
                    field: 'ap',
                    oldValue: pilot.ap,
                    newValue: pilotUpdates.ap,
                    description: `${pilot.callsign} spent 1 AP to activate ${mechLabel}: AP ${pilot.ap} → ${pilotUpdates.ap}`,
                    reversible: true,
                  })
                  .catch(() => {})
                toast(`${mechLabel} activated`)
              },
              onError: (err) => toast.error(getErrorMessage(err)),
            }
          )
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }, [user, mech, pilot, updateMechMutation, updatePilotMutation])

  const handleImageFileSelected = useCallback(
    async (file: File) => {
      if (!user) return
      setIsImageUploading(true)
      try {
        const url = await uploadEntityImage(user.id, file)
        if (mech.image_path) {
          deleteEntityImage(mech.image_path)
        }
        updateMechMutation.mutate(
          { mechId: mech.id, input: { image_path: url } },
          {
            onSuccess: () => {
              if (builderState) setBuilderState({ ...builderState, customImageUrl: url })
            },
          }
        )
      } catch (err) {
        console.error('Failed to upload image:', err)
      } finally {
        setIsImageUploading(false)
      }
    },
    [user, mech, builderState, setBuilderState, updateMechMutation]
  )

  const handleImageRemove = useCallback(() => {
    if (mech.image_path) {
      deleteEntityImage(mech.image_path)
    }
    updateMechMutation.mutate({ mechId: mech.id, input: { image_path: null } })
    if (builderState) setBuilderState({ ...builderState, customImageUrl: null })
  }, [mech, builderState, setBuilderState, updateMechMutation])

  // Fetch linked player pattern for deviation detection
  const { data: linkedPlayerPattern } = usePattern(
    sourcePattern?.kind === 'player' ? sourcePattern.patternId : undefined
  )

  const isDeviated = useMemo(() => {
    if (!sourcePattern || !mechRefs) return false

    const mechItems: PatternItem[] = mechRefs
      .filter(
        (r) => (r.schema_name === 'systems' || r.schema_name === 'modules') && !isSlotOwnerRef(r)
      )
      .map((r) => ({
        schema_name: r.schema_name as 'systems' | 'modules',
        schema_ref_id: r.schema_ref_id,
        sort_order: r.sort_order,
      }))

    const sourceItems = resolveSourcePatternItems(sourcePattern, linkedPlayerPattern)
    if (!sourceItems) return false

    return hasDeviated(mechItems, sourceItems)
  }, [sourcePattern, mechRefs, linkedPlayerPattern])

  const canAutosave = !!user && builderState !== null && builderToCreateInput(builderState) !== null

  const handleAutosave = useCallback(
    (state: BuilderState | null) => {
      if (!user || !state) return

      // Patch entity_refs (systems/modules)
      const ops = builderStateToPatchOps(mechRefs, state, mech.id, user.id)
      updateLoadout.mutate(
        {
          mechId: mech.id,
          inserts: ops.inserts,
          deleteIds: ops.deleteIds,
        },
        {
          onSuccess: () => showSaveToast(`${state.name || 'Mech'} loadout saved`),
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )

      // Patch mech row if chassis or name changed
      const mechUpdate: Record<string, unknown> = {}
      if (state.chassisRef && state.chassisRef !== mech.chassis_ref) {
        mechUpdate.chassis_ref = state.chassisRef
        const stats = computeMechStatsFromRef(state.chassisRef)
        if (stats) {
          Object.assign(mechUpdate, stats)
          // Reset current values to new maxes
          mechUpdate.current_sp = stats.max_sp
          mechUpdate.current_ep = stats.max_ep
          mechUpdate.current_heat = 0
        }
      }
      if (state.name !== (mech.pattern_name ?? '')) {
        mechUpdate.pattern_name = state.name || null
      }
      if (state.customImageUrl !== mech.image_path) {
        mechUpdate.image_path = state.customImageUrl
      }
      if (Object.keys(mechUpdate).length > 0) {
        updateMechMutation.mutate(
          { mechId: mech.id, input: mechUpdate },
          { onError: (err) => toast.error(getErrorMessage(err)) }
        )
      }
    },
    [user, mech, mechRefs, updateLoadout, updateMechMutation]
  )

  useAutosave({
    value: builderState,
    onSave: handleAutosave,
    enabled: canAutosave,
  })

  const handleSaveToPatterns = useCallback(
    (patternName: string) => {
      if (!user || !builderState) return
      const input = builderToCreateInput({ ...builderState, name: patternName })
      if (!input) return
      createPatternMutation.mutate(
        { userId: user.id, input },
        {
          onSuccess: (newPattern) => {
            setShowSavePatternDialog(false)
            toast.success('Pattern saved!')
            updateMechMutation.mutate({
              mechId: mech.id,
              input: { source_pattern_id: newPattern.id, source_ref_pattern_id: null },
            })
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [
      user,
      mech.id,
      builderState,
      createPatternMutation,
      updateMechMutation,
      setShowSavePatternDialog,
    ]
  )

  const handlePatternApplied = useCallback(
    (selection: SelectedPattern) => {
      if (selection.source === 'reference') {
        updateMechMutation.mutate({
          mechId: mech.id,
          input: { source_ref_pattern_id: selection.refPatternId, source_pattern_id: null },
        })
      } else {
        updateMechMutation.mutate({
          mechId: mech.id,
          input: { source_pattern_id: selection.pattern.id, source_ref_pattern_id: null },
        })
      }
    },
    [mech.id, updateMechMutation]
  )

  const handleViewPattern = useCallback(() => {
    if (!sourcePattern) return
    if (sourcePattern.kind === 'player') {
      navigate({ to: '/patterns/$patternId', params: { patternId: sourcePattern.patternId } })
    } else {
      setShowRefPatternModal(true)
    }
  }, [sourcePattern, navigate, setShowRefPatternModal])

  const handleConditionChange = useCallback(
    (refId: string, condition: ItemCondition) => {
      updateEntityRefMutation.mutate({ refId, input: { condition }, mechId: mech.id })
    },
    [updateEntityRefMutation, mech.id]
  )

  const saveStatus = useSaveStatus({ isSaving: updateLoadout.isPending })

  if (!canEdit) {
    return (
      <div className={compact ? 'p-3' : 'p-4'}>
        <MechBuilder
          initialState={initialState}
          readOnly
          compact={compact}
          stickyHeader
          mechId={mech.id}
          mechRefs={mechRefs}
          onConditionChange={handleConditionChange}
        />
      </div>
    )
  }

  return (
    <>
      <div className={compact ? 'p-3' : 'p-4'}>
        <div className="mb-2 flex gap-2">
          {mech.active === true && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleShutdown}
              className="font-mono text-xs uppercase"
            >
              Shut Down
            </Button>
          )}
          {mech.active === false && (
            <Button
              size="sm"
              onClick={handleActivate}
              disabled={pilot.ap < 1}
              className="font-mono text-xs uppercase"
            >
              Activate (1 AP)
            </Button>
          )}
        </div>
        <MechBuilder
          initialState={initialState}
          onChange={setBuilderState}
          saveStatusText={saveStatus.statusText}
          compact={compact}
          stickyHeader
          hideFooterToggles
          sourcePattern={sourcePattern}
          isDeviated={isDeviated}
          onViewPattern={sourcePattern ? handleViewPattern : undefined}
          onPatternApplied={handlePatternApplied}
          onSaveToPatterns={sourcePattern ? undefined : () => setShowSavePatternDialog(true)}
          isSavingToPatterns={createPatternMutation.isPending}
          userId={user?.id}
          mechId={mech.id}
          mechRefs={mechRefs}
          onConditionChange={handleConditionChange}
          onImageFileSelected={handleImageFileSelected}
          onImageRemove={handleImageRemove}
          isImageUploading={isImageUploading}
        />
      </div>
      <SavePatternDialog
        open={showSavePatternDialog}
        onOpenChange={setShowSavePatternDialog}
        defaultName={builderState?.name ?? initialState.name}
        onConfirm={handleSaveToPatterns}
        isSaving={createPatternMutation.isPending}
      />
      {showRefPatternModal && sourcePattern?.kind === 'reference' && (
        <RefPatternViewModal
          refPatternId={sourcePattern.refPatternId}
          open={showRefPatternModal}
          onOpenChange={setShowRefPatternModal}
        />
      )}
    </>
  )
}
