import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { useAuthStore } from '../../../stores/authStore'
import { usePattern, useUpdatePattern, useDeletePattern } from '../../../hooks/usePatterns'
import { MechBuilder } from '../../../components/patterns/MechBuilder'
import { DeletePatternDialog } from '../../../components/patterns/DeletePatternDialog'
import { Button } from '../../../components/ui/button'
import { Skeleton } from '../../../components/ui/skeleton'
import { getErrorMessage } from '../../../lib/errors'
import type { BuilderState } from '../../../lib/builderUtils'
import type { CreatePatternInput, TypedPatternRow } from '../../../types/common'

export const Route = createFileRoute('/_authenticated/patterns/$patternId')({
  component: EditPatternPage,
})

function patternToBuilderState(pattern: TypedPatternRow): BuilderState {
  return {
    name: pattern.name,
    chassisRef: pattern.chassis_ref,
    description: pattern.description ?? '',
    items: pattern.pattern_items,
  }
}

function EditPatternPage() {
  const { patternId } = Route.useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { data: pattern, isLoading, error } = usePattern(patternId)
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
        onError: (err) => {
          toast.error(getErrorMessage(err))
        },
      }
    )
  }

  function handleCancel() {
    navigate({ to: '/' })
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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !pattern) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-su-grey-dark">Pattern not found.</p>
        <Button variant="outline" onClick={() => navigate({ to: '/' })}>
          Back to Dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-su-orange">Edit Pattern</h1>
        <Button
          variant="ghost"
          size="sm"
          className="text-su-grey-dark hover:text-su-rust"
          onClick={() => setShowDelete(true)}
        >
          <Trash2 className="mr-1 h-4 w-4" />
          Delete
        </Button>
      </div>
      <MechBuilder
        initialState={patternToBuilderState(pattern)}
        onSave={handleSave}
        onCancel={handleCancel}
        isSaving={updatePattern.isPending}
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
