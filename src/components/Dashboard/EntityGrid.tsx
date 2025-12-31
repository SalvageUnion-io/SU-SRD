import { useNavigate } from '@tanstack/react-router'
import type { Tables } from '../../types/database-generated.types'
import { useEntityGrid } from '../../hooks/useEntityGrid'
import { useCreateEntity } from '../../hooks/useCreateEntity'
import { GridLayout } from './GridLayout'
import type { ValidTable } from '../../types/common'
import type { ReactNode } from 'react'
import { logger } from '../../lib/logger'

interface EntityGridConfig<T extends ValidTable> {
  /** Database table name */
  table: T
  /** Page title */
  title: string
  /** Create button label */
  createButtonLabel: string
  /** Create button background color */
  createButtonBgColor: string
  /** Create button text color */
  createButtonColor: string
  /** Function to render each grid item */
  renderCard: (item: Tables<T>, onClick: (id: string) => void, isInactive?: boolean) => ReactNode
  /** Empty state message */
  emptyStateMessage?: string
  /** Empty state icon */
}

/**
 * Generic grid component for displaying and managing entities (crawlers, pilots, mechs)
 * Consolidates duplicate logic from CrawlersGrid, PilotsGrid, MechsGrid
 */
export function EntityGrid<T extends ValidTable>({
  table,
  title,
  createButtonLabel,
  createButtonBgColor,
  createButtonColor,
  renderCard,
  emptyStateMessage,
}: EntityGridConfig<T>) {
  const navigate = useNavigate()

  const { items, loading, error, reload } = useEntityGrid<Tables<T>>({
    table,
    orderBy: 'created_at',
    orderAscending: false,
  })

  const { createEntity, isLoading: isCreating } = useCreateEntity({
    table,
    navigationPath: (id: string) => `/dashboard/${table}/${id}`,
  })

  const handleCreate = async () => {
    try {
      // For pilots, mechs, and crawlers, navigate to the wizard instead of creating directly
      if (table === 'pilots') {
        navigate({ to: '/dashboard/pilots/new' })
        return
      }
      if (table === 'mechs') {
        navigate({ to: '/dashboard/mechs/new' })
        return
      }
      if (table === 'crawlers') {
        navigate({ to: '/dashboard/crawlers/new' })
        return
      }
      await createEntity()
    } catch (err) {
      logger.error(`Failed to create ${table}:`, err)
    }
  }

  const handleClick = (id: string) => {
    navigate({ to: `/dashboard/${table}/${id}` })
  }

  return (
    <GridLayout<Tables<T> & { active?: boolean }>
      title={title}
      loading={loading}
      error={error}
      items={items as Array<Tables<T> & { active?: boolean }>}
      renderItem={(item, isInactive) => renderCard(item as Tables<T>, handleClick, isInactive)}
      createButton={{
        onClick: handleCreate,
        label: createButtonLabel,
        color: createButtonColor,
        bgColor: createButtonBgColor,
        isLoading: isCreating,
      }}
      onRetry={reload}
      emptyStateMessage={emptyStateMessage}
    />
  )
}
