import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchCrawler,
  fetchUserCrawlers,
  createCrawler,
  updateCrawler,
  deleteCrawler,
} from '../lib/api/crawlers'
import { crawlerKeys } from './queryKeys'
import { useAuthStore } from '../stores/authStore'
import type { UpdateCrawlerInput } from '../lib/validation'

export function useCrawler(id: string) {
  return useQuery({
    queryKey: crawlerKeys.byId(id),
    queryFn: () => fetchCrawler(id),
    enabled: !!id,
  })
}

export function useUserCrawlers() {
  return useQuery({
    queryKey: crawlerKeys.userCrawlers,
    queryFn: fetchUserCrawlers,
  })
}

export function useCreateCrawler() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: (input: { name: string; crawler_ref?: string | null }) => {
      if (!user) throw new Error('Not authenticated')
      return createCrawler(input, user.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crawlerKeys.all })
    },
  })
}

export function useUpdateCrawler(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateCrawlerInput) => updateCrawler(id, input),
    onSuccess: (data) => {
      queryClient.setQueryData(crawlerKeys.byId(id), data)
      queryClient.invalidateQueries({ queryKey: crawlerKeys.userCrawlers })
    },
  })
}

export function useDeleteCrawler() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteCrawler,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crawlerKeys.all })
    },
  })
}
