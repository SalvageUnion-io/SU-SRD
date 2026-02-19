import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuthStore } from '../stores/authStore'
import { usePattern, useCreatePattern, useUpdatePattern, useDeletePattern } from './usePatterns'
import { getEntityAccess } from '../lib/entityAccess'
import { getErrorMessage } from '../lib/errors'
import { patternToBuilderState, builderToCreateInput } from '../lib/builderUtils'
import type { BuilderState } from '../lib/builderUtils'

export type PatternEditConfig = {
  canEdit: boolean
  readOnly: boolean
  onBuilderChange: (s: BuilderState | null) => void
  onSave: () => void
  onCancel: () => void
  onCopy: () => void
  onDelete: () => void
  isDirty: boolean
  isSaving: boolean
  isCopying: boolean
  isDeleting: boolean
}

export function usePatternSheet(patternId: string) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { data: pattern, isLoading, error } = usePattern(patternId)
  const createPattern = useCreatePattern()
  const updatePattern = useUpdatePattern()
  const deletePattern = useDeletePattern()
  const [showDelete, setShowDelete] = useState(false)
  const [builderState, setBuilderState] = useState<BuilderState | null>(null)

  const isDirty = useMemo(() => {
    if (!builderState || !pattern) return false
    return JSON.stringify(builderState) !== JSON.stringify(patternToBuilderState(pattern))
  }, [builderState, pattern])

  const canSave = useMemo(() => {
    if (!builderState) return false
    return builderToCreateInput(builderState) !== null
  }, [builderState])

  const handleSave = useCallback(() => {
    if (!user || !builderState) return
    const input = builderToCreateInput(builderState)
    if (!input) return

    updatePattern.mutate(
      { patternId, input, userId: user.id },
      {
        onSuccess: () => toast.success('Pattern saved'),
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }, [user, builderState, patternId, updatePattern])

  const handleCancel = useCallback(() => {
    setBuilderState(null)
  }, [])

  const access = pattern ? getEntityAccess(pattern, user?.id) : undefined
  const canEdit = access?.canView ? access.canEdit : false

  const handleCopy = useCallback(() => {
    if (!user || !pattern) return
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
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }, [user, pattern, builderState, createPattern, navigate])

  const handleDelete = useCallback(() => {
    if (!user) return
    deletePattern.mutate(
      { patternId, userId: user.id },
      {
        onSuccess: () => {
          toast.success('Pattern deleted')
          navigate({ to: '/' })
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }, [user, patternId, deletePattern, navigate])

  const editConfig: PatternEditConfig | undefined = access?.canView
    ? {
        canEdit,
        readOnly: !canEdit,
        onBuilderChange: setBuilderState,
        onSave: handleSave,
        onCancel: handleCancel,
        onCopy: handleCopy,
        onDelete: handleDelete,
        isDirty,
        isSaving: updatePattern.isPending,
        isCopying: createPattern.isPending,
        isDeleting: deletePattern.isPending,
      }
    : undefined

  return {
    pattern,
    isLoading,
    error,
    access,
    editConfig,
    showDelete,
    setShowDelete,
    canSave,
  }
}
