import { useState, useMemo, useCallback } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { toast } from 'sonner'
import { showSaveToast } from '../lib/toastUtils'
import { useUpdateMechLoadout } from './useMechs'
import {
  getSlotOwnerRefs,
  resolveBuiltInSystems,
  resolvePlayerItems,
  computeSlotCapacity,
  slotOwnerMetadata,
} from '../lib/entityModificationUtils'
import type { ResolvedItem, CapacityInfo } from '../lib/builderUtils'
import type { EntityRefRow } from '../types/common'
import type { BuilderSchemaName } from '../components/patterns/ReferenceEntitySelectionModal'
import { getErrorMessage } from '../lib/errors'

type ModalTarget = 'systems' | 'modules' | null

type UseEntityModificationsOptions = {
  entity: SURefEntity
  mechId: string
  mechRefs: EntityRefRow[]
  userId?: string
}

type UseEntityModificationsReturn = {
  builtInSystemItems: ResolvedItem[]
  playerSystemItems: ResolvedItem[]
  playerModuleItems: ResolvedItem[]
  capacity: CapacityInfo
  modalTarget: ModalTarget
  openModal: (target: BuilderSchemaName) => void
  closeModal: () => void
  addItem: (entityId: string) => void
  removeItem: (sortOrder: number) => void
}

export function useEntityModifications({
  entity,
  mechId,
  mechRefs,
  userId,
}: UseEntityModificationsOptions): UseEntityModificationsReturn {
  const [modalTarget, setModalTarget] = useState<ModalTarget>(null)
  const updateLoadout = useUpdateMechLoadout()

  const ownerRefs = useMemo(() => getSlotOwnerRefs(mechRefs, entity.id), [mechRefs, entity.id])

  const builtInItems = useMemo(() => resolveBuiltInSystems(entity), [entity])

  const playerItems = useMemo(() => resolvePlayerItems(ownerRefs), [ownerRefs])

  const capacity = useMemo(
    () => computeSlotCapacity(entity, builtInItems, playerItems),
    [entity, builtInItems, playerItems]
  )

  const builtInSystemItems = useMemo(
    () => builtInItems.filter((i) => i.schema_name === 'systems'),
    [builtInItems]
  )

  const playerSystemItems = useMemo(
    () => playerItems.filter((i) => i.schema_name === 'systems'),
    [playerItems]
  )

  const playerModuleItems = useMemo(
    () => playerItems.filter((i) => i.schema_name === 'modules'),
    [playerItems]
  )

  const openModal = useCallback((target: BuilderSchemaName) => {
    if (target === 'systems' || target === 'modules') {
      setModalTarget(target)
    }
  }, [])

  const closeModal = useCallback(() => setModalTarget(null), [])

  const entityName = 'name' in entity && typeof entity.name === 'string' ? entity.name : 'Entity'

  const addItem = useCallback(
    (entityId: string) => {
      if (!modalTarget || !userId) return
      const allSortOrders = mechRefs.map((r) => r.sort_order)
      const newSortOrder = allSortOrders.length > 0 ? Math.max(...allSortOrders) + 1 : 0

      updateLoadout.mutate(
        {
          mechId,
          inserts: [
            {
              parent_id: mechId,
              parent_type: 'mech' as const,
              schema_name: modalTarget,
              schema_ref_id: entityId,
              sort_order: newSortOrder,
              user_id: userId,
              metadata: slotOwnerMetadata(entity.id),
            },
          ],
          deleteIds: [],
        },
        {
          onSuccess: () => showSaveToast(`${entityName} loadout updated`),
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
      setModalTarget(null)
    },
    [modalTarget, mechId, mechRefs, userId, entity.id, entityName, updateLoadout]
  )

  const removeItem = useCallback(
    (sortOrder: number) => {
      const ref = ownerRefs.find((r) => r.sort_order === sortOrder)
      if (!ref) return

      updateLoadout.mutate(
        {
          mechId,
          inserts: [],
          deleteIds: [ref.id],
        },
        {
          onSuccess: () => showSaveToast(`${entityName} loadout updated`),
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [ownerRefs, mechId, entityName, updateLoadout]
  )

  return {
    builtInSystemItems,
    playerSystemItems,
    playerModuleItems,
    capacity,
    modalTarget,
    openModal,
    closeModal,
    addItem,
    removeItem,
  }
}
