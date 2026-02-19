import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { SectionSeparator } from 'suref-react'
import { useAuthStore } from '../../stores/authStore'
import { usePatterns } from '../../hooks/usePatterns'
import { Skeleton } from '../ui/skeleton'
import { PlayerPatternDisplay } from './PlayerPatternDisplay'

export function PatternSection() {
  const user = useAuthStore((s) => s.user)
  const { data: patterns, isLoading } = usePatterns(user?.id)

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Patterns">
        <Link
          to="/patterns/new"
          className="flex items-center gap-1 font-mono text-xs font-semibold uppercase text-su-fg-muted transition-colors hover:text-su-fg"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </Link>
      </SectionSeparator>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-[40px] rounded-md" />
          <Skeleton className="h-[40px] rounded-md" />
          <Skeleton className="h-[40px] rounded-md" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {patterns?.map((pattern) => (
            <PlayerPatternDisplay key={pattern.id} pattern={pattern} compact={false} />
          ))}
        </div>
      )}
    </div>
  )
}
