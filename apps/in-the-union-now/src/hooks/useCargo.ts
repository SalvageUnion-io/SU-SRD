import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listCargo, addCargo, deleteCargo } from '../lib/api/cargoApi'
import type { CargoParentType, CargoInput } from '../lib/api/cargoApi'

export function useCargoQuery(
  parentId: string | undefined,
  parentType: CargoParentType,
  queryKey: readonly unknown[]
) {
  return useQuery({
    queryKey,
    queryFn: () => listCargo(parentId!, parentType),
    enabled: !!parentId,
  })
}

export function useAddCargo(
  queryKey: (parentId: string) => readonly unknown[],
  parentType: CargoParentType
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      parentId,
      userId,
      input,
    }: {
      parentId: string
      userId: string
      input: CargoInput
    }) => addCargo(parentId, parentType, userId, input),
    onSuccess: (_data, { parentId }) => {
      queryClient.invalidateQueries({ queryKey: queryKey(parentId) })
    },
  })
}

export function useDeleteCargo(queryKey: (parentId: string) => readonly unknown[]) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ cargoId }: { cargoId: string; parentId: string }) => deleteCargo(cargoId),
    onSuccess: (_data, { parentId }) => {
      queryClient.invalidateQueries({ queryKey: queryKey(parentId) })
    },
  })
}
