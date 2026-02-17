import { useState, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuthStore } from '../../../../stores/authStore'
import { usePilot } from '../../../../hooks/usePilots'
import { useMech, useMechEntityRefs, useUpdateMechLoadout } from '../../../../hooks/useMechs'
import { useCreatePattern } from '../../../../hooks/usePatterns'
import { useAutosave } from '../../../../hooks/useAutosave'
import { useSaveStatus } from '../../../../hooks/useSaveStatus'
import { entityRefsToBuilderState, builderStateToPatchOps } from '../../../../lib/mechUtils'
import { builderToCreateInput } from '../../../../lib/builderUtils'
import type { BuilderState } from '../../../../lib/builderUtils'
import { MechBuilder } from '../../../../components/patterns/MechBuilder'
import { SavePatternDialog } from '../../../../components/patterns/SavePatternDialog'
import { PageSkeleton } from '../../../../components/shared/PageSkeleton'
import { NotFoundState } from '../../../../components/shared/NotFoundState'
import { getErrorMessage } from '../../../../lib/errors'
import { getEntityAccess } from '../../../../lib/entityAccess'

export const Route = createFileRoute('/_authenticated/pilots/$pilotId/mech-bay')({
  component: MechBayPage,
})

function MechBayPage() {
  const { pilotId } = Route.useParams()
  const user = useAuthStore((s) => s.user)
  const { data: pilot, isLoading: pilotLoading } = usePilot(pilotId)
  const { data: mech, isLoading: mechLoading } = useMech(pilot?.mech_id ?? undefined)
  const { data: mechRefs, isLoading: refsLoading } = useMechEntityRefs(pilot?.mech_id ?? undefined)
  const updateLoadout = useUpdateMechLoadout()
  const createPatternMutation = useCreatePattern()
  const [builderState, setBuilderState] = useState<BuilderState | null>(null)
  const [showSavePatternDialog, setShowSavePatternDialog] = useState(false)

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
          onSuccess: () => toast.success('Saved', { id: 'autosave', duration: 1500 }),
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
      if (!user || !builderState) return
      const input = builderToCreateInput({ ...builderState, name: patternName })
      if (!input) return
      createPatternMutation.mutate(
        { userId: user.id, input },
        {
          onSuccess: () => {
            setShowSavePatternDialog(false)
            toast.success('Pattern saved!')
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [user, builderState, createPatternMutation]
  )

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
        onSaveToPatterns={() => setShowSavePatternDialog(true)}
        isSavingToPatterns={createPatternMutation.isPending}
      />
      <SavePatternDialog
        open={showSavePatternDialog}
        onOpenChange={setShowSavePatternDialog}
        defaultName={builderState?.name ?? initialState.name}
        onConfirm={handleSaveToPatterns}
        isSaving={createPatternMutation.isPending}
      />
    </div>
  )
}
