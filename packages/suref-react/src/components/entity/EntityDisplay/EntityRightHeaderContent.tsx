import { useCallback } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { isAbility } from 'salvageunion-reference'
import { EntityStats } from './EntityStats'
import { useParseTraitReferences } from '../../../utils/parseTraitReferences'
import { cn } from '../../../utils/cn'
import type { getEntityFontSizes } from './entityDisplayTypes'

type EntityRightHeaderContentProps = {
  data: SURefEntity
  compact: boolean
  fontSize: ReturnType<typeof getEntityFontSizes>
  techLevel?: number | 'B' | 'N'
  listing: boolean
  onDetailClick?: () => void
}

export function EntityRightHeaderContent({
  data,
  compact,
  fontSize,
  techLevel,
  listing,
  onDetailClick,
}: EntityRightHeaderContentProps) {
  const description = 'description' in data ? data.description : undefined
  const parsedDescription = useParseTraitReferences(description)

  const handleDetailClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDetailClick?.()
    },
    [onDetailClick]
  )

  const abilityContent = description && isAbility(data) && (
    <div
      className={cn(
        'min-w-0 shrink overflow-hidden text-right font-medium italic text-su-white',
        fontSize.xs,
        'max-h-[60px] leading-tight',
        compact && 'max-w-[175px]'
      )}
      style={{ whiteSpace: 'normal' }}
    >
      {parsedDescription}
    </div>
  )

  return (
    <div className="flex gap-2">
      {abilityContent}
      <EntityStats data={data} compact={compact} techLevel={techLevel} />
      {listing && (
        <button
          type="button"
          className="flex min-w-[25px] shrink-0 cursor-pointer items-center justify-center self-center rounded p-1 opacity-60 transition-opacity hover:bg-white/20 hover:opacity-100"
          title="View details"
          aria-label="View details"
          onClick={handleDetailClick}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className="text-su-white"
            aria-hidden="true"
          >
            <rect
              x="1"
              y="1"
              width="12"
              height="12"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M6 3h5v5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M11 3L6 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}
