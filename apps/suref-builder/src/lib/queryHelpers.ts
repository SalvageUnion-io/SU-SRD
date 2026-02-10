/**
 * Query state helpers for combining multiple TanStack Query states
 */

/**
 * Combines loading and error states from multiple queries
 *
 * @param queries - Array of query objects with isLoading and error properties
 * @returns Combined loading and error states
 *
 * @example
 * ```tsx
 * const { loading, error } = combineQueryStates(
 *   { isLoading: pilotLoading, error: pilotError },
 *   { isLoading: entitiesLoading, error: entitiesError }
 * )
 * ```
 */
export function combineQueryStates(...queries: Array<{ isLoading: boolean; error: unknown }>): {
  loading: boolean
  error: string | null
} {
  const loading = queries.some((q) => q.isLoading)
  const errorQuery = queries.find((q) => q.error)
  const error = errorQuery?.error ? String(errorQuery.error) : null

  return { loading, error }
}
