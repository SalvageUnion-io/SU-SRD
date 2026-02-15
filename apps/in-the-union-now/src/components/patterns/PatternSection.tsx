import { Link } from '@tanstack/react-router'
import { Wrench, Plus } from 'lucide-react'
import { Text } from 'suref-react'
import { useAuthStore } from '../../stores/authStore'
import { usePatterns } from '../../hooks/usePatterns'
import { PatternCard } from './PatternCard'
import { Skeleton } from '../ui/skeleton'
import { Button } from '../ui/button'

export function PatternSection() {
  const user = useAuthStore((s) => s.user)
  const { data: patterns, isLoading } = usePatterns(user?.id)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-su-orange" />
          <Text variant="pseudoheader" as="span" className="text-sm text-su-white uppercase">
            Patterns
          </Text>
        </div>
        {patterns && patterns.length > 0 && (
          <Button variant="ghost" size="sm" asChild>
            <Link to="/patterns/new" className="text-su-orange">
              <Plus className="mr-1 h-3 w-3" />
              New
            </Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-24 rounded-md" />
          <Skeleton className="h-24 rounded-md" />
          <Skeleton className="h-24 rounded-md" />
        </div>
      ) : !patterns || patterns.length === 0 ? (
        <div className="rounded-md border border-su-grey-light/30 p-4">
          <p className="mb-3 text-sm text-su-grey-dark">
            No mech patterns yet. Build your first pattern to get started.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/patterns/new">Create a Pattern</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {patterns.map((pattern) => (
            <PatternCard key={pattern.id} pattern={pattern} />
          ))}
        </div>
      )}
    </div>
  )
}
