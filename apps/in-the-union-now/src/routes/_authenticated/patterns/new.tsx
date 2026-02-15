import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuthStore } from '../../../stores/authStore'
import { useCreatePattern } from '../../../hooks/usePatterns'
import { MechBuilder } from '../../../components/patterns/MechBuilder'
import { getErrorMessage } from '../../../lib/errors'
import type { CreatePatternInput } from '../../../types/common'

export const Route = createFileRoute('/_authenticated/patterns/new')({
  component: NewPatternPage,
})

function NewPatternPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const createPattern = useCreatePattern()

  function handleSave(input: CreatePatternInput) {
    if (!user) return

    createPattern.mutate(
      { userId: user.id, input },
      {
        onSuccess: () => {
          toast.success('Pattern created')
          navigate({ to: '/' })
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

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-su-orange">New Pattern</h1>
      <MechBuilder onSave={handleSave} onCancel={handleCancel} isSaving={createPattern.isPending} />
    </div>
  )
}
