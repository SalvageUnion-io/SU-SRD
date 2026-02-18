import { useState, useCallback, useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { showSaveToast } from '../../../../lib/toastUtils'
import { useAuthStore } from '../../../../stores/authStore'
import { usePilot } from '../../../../hooks/usePilots'
import { useMech, useMechEntityRefs, useUpdateMech, useUpdateMechLoadout } from '../../../../hooks/useMechs'
import { useCreatePattern, usePattern } from '../../../../hooks/usePatterns'
import { useAutosave } from '../../../../hooks/useAutosave'
import { useSaveStatus } from '../../../../hooks/useSaveStatus'
import { entityRefsToBuilderState, builderStateToPatchOps, getMechSourcePattern } from '../../../../lib/mechUtils'
import { builderToCreateInput } from '../../../../lib/builderUtils'
import { hasDeviated, resolveSourcePatternItems } from '../../../../lib/deviationUtils'
import type { BuilderState } from '../../../../lib/builderUtils'
import type { SelectedPattern, PatternItem } from '../../../../types/common'
import { MechBuilder } from '../../../../components/patterns/MechBuilder'
import { SavePatternDialog } from '../../../../components/patterns/SavePatternDialog'
import { RefPatternViewModal } from '../../../../components/patterns/RefPatternViewModal'
import { PageSkeleton } from '../../../../components/shared/PageSkeleton'
import { NotFoundState } from '../../../../components/shared/NotFoundState'
import { getErrorMessage } from '../../../../lib/errors'
import { getEntityAccess } from '../../../../lib/entityAccess'

export const Route = createFileRoute('/_authenticated/pilots/$pilotId/mech-bay')({
  component: MechBayPage,
})

function MechBayPage() {
  const { pilotId } = Route.useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { data: pilot, isLoading: pilotLoading } = usePilot(pilotId)
  const { data: mech, isLoading: mechLoading } = useMech(pilot?.mech_id ?? undefined)
  const { data: mechRefs, isLoading: refsLoading } = useMechEntityRefs(pilot?.mech_id ?? undefined)
  const updateLoadout = useUpdateMechLoadout()
  const updateMechMutation = useUpdateMech()
  const createPatternMutation = useCreatePattern()
  const [builderState, setBuilderState] = useState<BuilderState | null>(null)
  const [showSavePatternDialog, setShowSavePatternDialog] = useState(false)
  const [showRefPatternModal, setShowRefPatternModal] = useState(false)

  // Derive source pattern from mech
  const sourcePattern = mech ? getMechSourcePattern(mech) : null

  // Fetch linked player pattern for deviation detection
  const { data: linkedPlayerPattern } = usePattern(
    sourcePattern?.kind === 'player' ? sourcePattern.patternId : undefined
  )

  // Compute deviation
  const isDeviated = useMemo(() => {
    if (!sourcePattern || !mechRefs) return false

    const mechItems: PatternItem[] = mechRefs
      .filter((r) => r.schema_name === 'systems' || r.schema_name === 'modules')
      .map((r) => ({
        schema_name: r.schema_name as 'systems' | 'modules',
        schema_ref_id: r.schema_ref_id,
        sort_order: r.sort_order,
      }))

    const sourceItems = resolveSourcePatternItems(sourcePattern, linkedPlayerPattern)
    if (!sourceItems) return false

    return hasDeviated(mechItems, sourceItems)
  }, [sourcePattern, mechRefs, linkedPlayerPattern])

  const canAutosave =
    !!user &&
    !!mech &&
    !!mechRefs &&
    builderState !== null &&
    builderToCreateInput(builderState) !== null

  const handleAutosave = useCallback(
    (state: BuilderState | null) => {
      if (!user || !mech || !mechRefs || !state) return
      const ops = builderStateToPatchOps(mechRefs, state, mech.id, user.id)
      updateLoadout.mutate(
        {
          mechId: mech.id,
          inserts: ops.inserts,
          deleteIds: ops.deleteIds,
        },
        {
          onSuccess: () => showSaveToast(),
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [user, mech, mechRefs, updateLoadout]
  )

  useAutosave({
    value: builderState,
    onSave: handleAutosave,
    enabled: canAutosave,
  })

  const handleSaveToPatterns = useCallback(
    (patternName: string) => {
      if (!user || !mech || !builderState) return
      const input = builderToCreateInput({ ...builderState, name: patternName })
      if (!input) return
      createPatternMutation.mutate(
        { userId: user.id, input },
        {
          onSuccess: (newPattern) => {
            setShowSavePatternDialog(false)
            toast.success('Pattern saved!')
            // Link the mech to the newly created pattern
            updateMechMutation.mutate({
              mechId: mech.id,
              input: { source_pattern_id: newPattern.id, source_ref_pattern_id: null },
            })
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [user, mech, builderState, createPatternMutation, updateMechMutation]
  )

  const handlePatternApplied = useCallback(
    (selection: SelectedPattern) => {
      if (!mech) return
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
    [mech, updateMechMutation]
  )

  const handleViewPattern = useCallback(() => {
    if (!sourcePattern) return
    if (sourcePattern.kind === 'player') {
      navigate({ to: '/patterns/$patternId', params: { patternId: sourcePattern.patternId } })
    } else {
      setShowRefPatternModal(true)
    }
  }, [sourcePattern, navigate])

  const saveStatus = useSaveStatus({ isSaving: updateLoadout.isPending })

  const isLoading = pilotLoading || mechLoading || refsLoading

  if (isLoading) return <PageSkeleton />

  if (!pilot || !pilot.mech_id) {
    return (
      <NotFoundState
        message="No mech found for this pilot."
        backTo={`/pilots/${pilotId}`}
        backLabel="Back to Pilot"
      />
    )
  }

  const access = getEntityAccess(pilot, user?.id)

  if (!access.canView) {
    return <NotFoundState message="You don't have access to this mech." />
  }

  if (!mech || !mechRefs) return <PageSkeleton />

  const initialState = entityRefsToBuilderState(mech, mechRefs)

  if (!access.canEdit) {
    return (
      <div className="flex flex-col gap-4">
        <MechBuilder initialState={initialState} readOnly />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <MechBuilder
        initialState={initialState}
        onChange={setBuilderState}
        saveStatus={saveStatus}
        hideFooterToggles
        sourcePattern={sourcePattern}
        isDeviated={isDeviated}
        onViewPattern={sourcePattern ? handleViewPattern : undefined}
        onPatternApplied={handlePatternApplied}
        onSaveToPatterns={sourcePattern ? undefined : () => setShowSavePatternDialog(true)}
        isSavingToPatterns={createPatternMutation.isPending}
        userId={user?.id}
      />
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
    </div>
  )
}
