import { X } from 'lucide-react'
import type { TechLevel } from '../../lib/listingGroups'
import { tlName } from '../../lib/listingGroups'
import type { useListingFilters } from '../../lib/useListingFilters'
import { islandsCopy } from '../../messages/components-islands'
import { Button, tokens } from '../index'
import { shortSource, tlButtonLabel } from './ListingRail'

/** One active filter, as a Compact Button that removes it (its ✕ the line's Size). */
function FilterToken({
  label,
  name,
  onRemove,
}: {
  label: string
  name: string
  onRemove: () => void
}) {
  return (
    <Button size="compact" aria-label={islandsCopy('remove', { name })} onClick={onRemove}>
      {label}
      <X aria-hidden="true" size={tokens.iconSize.compact} />
    </Button>
  )
}

/**
 * What a listing is filtered by, on its rail (`ListingRail`'s `status`): the
 * count, a token per filter that removes it, and Clear all.
 */
export function ListingFilterStatus({
  shown,
  total,
  techLevels,
  filters,
}: {
  shown: number
  total: number
  /** Every Tech Level the listing offers, in the book's order. */
  techLevels: readonly TechLevel[]
  filters: ReturnType<typeof useListingFilters>
}) {
  return (
    <output className="su-rail__status" aria-live="polite">
      <span className="su-rail__tally">{islandsCopy('of', { count: shown, count2: total })}</span>
      {[...filters.techLevelFilters].map((key) => {
        const level = techLevels.find((tl) => String(tl) === key)
        if (level == null) return null
        return (
          <FilterToken
            key={key}
            label={typeof level === 'number' ? islandsCopy('tl2', { level }) : tlButtonLabel(level)}
            name={tlName(level)}
            onRemove={() => filters.toggleTechLevel(level)}
          />
        )
      })}
      {filters.source && (
        <FilterToken
          label={shortSource(filters.source)}
          name={`source ${filters.source}`}
          onRemove={() => filters.setSource('')}
        />
      )}
      {filters.tree && (
        <FilterToken
          label={filters.tree}
          name={`tree ${filters.tree}`}
          onRemove={() => filters.setTree('')}
        />
      )}
      {filters.trait && (
        <FilterToken
          label={filters.trait}
          name={`trait ${filters.trait}`}
          onRemove={() => filters.setTrait('')}
        />
      )}
      {filters.range && (
        <FilterToken
          label={filters.range}
          name={`range ${filters.range}`}
          onRemove={() => filters.setRange('')}
        />
      )}
      {filters.action && (
        <FilterToken
          label={filters.action}
          name={`action ${filters.action}`}
          onRemove={() => filters.setAction('')}
        />
      )}
      {filters.weapons && (
        <FilterToken
          label={islandsCopy('weaponsOnly')}
          name={islandsCopy('weaponsOnly').toLowerCase()}
          onRemove={() => filters.setWeapons(false)}
        />
      )}
      {filters.name && (
        <FilterToken
          label={`“${filters.name}”`}
          name={islandsCopy('nameFilter')}
          onRemove={() => filters.setName('')}
        />
      )}
      <Button variant="ghost" size="compact" onClick={filters.clear}>
        {islandsCopy('clearAll')}
      </Button>
    </output>
  )
}
