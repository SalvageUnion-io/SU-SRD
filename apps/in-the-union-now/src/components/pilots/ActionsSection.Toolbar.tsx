import { FilterChip, FilterRow } from 'suref-react'
import { IsolatedStatValue } from '../shared/IsolatedStatValue'
import { getComradeMaxEp } from '../../lib/pilotActionUtils'
import { canPush } from '../../lib/pushUtils'
import { ACTION_TYPES, CATEGORY_FILTERS } from '../../hooks/useActionFilters'
import type { CategoryFilter, useActionFilters } from '../../hooks/useActionFilters'
import type { ComradeEntry } from '../../lib/comradeUtils'
import type { MechRow, PilotRow } from '../../types/common'

type UseActionFiltersReturn = ReturnType<typeof useActionFilters>

/** Tailwind color classes for category filter chips */
const CATEGORY_CHIP_COLORS: Record<CategoryFilter, string> = {
  Pilot: 'bg-su-orange text-su-white',
  Mech: 'bg-su-green text-su-white',
  Generic: 'bg-su-pink text-su-white',
  Comrade: 'bg-su-rust text-su-white',
}

export type ActionsToolbarProps = {
  filters: UseActionFiltersReturn
  pilot: PilotRow
  mech?: MechRow | null
  userId?: string
  readOnly: boolean
  isBoarded: boolean
  compact?: boolean
  visibleComrades: ComradeEntry[]
  comradeNameMap: Map<string, string>
  getComradeCurrentEp: (entityId: string, maxEp: number) => number
  onPushClick: () => void
}

/**
 * Toolbar above the actions list — type/source filter chips on the left,
 * optional Push button and per-comrade/pilot EP/AP stat readouts on the right.
 */
export function ActionsToolbar({
  filters,
  pilot,
  mech,
  userId,
  readOnly,
  isBoarded,
  compact,
  visibleComrades,
  comradeNameMap,
  getComradeCurrentEp,
  onPushClick,
}: ActionsToolbarProps) {
  const showPush =
    !readOnly && isBoarded && !!mech && canPush(mech.current_heat, mech.heat_capacity) && !!userId

  return (
    <div className="flex items-start gap-2">
      <div className={compact ? 'flex-1 space-y-1' : 'flex-1 space-y-1.5'}>
        <FilterRow label="Type">
          <FilterChip
            label="All"
            active={filters.activeTypes.size === 0}
            onClick={filters.clearTypes}
          />
          {ACTION_TYPES.map((type) => (
            <FilterChip
              key={type}
              label={type}
              active={filters.activeTypes.has(type)}
              onClick={() => filters.toggleType(type)}
            />
          ))}
        </FilterRow>
        <FilterRow label="Source">
          <FilterChip
            label="All"
            active={filters.activeCategories.size === 0}
            onClick={filters.clearCategories}
          />
          {CATEGORY_FILTERS.map((cat) => (
            <FilterChip
              key={cat}
              label={cat}
              active={filters.activeCategories.has(cat)}
              onClick={() => filters.toggleCategory(cat)}
              colorClass={CATEGORY_CHIP_COLORS[cat]}
            />
          ))}
        </FilterRow>
      </div>
      <div className="ml-auto flex shrink-0 items-start gap-2">
        {showPush && mech && (
          <button
            type="button"
            onClick={onPushClick}
            className="inline-flex items-center gap-1 rounded border border-su-rust/40 bg-su-rust/10 px-2 py-1 text-xs font-semibold text-su-rust transition-colors hover:bg-su-rust/20 shrink-0"
          >
            Push — Heat {mech.current_heat} → {Math.min(mech.current_heat + 2, mech.heat_capacity)}
          </button>
        )}
        {visibleComrades.map((c) => {
          const maxEp = getComradeMaxEp(c.entity)
          const currentEp = maxEp > 0 ? getComradeCurrentEp(c.entity.id, maxEp) : 0
          if (maxEp <= 0) return null
          return (
            <IsolatedStatValue
              key={c.entity.id}
              label={comradeNameMap.get(c.entity.id) || c.entity.name}
              bg="bg-su-rust"
              stats={[{ key: 'ep', label: 'EP', value: currentEp, outOfMax: maxEp }]}
              className="shrink-0"
            />
          )
        })}
        <IsolatedStatValue
          label="Pilot"
          stats={[{ key: 'ap', label: 'AP', value: pilot.ap, outOfMax: pilot.max_ap }]}
          className="shrink-0"
        />
      </div>
    </div>
  )
}
