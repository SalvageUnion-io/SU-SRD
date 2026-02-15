import { useCallback, useMemo } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntityDisplay, SectionSeparator } from 'suref-react'
import { useAuthStore } from '../../stores/authStore'
import { usePatterns } from '../../hooks/usePatterns'
import { Skeleton } from '../ui/skeleton'
import { EMPTY_SLOT_CLASSES } from './emptySlotClasses'
import type { TypedPatternRow } from '../../types/common'

export function PatternSection() {
  const user = useAuthStore((s) => s.user)
  const { data: patterns, isLoading } = usePatterns(user?.id)

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Patterns" fontSize="text-sm" />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-[40px] rounded-md" />
          <Skeleton className="h-[40px] rounded-md" />
          <Skeleton className="h-[40px] rounded-md" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {patterns?.map((pattern) => (
            <PatternListing key={pattern.id} pattern={pattern} />
          ))}
          <NewPatternSlot />
        </div>
      )}
    </div>
  )
}

function PatternListing({ pattern }: { pattern: TypedPatternRow }) {
  const navigate = useNavigate()

  const chassis = useMemo(
    () => SalvageUnionReference.Chassis.find((c) => c.id === pattern.chassis_ref),
    [pattern.chassis_ref]
  )

  const handleNavigate = useCallback(() => {
    navigate({ to: '/patterns/$patternId', params: { patternId: pattern.id } })
  }, [navigate, pattern.id])

  return (
    <EntityDisplay
      data={chassis}
      listing
      compact
      patternOverride={{
        name: pattern.name,
        systems: [],
        modules: [],
      }}
      onOpen={handleNavigate}
    />
  )
}

function NewPatternSlot() {
  return (
    <Link to="/patterns/new" className="block">
      <div className={EMPTY_SLOT_CLASSES}>
        <Plus className="h-4 w-4" />
        <span className="font-mono text-sm font-semibold uppercase">New Pattern</span>
      </div>
    </Link>
  )
}
