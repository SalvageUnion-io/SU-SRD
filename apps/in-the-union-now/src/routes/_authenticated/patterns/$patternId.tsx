import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuthStore } from '../../../stores/authStore'
import {
  usePattern,
  useCreatePattern,
  useUpdatePattern,
  useDeletePattern,
} from '../../../hooks/usePatterns'
import { MechBuilder } from '../../../components/patterns/MechBuilder'
import { DeletePatternDialog } from '../../../components/patterns/DeletePatternDialog'
import { Button } from '../../../components/ui/button'
import { Skeleton } from '../../../components/ui/skeleton'
import { getErrorMessage } from '../../../lib/errors'
import { getPatternAccess } from '../../../lib/patternAccess'
import { patternToBuilderState } from '../../../lib/builderUtils'
import type { CreatePatternInput } from '../../../types/common'

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

  function handleSave(input: CreatePatternInput) {
    if (!user) return

    updatePattern.mutate(
      { patternId, input, userId: user.id },
      {
        onSuccess: () => {
          toast.success('Pattern updated')
        },
        onError: (error) => {
          toast.error(getErrorMessage(error))
        },
      }
    )
  }

  function handleCancel() {
    navigate({ to: '/' })
  }

  function handleCopy() {
    if (!user || !pattern) return

    const copyInput: CreatePatternInput = {
      name: `Copy of ${pattern.name}`,
      chassis_ref: pattern.chassis_ref,
      description: pattern.description ?? '',
      visible: false,
      pattern_items: pattern.pattern_items,
    }

    createPattern.mutate(
      { userId: user.id, input: copyInput },
      {
        onSuccess: (newPattern) => {
          toast.success('Pattern copied')
          navigate({ to: '/patterns/$patternId', params: { patternId: newPattern.id } })
        },
        onError: (error) => {
          toast.error(getErrorMessage(error))
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
        onError: (error) => {
          toast.error(getErrorMessage(error))
        },
      }
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const access = pattern ? getPatternAccess(pattern, user?.id) : undefined

  if (error || !pattern || !access?.canView) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-su-grey-dark">Pattern not found.</p>
        <Button variant="outline" onClick={() => navigate({ to: '/' })}>
          Back to Dashboard
        </Button>
      </div>
    )
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
        onSave={handleSave}
        onCancel={handleCancel}
        onDelete={() => setShowDelete(true)}
        onCopy={handleCopy}
        isSaving={updatePattern.isPending}
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
