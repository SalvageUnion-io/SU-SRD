/**
 * Server-side authentication functions for TanStack Start
 * These functions run on the server and provide secure auth checks
 */

import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import { fetchCurrentUser } from './supabase.server'

/**
 * Server function to require authentication
 * Throws redirect to dashboard if not authenticated
 *
 * @returns Authenticated user object
 * @throws Redirect to /dashboard with auth=required search param
 *
 * @example
 * ```typescript
 * // In a route loader
 * export const Route = createFileRoute('/dashboard/pilots/$id')({
 *   loader: async () => {
 *     const user = await requireAuth()
 *     // User is guaranteed to be authenticated here
 *     return { user }
 *   },
 * })
 * ```
 */
export const requireAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await fetchCurrentUser()

  if (!user) {
    throw redirect({
      to: '/dashboard',
      search: { auth: 'required' },
    })
  }

  return user
})

/**
 * Server function to get current user (optional auth)
 * Returns null if not authenticated, doesn't redirect
 *
 * @returns User object or null
 *
 * @example
 * ```typescript
 * // In a route loader
 * export const Route = createFileRoute('/some-page')({
 *   loader: async () => {
 *     const user = await getOptionalUser()
 *     // User might be null
 *     return { user }
 *   },
 * })
 * ```
 */
export const getOptionalUser = createServerFn({ method: 'GET' }).handler(async () => {
  return fetchCurrentUser()
})

/**
 * Server function to check if user is authenticated
 * Returns boolean, doesn't redirect
 *
 * @returns True if authenticated, false otherwise
 *
 * @example
 * ```typescript
 * const isAuth = await checkAuth()
 * if (isAuth) {
 *   // Show authenticated content
 * }
 * ```
 */
export const checkAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await fetchCurrentUser()
  return !!user
})
