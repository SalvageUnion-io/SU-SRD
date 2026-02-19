import type { ReferenceEntityControl } from 'suref-react'
import { usePatternSheet } from '../../hooks/usePatternSheet'
import { PageSkeleton } from '../shared/PageSkeleton'
import { NotFoundState } from '../shared/NotFoundState'
import { Skeleton } from '../ui/skeleton'
import { PlayerPatternDisplay } from './PlayerPatternDisplay'

type HydratedPatternDisplayProps = {
  patternId: string
  listing?: boolean
  compact?: boolean
  controls?: ReferenceEntityControl[]
}

export function HydratedPatternDisplay({
  patternId,
  listing = false,
  compact = false,
  controls,
}: HydratedPatternDisplayProps) {
  const sheet = usePatternSheet(patternId)

  if (sheet.isLoading) {
    return listing && compact ? <Skeleton className="h-[40px] rounded-md" /> : <PageSkeleton />
  }

  if (sheet.error || !sheet.pattern || !sheet.access?.canView) {
    return <NotFoundState message="Pattern not found." />
  }

  return (
    <PlayerPatternDisplay
      pattern={sheet.pattern}
      listing={listing}
      compact={compact}
      controls={controls}
      editConfig={listing ? undefined : sheet.editConfig}
    />
  )
}
