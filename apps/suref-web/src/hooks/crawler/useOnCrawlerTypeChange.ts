import { useCallback } from 'react'
import { useHydratedCrawler } from './useHydratedCrawler'
import { useDeleteEntity, useCreateEntity } from '../suentity/useSUEntities'

export function useOnCrawlerTypeChange(id: string) {
  const { crawler, selectedCrawlerType } = useHydratedCrawler(id)
  const deleteEntity = useDeleteEntity()
  const createEntity = useCreateEntity()

  return useCallback(
    async (crawlerTypeId: string | null) => {
      if (!id || !crawler) return

      if (selectedCrawlerType) {
        deleteEntity.mutate({ id: selectedCrawlerType.id, parentType: 'crawler', parentId: id })
      }

      if (!crawlerTypeId) {
        return
      }

      createEntity.mutate({
        crawler_id: id,
        schema_name: 'crawlers',
        schema_ref_id: crawlerTypeId,
      })
    },
    [id, crawler, selectedCrawlerType, deleteEntity, createEntity]
  )
}
