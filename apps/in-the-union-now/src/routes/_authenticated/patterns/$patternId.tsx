import { useState, useCallback } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuthStore } from '../../../stores/authStore'
import {
  usePattern,
  useCreatePattern,
  useUpdatePattern,
  useDeletePattern,
} from '../../../hooks/usePatterns'
import { useAutosave } from '../../../hooks/useAutosave'
import { useSaveStatus } from '../../../hooks/useSaveStatus'
import { MechBuilder } from '../../../components/patterns/MechBuilder'
import { DeletePatternDialog } from '../../../components/patterns/DeletePatternDialog'
import { PageSkeleton } from '../../../components/shared/PageSkeleton'
import { NotFoundState } from '../../../components/shared/NotFoundState'
import { getErrorMessage } from '../../../lib/errors'
import { getEntityAccess } from '../../../lib/entityAccess'
import { patternToBuilderState, builderToCreateInput } from '../../../lib/builderUtils'
import type { BuilderState } from '../../../lib/builderUtils'

export const Route = createFileRoute('/_authenticated/patterns/$patternId')({
  component: EditPatternPage,
})

function EditPatternPage() {
  const { patternId } = Route.useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { data: pattern, isLoading, error } = usePattern(patternId)
  const createPattern = useCreatePattern()
  const updatePattern = useUpdatePattern()
  const deletePattern = useDeletePattern()
  const [showDelete, setShowDelete] = useState(false)
  const [builderState, setBuilderState] = useState<BuilderState | null>(null)

  const canAutosave = !!user && builderState !== null && builderToCreateInput(builderState) !== null

  const handleAutosave = useCallback(
    (state: BuilderState | null) => {
      if (!user || !state) return
      const input = builderToCreateInput(state)
      if (!input) return

      updatePattern.mutate(
        { patternId, input, userId: user.id },
        {
          onSuccess: () => {
            toast.success('Saved', { id: 'autosave', duration: 1500 })
          },
          onError: (err) => {
            toast.error(getErrorMessage(err))
          },
        }
      )
    },
    [user, patternId, updatePattern]
  )

  useAutosave({
    value: builderState,
    onSave: handleAutosave,
    enabled: canAutosave,
  })

  const saveStatus = useSaveStatus({ isSaving: updatePattern.isPending })

  function handleCopy() {
    if (!user || !pattern) return

    // Use current builder state if available, otherwise fall back to pattern data
    const source = builderState ?? patternToBuilderState(pattern)
    const input = builderToCreateInput(source)
    if (!input) return

    createPattern.mutate(
      { userId: user.id, input: { ...input, name: `Copy of ${input.name}`, visible: false } },
      {
        onSuccess: (newPattern) => {
          toast.success('Pattern copied')
          navigate({ to: '/patterns/$patternId', params: { patternId: newPattern.id } })
        },
        onError: (err) => {
          toast.error(getErrorMessage(err))
        },
      }
    )
  }

  function handleDelete() {
    if (!user) return

    deletePattern.mutate(
      { patternId, userId: user.id },
      {
        onSuccess: () => {
          toast.success('Pattern deleted')
          navigate({ to: '/' })
        },
        onError: (err) => {
          toast.error(getErrorMessage(err))
        },
      }
    )
  }

  if (isLoading) return <PageSkeleton />

  const access = pattern ? getEntityAccess(pattern, user?.id) : undefined

  if (error || !pattern || !access?.canView) {
    return <NotFoundState message="Pattern not found." />
  }

  if (!access.canEdit) {
    return (
      <div className="flex flex-col gap-4">
        <MechBuilder initialState={patternToBuilderState(pattern)} readOnly />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <MechBuilder
        initialState={patternToBuilderState(pattern)}
        onChange={setBuilderState}
        saveStatus={saveStatus}
        onDelete={() => setShowDelete(true)}
        onCopy={handleCopy}
        isDeleting={deletePattern.isPending}
        isCopying={createPattern.isPending}
      />
      <DeletePatternDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        patternName={pattern.name}
        onConfirm={handleDelete}
        isDeleting={deletePattern.isPending}
      />
    </div>
  )
}
