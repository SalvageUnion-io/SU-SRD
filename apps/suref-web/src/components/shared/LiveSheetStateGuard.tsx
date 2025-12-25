import type { ReactNode } from 'react'
import { LiveSheetLoadingState } from './LiveSheetLoadingState'
import { LiveSheetNotFoundState } from './LiveSheetNotFoundState'
import { LiveSheetErrorState } from './LiveSheetErrorState'

interface LiveSheetStateGuardProps {
  /**
   * Type of entity being loaded (for error messages)
   */
  entityType: 'Mech' | 'Pilot' | 'Crawler'

  /**
   * The entity data, or undefined if not loaded
   */
  entity: unknown

  /**
   * Whether the entity is currently loading
   */
  loading: boolean

  /**
   * Error message, or null if no error
   */
  error: string | null

  /**
   * Content to render when entity is successfully loaded
   */
  children: ReactNode
}

/**
 * Guard component that handles loading, error, and not-found states for LiveSheet components
 *
 * Renders appropriate state components based on the current state:
 * - Loading: Shows loading spinner
 * - Error: Shows error message
 * - Not Found: Shows not found message
 * - Success: Renders children
 *
 * @example
 * ```tsx
 * <LiveSheetStateGuard
 *   entityType="Pilot"
 *   entity={pilot}
 *   loading={loading}
 *   error={error}
 * >
 *   <PilotContent pilot={pilot} />
 * </LiveSheetStateGuard>
 * ```
 */
export function LiveSheetStateGuard({
  entityType,
  entity,
  loading,
  error,
  children,
}: LiveSheetStateGuardProps) {
  if (!entity && !loading) {
    return <LiveSheetNotFoundState entityType={entityType} />
  }

  if (loading) {
    return <LiveSheetLoadingState entityType={entityType} />
  }

  if (error) {
    return <LiveSheetErrorState entityType={entityType} error={error} />
  }

  return <>{children}</>
}

