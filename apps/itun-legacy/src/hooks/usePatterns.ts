import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listPatterns,
  getPatternById,
  createPattern,
  updatePattern,
  deletePattern,
} from '../lib/api/patternApi'
import type { CreatePatternInput, TypedPatternRow, UpdatePatternInput } from '../types/common'

const patternKeys = {
  all: ['patterns'] as const,
  lists: () => [...patternKeys.all, 'list'] as const,
  list: (userId: string) => [...patternKeys.lists(), userId] as const,
  details: () => [...patternKeys.all, 'detail'] as const,
  detail: (id: string) => [...patternKeys.details(), id] as const,
}

export function usePatterns(userId: string | undefined) {
  return useQuery({
    queryKey: patternKeys.list(userId ?? ''),
    queryFn: () => listPatterns(userId!),
    enabled: !!userId,
  })
}

export function usePattern(patternId: string | undefined) {
  return useQuery({
    queryKey: patternKeys.detail(patternId ?? ''),
    queryFn: () => getPatternById(patternId!),
    enabled: !!patternId,
  })
}

export function useCreatePattern() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: CreatePatternInput }) =>
      createPattern(userId, input),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: patternKeys.list(userId) })
    },
  })
}

export function useUpdatePattern() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      patternId,
      input,
    }: {
      patternId: string
      input: UpdatePatternInput
      userId: string
    }) => updatePattern(patternId, input),
    onSuccess: (data: TypedPatternRow, { userId }) => {
      queryClient.invalidateQueries({ queryKey: patternKeys.list(userId) })
      queryClient.setQueryData(patternKeys.detail(data.id), data)
    },
  })
}

export function useDeletePattern() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ patternId }: { patternId: string; userId: string }) => deletePattern(patternId),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: patternKeys.list(userId) })
    },
  })
}
