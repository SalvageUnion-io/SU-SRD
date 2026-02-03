import { Grid, type GridProps } from '@chakra-ui/react'
import type { ReactNode } from 'react'

type CardGridProps = Omit<GridProps, 'children'> & {
  /** Child card components to display in the grid */
  children: ReactNode
  /** Minimum width for each card column (default: 320px) */
  minCardWidth?: string
  /** Maximum number of columns (default: 2) */
  maxColumns?: number
  /** Whether to use single column layout (useful for expanded cards) */
  singleColumn?: boolean
}

/**
 * Responsive grid layout for displaying multiple cards.
 * Automatically adjusts columns based on available width.
 * Use singleColumn={true} when cards are expanded to full width.
 */
export function CardGrid({
  children,
  minCardWidth = '320px',
  maxColumns = 2,
  singleColumn = false,
  gap = 3,
  ...gridProps
}: CardGridProps) {
  if (singleColumn) {
    return (
      <Grid templateColumns="1fr" gap={gap} w="full" {...gridProps}>
        {children}
      </Grid>
    )
  }

  return (
    <Grid
      templateColumns={`repeat(auto-fill, minmax(min(${minCardWidth}, 100%), 1fr))`}
      gap={gap}
      w="full"
      css={{
        // Limit to maxColumns when there's enough space
        '@media (min-width: 768px)': {
          gridTemplateColumns: `repeat(${maxColumns}, 1fr)`,
        },
        // Single column on smaller screens
        '@media (max-width: 767px)': {
          gridTemplateColumns: '1fr',
        },
      }}
      {...gridProps}
    >
      {children}
    </Grid>
  )
}
