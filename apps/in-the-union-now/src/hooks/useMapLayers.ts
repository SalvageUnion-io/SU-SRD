import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getMapLayers,
  getMapLayer,
  upsertMapLayer,
  updateMapLayer,
  deleteMapLayer,
} from '../lib/api/mapApi'
import type { MapLayerRow, MapLayerInsert, MapLayerUpdate } from '../types/common'

export const mapKeys = {
  all: ['maps'] as const,
  forCampaign: (campaignId: string) => [...mapKeys.all, campaignId] as const,
  layer: (campaignId: string, tier: string, parentZoneId: string | null) =>
    [...mapKeys.all, campaignId, tier, parentZoneId ?? '__root__'] as const,
}

export function useMapLayers(campaignId: string | undefined) {
  return useQuery({
    queryKey: mapKeys.forCampaign(campaignId ?? ''),
    queryFn: () => getMapLayers(campaignId!),
    enabled: !!campaignId,
  })
}

export function useMapLayer(
  campaignId: string | undefined,
  tier: string,
  parentZoneId: string | null
) {
  return useQuery({
    queryKey: mapKeys.layer(campaignId ?? '', tier, parentZoneId),
    queryFn: () => getMapLayer(campaignId!, tier, parentZoneId),
    enabled: !!campaignId,
  })
}

export function useUpsertMapLayer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: MapLayerInsert) => upsertMapLayer(input),
    onSuccess: (data: MapLayerRow) => {
      queryClient.invalidateQueries({ queryKey: mapKeys.forCampaign(data.campaign_id) })
      queryClient.setQueryData(
        mapKeys.layer(data.campaign_id, data.tier, data.parent_zone_id),
        data
      )
    },
  })
}

export function useUpdateMapLayer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ layerId, input }: { layerId: string; input: MapLayerUpdate }) =>
      updateMapLayer(layerId, input),
    onMutate: async ({ layerId, input }) => {
      // Find current cached layer to do optimistic update
      const allQueries = queryClient.getQueriesData<MapLayerRow | null>({
        queryKey: mapKeys.all,
      })
      for (const [key, data] of allQueries) {
        if (data && 'id' in data && data.id === layerId) {
          await queryClient.cancelQueries({ queryKey: key })
          queryClient.setQueryData(key, { ...data, ...input })
          return { key, previous: data }
        }
      }
      return undefined
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous)
      }
    },
    onSuccess: (data: MapLayerRow) => {
      queryClient.setQueryData(
        mapKeys.layer(data.campaign_id, data.tier, data.parent_zone_id),
        data
      )
      queryClient.invalidateQueries({ queryKey: mapKeys.forCampaign(data.campaign_id) })
    },
  })
}

export function useDeleteMapLayer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ layerId }: { layerId: string; campaignId: string }) => deleteMapLayer(layerId),
    onSuccess: (_data, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: mapKeys.forCampaign(campaignId) })
    },
  })
}
