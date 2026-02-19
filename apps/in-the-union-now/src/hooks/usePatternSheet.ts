import { useState, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { showSaveToast } from '../lib/toastUtils'
import { useAuthStore } from '../stores/authStore'
import { usePattern, useCreatePattern, useUpdatePattern, useDeletePattern } from './usePatterns'
import { useAutosave } from './useAutosave'
import { useSaveStatus } from './useSaveStatus'
import type { SaveStatus } from './useSaveStatus'
import { getEntityAccess } from '../lib/entityAccess'
import { getErrorMessage } from '../lib/errors'
import { patternToBuilderState, builderToCreateInput } from '../lib/builderUtils'
import type { BuilderState } from '../lib/builderUtils'

export type PatternEditConfig = {
  canEdit: boolean
  readOnly: boolean
  saveStatus: SaveStatus
  builderState: BuilderState | null
  onBuilderChange: (s: BuilderState | null) => void
  onCopy: () => void
  onDelete: () => void
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

  const canAutosave = !!user && builderState !== null && builderToCreateInput(builderState) !== null

  const handleAutosave = useCallback(
    (state: BuilderState | null) => {
      if (!user || !state) return
      const input = builderToCreateInput(state)
      if (!input) return

      updatePattern.mutate(
        { patternId, input, userId: user.id },
        {
          onSuccess: () => showSaveToast(),
          onError: (err) => toast.error(getErrorMessage(err)),
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
        saveStatus,
        builderState,
        onBuilderChange: setBuilderState,
        onCopy: handleCopy,
        onDelete: handleDelete,
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
  }
}
