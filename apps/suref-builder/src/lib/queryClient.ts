/**
 * TanStack Query client configuration
 * Configures default options for queries and mutations
 *
 * Supports both online (API-backed) and offline (cache-only) modes.
 */

import { QueryClient } from '@tanstack/react-query'

/**
 * Enable offline mode for development/testing
 * When true, mutations will only update the cache without hitting the API
 * Useful for:
 * - Local development without backend
 * - Testing UI behavior
 * - Rapid prototyping
 *
 * Set via environment variable: VITE_OFFLINE_MODE=true
 */

/**
 * Create and configure the QueryClient
 * Default options:
 * - staleTime: 5 minutes (data is considered fresh for 5 minutes)
 * - gcTime: 10 minutes (unused data is garbage collected after 10 minutes)
 * - retry: 1 (retry failed requests once in online mode, 0 in offline mode)
 * - refetchOnWindowFocus: false (don't refetch when window regains focus)
 * - networkMode: 'offlineFirst' in offline mode, 'online' otherwise
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
