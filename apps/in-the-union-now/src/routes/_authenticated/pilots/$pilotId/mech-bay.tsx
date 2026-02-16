import { useState, useCallback } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuthStore } from '../../../../stores/authStore'
import { usePilot } from '../../../../hooks/usePilots'
import { useMech, useMechEntityRefs, useUpdateMechLoadout } from '../../../../hooks/useMechs'
import { useAutosave } from '../../../../hooks/useAutosave'
import { useSaveStatus } from '../../../../hooks/useSaveStatus'
import { entityRefsToBuilderState, builderStateToPatchOps } from '../../../../lib/mechUtils'
import { patternToBuilderState, builderToCreateInput } from '../../../../lib/builderUtils'
import type { BuilderState } from '../../../../lib/builderUtils'
import { MechBuilder } from '../../../../components/patterns/MechBuilder'
import { Button } from '../../../../components/ui/button'
import { Skeleton } from '../../../../components/ui/skeleton'
import { getErrorMessage } from '../../../../lib/errors'
import { getPatternAccess } from '../../../../lib/patternAccess'

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
  const [builderState, setBuilderState] = useState<BuilderState | null>(null)

  const canAutosave =
    !!user &&
    !!mech &&
    !!mechRefs &&
    builderState !== null &&
    builderToCreateInput(builderState) !== null

  const handleAutosave = useCallback(
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
    value: builderState,
    onSave: handleAutosave,
    enabled: canAutosave,
  })

  const saveStatus = useSaveStatus({ isSaving: updateLoadout.isPending })

  const isLoading = pilotLoading || mechLoading || refsLoading

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!pilot || !pilot.mech_id) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-su-grey-dark">No mech found for this pilot.</p>
        <Button
          variant="outline"
          onClick={() => navigate({ to: '/pilots/$pilotId', params: { pilotId } })}
        >
          Back to Pilot
        </Button>
      </div>
    )
  }

  const access = getPatternAccess(pilot, user?.id)

  if (!access.canView) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-su-grey-dark">You don't have access to this mech.</p>
        <Button variant="outline" onClick={() => navigate({ to: '/' })}>
          Back to Dashboard
        </Button>
      </div>
    )
  }

  if (!mech || !mechRefs) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

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
        onSaveToPatterns={() => toast.success('Pattern saved! (coming soon)')}
      />
    </div>
  )
}
