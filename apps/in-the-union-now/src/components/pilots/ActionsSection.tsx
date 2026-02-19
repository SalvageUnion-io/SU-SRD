import { useMemo, useCallback, useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { SURefEnumSchemaName, SURefChassis } from 'salvageunion-reference'
import { SalvageUnionReference, getChassisAbilities } from 'salvageunion-reference'
import { ReferenceEntityDisplayTooltip, FilterChip, StatDisplay, Text } from 'suref-react'
import type { ReferenceEntityControl } from 'suref-react'
import { Play, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { FilterRow } from '../shared/FilterRow'
import { SimpleDisplayContainer } from '../shared/SimpleDisplayContainer'
import {
  extractPilotActions,
  extractMechActions,
  extractChassisActions,
  extractComradeActions,
  getGeneralActions,
} from '../../lib/pilotActionUtils'
import type { ActionDisplayData } from '../../lib/pilotActionUtils'
import { extractComrades } from '../../lib/comradeUtils'
import { ActionDisplay } from './ActionDisplay'
import {
  getActionDisabledReason,
  getMechActionDisabledReason,
  getPilotTraits,
  getActionsTraits,
  decrementActionUses,
  refillActionUses,
} from '../../lib/actionUsesUtils'
import { useActionFilters, ACTION_TYPES, CATEGORY_FILTERS } from '../../hooks/useActionFilters'
import type { CategoryFilter } from '../../hooks/useActionFilters'
import type {
  EntityRefRow,
  EntityRefUpdate,
  PilotRow,
  MechRow,
  PilotUpdate,
  MechUpdate,
} from '../../types/common'

/** Tailwind color classes for category filter chips */
const CATEGORY_CHIP_COLORS: Record<CategoryFilter, string> = {
  Pilot: 'bg-su-orange text-su-white',
  Mech: 'bg-su-green text-su-white',
  Generic: 'bg-su-pink text-su-white',
}

type ActionsSectionProps = {
  pilotRefs: EntityRefRow[]
  pilot: PilotRow
  compact?: boolean
  readOnly: boolean
  onUpdatePilot: (input: Partial<PilotUpdate>) => void
  onUpdateEntityRef: (refId: string, input: EntityRefUpdate) => void
  mechRefs?: EntityRefRow[]
  mech?: MechRow | null
  mechChassis?: SURefChassis
  onUpdateMech?: (input: Partial<MechUpdate>) => void
  onUpdateMechEntityRef?: (refId: string, input: EntityRefUpdate) => void
}

export function ActionsSection({
  pilotRefs,
  pilot,
  compact,
  readOnly,
  onUpdatePilot,
  onUpdateEntityRef,
  mechRefs,
  mech,
  mechChassis,
  onUpdateMech,
  onUpdateMechEntityRef,
}: ActionsSectionProps) {
  const isBoarded = pilot.is_boarded
  const pilotActions = useMemo(
    () => extractPilotActions(pilotRefs, isBoarded),
    [pilotRefs, isBoarded]
  )
  const mechActions = useMemo(
    () => (mechRefs && mechRefs.length > 0 ? extractMechActions(mechRefs, isBoarded) : []),
    [mechRefs, isBoarded]
  )
  const chassisActions = useMemo(
    () => (mechChassis ? extractChassisActions(mechChassis, isBoarded) : []),
    [mechChassis, isBoarded]
  )
  const generalActions = useMemo(() => getGeneralActions(isBoarded), [isBoarded])
  const comradeActions = useMemo(() => {
    const comrades = extractComrades(pilotRefs, mechRefs ?? [], mechChassis)
    return extractComradeActions(comrades, isBoarded)
  }, [pilotRefs, mechRefs, mechChassis, isBoarded])
  // Separate trait sets by source — variable-currency actions use the set matching
  // their resolved cost type (mech traits when boarded/EP, pilot traits when not/AP)
  const pilotSourceTraits = useMemo(() => getPilotTraits(pilotRefs), [pilotRefs])
  const mechSourceTraits = useMemo(() => {
    if (!isBoarded) return new Set<string>()
    const traits = mechRefs ? getPilotTraits(mechRefs) : new Set<string>()
    if (mechChassis) {
      const chassisAbilityActions = getChassisAbilities(mechChassis) ?? []
      for (const t of getActionsTraits(chassisAbilityActions)) traits.add(t)
    }
    return traits
  }, [isBoarded, mechRefs, mechChassis])

  // Merge all actions into one pool
  const allActions = useMemo(
    () => [
      ...pilotActions,
      ...mechActions,
      ...chassisActions,
      ...comradeActions,
      ...generalActions,
    ],
    [pilotActions, mechActions, chassisActions, comradeActions, generalActions]
  )

  const filters = useActionFilters()
  const availableTypes = useMemo(() => {
    const types = filters.getAvailableTypes(allActions)
    types.add('Passive') // Always show Passive filter
    return types
  }, [filters, allActions])
  const availableCategories = useMemo(() => {
    const cats = filters.getAvailableCategories(allActions)
    if (mechRefs) cats.add('Mech')
    return cats
  }, [filters, allActions, mechRefs])

  // Sort: filter-matched first, then enabled before disabled, mech actions last
  const sortedActions = useMemo(
    () =>
      sortActions(
        allActions,
        filters.checkMatch,
        filters.hasActiveFilters,
        pilot,
        mech,
        pilotSourceTraits,
        mechSourceTraits
      ),
    [
      allActions,
      filters.checkMatch,
      filters.hasActiveFilters,
      pilot,
      mech,
      pilotSourceTraits,
      mechSourceTraits,
    ]
  )

  const handleUsePilotAction = useCallback(
    (action: ActionDisplayData) => {
      toast(`${pilot.callsign} used ${action.name}`, {
        style: { borderColor: action.borderColor, borderWidth: '2px' },
      })
      if (action.activationCost !== null) {
        // Variable-currency actions resolved to EP deduct from mech
        if (action.costType === 'ep' && mech && onUpdateMech) {
          onUpdateMech({ current_ep: mech.current_ep - action.activationCost })
        } else {
          onUpdatePilot({ ap: pilot.ap - action.activationCost })
        }
      }
      if (action.maxUses !== null && action.entityRefId) {
        const ref = pilotRefs.find((r) => r.id === action.entityRefId)
        if (ref) {
          const newMetadata = decrementActionUses(action.actionName, action.maxUses, ref.metadata)
          onUpdateEntityRef(action.entityRefId, { metadata: newMetadata })
        }
      }
    },
    [pilot.callsign, pilot.ap, mech, pilotRefs, onUpdatePilot, onUpdateMech, onUpdateEntityRef]
  )

  const handleUseMechAction = useCallback(
    (action: ActionDisplayData) => {
      if (!mech || !onUpdateMech) return
      toast(`${mech.pattern_name ?? 'Mech'} used ${action.name}`, {
        style: { borderColor: action.borderColor, borderWidth: '2px' },
      })
      if (action.activationCost !== null) {
        onUpdateMech({ current_ep: mech.current_ep - action.activationCost })
      }
      if (action.maxUses !== null && action.entityRefId) {
        if (!mechRefs || !onUpdateMechEntityRef) return
        const ref = mechRefs.find((r) => r.id === action.entityRefId)
        if (ref) {
          const newMetadata = decrementActionUses(action.actionName, action.maxUses, ref.metadata)
          onUpdateMechEntityRef(action.entityRefId, { metadata: newMetadata })
        }
      }
    },
    [mech, mechRefs, onUpdateMech, onUpdateMechEntityRef]
  )

  const handleRefillAction = useCallback(
    (action: ActionDisplayData) => {
      if (action.maxUses === null || !action.entityRefId) return

      if (action.source === 'mech') {
        if (!mechRefs || !onUpdateMechEntityRef) return
        const ref = mechRefs.find((r) => r.id === action.entityRefId)
        if (!ref) return
        const newMetadata = refillActionUses(action.actionName, action.maxUses, ref.metadata)
        onUpdateMechEntityRef(action.entityRefId, { metadata: newMetadata })
      } else {
        const ref = pilotRefs.find((r) => r.id === action.entityRefId)
        if (!ref) return
        const newMetadata = refillActionUses(action.actionName, action.maxUses, ref.metadata)
        onUpdateEntityRef(action.entityRefId, { metadata: newMetadata })
      }
      toast(`Refilled ${action.name}`, {
        style: { borderColor: action.borderColor, borderWidth: '2px' },
      })
    },
    [pilotRefs, mechRefs, onUpdateEntityRef, onUpdateMechEntityRef]
  )

  if (allActions.length === 0) return null

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div>
        {/* Filter chips + optional EP stat */}
        <div className="flex items-start gap-2">
          <div className={compact ? 'flex-1 space-y-1' : 'flex-1 space-y-1.5'}>
            <FilterRow label="Type">
              <FilterChip
                label="All"
                active={filters.activeTypes.size === 0}
                onClick={filters.clearTypes}
              />
              {ACTION_TYPES.filter((t) => availableTypes.has(t)).map((type) => (
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
              {CATEGORY_FILTERS.filter((c) => availableCategories.has(c)).map((cat) => (
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
          {pilot.is_boarded && (
            <SimpleDisplayContainer label="Pilot" className="shrink-0">
              <StatDisplay label="AP" value={pilot.ap} outOfMax={pilot.max_ap} />
            </SimpleDisplayContainer>
          )}
        </div>

        {/* Actions masonry — round-robin into columns for horizontal reading order */}
        <MasonryColumns
          items={sortedActions}
          gap={compact ? 'gap-1.5' : 'gap-2'}
          className={compact ? 'mt-1.5' : 'mt-2'}
          renderItem={(action) => (
            <ActionItem
              key={action.key}
              action={action}
              pilot={pilot}
              mech={mech}
              pilotSourceTraits={pilotSourceTraits}
              mechSourceTraits={mechSourceTraits}
              readOnly={readOnly}
              isBoarded={pilot.is_boarded}
              filteredOut={filters.hasActiveFilters && !filters.checkMatch(action)}
              onUsePilot={handleUsePilotAction}
              onUseMech={handleUseMechAction}
              onRefill={handleRefillAction}
            />
          )}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeDisabledReason(
  action: ActionDisplayData,
  pilot: PilotRow,
  mech: MechRow | null | undefined,
  pilotSourceTraits: Set<string>,
  mechSourceTraits: Set<string>
): string | null {
  if (action.source === 'mech') {
    if (!mech) return 'No mech'
    return getMechActionDisabledReason({
      action: {
        activationCost: action.activationCost,
        traits: [],
      } as never,
      mech,
      usesRemaining: action.usesRemaining,
      maxUses: action.maxUses,
    })
  }

  // Variable-currency actions resolved to EP use mech traits; otherwise pilot traits
  const traits = action.costType === 'ep' ? mechSourceTraits : pilotSourceTraits

  return getActionDisabledReason({
    action: {
      activationCost: action.activationCost,
      requiredTraits: action.requiredTraits,
      traits: [],
    } as never,
    pilot,
    pilotTraits: traits,
    usesRemaining: action.usesRemaining,
    maxUses: action.maxUses,
    costType: action.costType,
    mech,
  })
}

/** Sort tier: 0 = active+matching, 1 = inactive+matching, 2 = non-matching */
function actionSortTier(
  action: ActionDisplayData,
  checkMatch: (action: ActionDisplayData) => boolean,
  hasActiveFilters: boolean,
  pilot: PilotRow,
  mech: MechRow | null | undefined,
  pilotSourceTraits: Set<string>,
  mechSourceTraits: Set<string>
): number {
  const matches = !hasActiveFilters || checkMatch(action)
  if (!matches) return 2

  const gameDisabled =
    (action.source === 'mech' && !pilot.is_boarded) ||
    computeDisabledReason(action, pilot, mech, pilotSourceTraits, mechSourceTraits) !== null
  return gameDisabled ? 1 : 0
}

function sortActions(
  actions: ActionDisplayData[],
  checkMatch: (action: ActionDisplayData) => boolean,
  hasActiveFilters: boolean,
  pilot: PilotRow,
  mech: MechRow | null | undefined,
  pilotSourceTraits: Set<string>,
  mechSourceTraits: Set<string>
): ActionDisplayData[] {
  return [...actions].sort((a, b) => {
    const aTier = actionSortTier(
      a,
      checkMatch,
      hasActiveFilters,
      pilot,
      mech,
      pilotSourceTraits,
      mechSourceTraits
    )
    const bTier = actionSortTier(
      b,
      checkMatch,
      hasActiveFilters,
      pilot,
      mech,
      pilotSourceTraits,
      mechSourceTraits
    )
    if (aTier !== bTier) return aTier - bTier
    return a.name.localeCompare(b.name)
  })
}

function findTraitEntity(
  traitName: string
): { id: string; schemaName: SURefEnumSchemaName } | null {
  const entity = SalvageUnionReference.findIn(
    'traits',
    (t) => t.name.toLowerCase() === traitName.toLowerCase()
  )
  return entity ? { id: entity.id, schemaName: 'traits' as SURefEnumSchemaName } : null
}

function buildFooterMessage(
  disabledReason: string,
  action: ActionDisplayData,
  onRefill?: () => void
): ReactNode {
  const missingTrait = action.requiredTraits.find((trait) =>
    disabledReason.toLowerCase().includes(trait.toLowerCase())
  )

  if (missingTrait) {
    const traitEntity = findTraitEntity(missingTrait)
    const displayName = missingTrait.charAt(0).toUpperCase() + missingTrait.slice(1)
    const traitLabel = (
      <Text variant="pseudoheader" as="span" className="text-xs uppercase">
        {displayName}
      </Text>
    )

    return (
      <>
        Requires Trait:{' '}
        {traitEntity ? (
          <ReferenceEntityDisplayTooltip
            schemaName={traitEntity.schemaName}
            entityId={traitEntity.id}
            openDelay={300}
          >
            {traitLabel}
          </ReferenceEntityDisplayTooltip>
        ) : (
          traitLabel
        )}
      </>
    )
  }

  if (onRefill) {
    return (
      <span className="flex items-center gap-1.5">
        {disabledReason}
        <button
          type="button"
          onClick={onRefill}
          className="inline-flex cursor-pointer items-center gap-0.5 rounded bg-su-black px-1.5 py-0.5 font-mono text-xs text-su-white transition-opacity hover:opacity-80"
          aria-label="Refill uses"
        >
          <RotateCcw className="h-3 w-3" />
          Refill
        </button>
      </span>
    )
  }

  return disabledReason
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type ActionItemProps = {
  action: ActionDisplayData
  pilot: PilotRow
  mech?: MechRow | null
  pilotSourceTraits: Set<string>
  mechSourceTraits: Set<string>
  readOnly: boolean
  isBoarded: boolean
  filteredOut?: boolean
  onUsePilot: (action: ActionDisplayData) => void
  onUseMech: (action: ActionDisplayData) => void
  onRefill: (action: ActionDisplayData) => void
}

function ActionItem({
  action,
  pilot,
  mech,
  pilotSourceTraits,
  mechSourceTraits,
  readOnly,
  isBoarded,
  filteredOut,
  onUsePilot,
  onUseMech,
  onRefill,
}: ActionItemProps) {
  const isMechAction = action.source === 'mech'
  const mechUnboarded = isMechAction && !isBoarded

  const disabledReason = mechUnboarded
    ? 'Board your mech to use'
    : computeDisabledReason(action, pilot, mech, pilotSourceTraits, mechSourceTraits)

  const isDisabled = !!disabledReason || !!filteredOut

  const controls: ReferenceEntityControl[] = []
  if (!readOnly && !mechUnboarded && !filteredOut) {
    controls.push({
      key: 'use',
      icon: Play,
      label: 'Use',
      ariaLabel: 'Use action',
      variant: disabledReason ? 'ghost' : 'primary',
      className: disabledReason ? 'cursor-not-allowed opacity-30' : undefined,
      onClick: () => {
        if (!disabledReason) {
          if (isMechAction) {
            onUseMech(action)
          } else {
            onUsePilot(action)
          }
        }
      },
    })
  }

  const canRefill =
    !readOnly &&
    !mechUnboarded &&
    !filteredOut &&
    disabledReason === 'Out of uses' &&
    action.entityRefId &&
    action.maxUses !== null

  const footerMessage = disabledReason
    ? buildFooterMessage(disabledReason, action, canRefill ? () => onRefill(action) : undefined)
    : undefined

  return (
    <ActionDisplay
      data={action}
      controls={controls}
      disabled={isDisabled}
      footerMessage={footerMessage}
    />
  )
}

// ---------------------------------------------------------------------------
// Masonry layout — round-robin distribution for horizontal reading order
// ---------------------------------------------------------------------------

const BREAKPOINTS = [
  { min: 1024, cols: 3 }, // lg
  { min: 640, cols: 2 }, // sm
] as const

function useColumnCount(ref: React.RefObject<HTMLDivElement | null>): number {
  const [cols, setCols] = useState(1)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const w = entry!.contentRect.width
      let next = 1
      for (const bp of BREAKPOINTS) {
        if (w >= bp.min) {
          next = bp.cols
          break
        }
      }
      setCols(next)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return cols
}

function MasonryColumns<T extends { key: string }>({
  items,
  gap,
  className,
  renderItem,
}: {
  items: T[]
  gap: string
  className?: string
  renderItem: (item: T) => ReactNode
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cols = useColumnCount(containerRef)

  const columns = useMemo(() => {
    const buckets: T[][] = Array.from({ length: cols }, () => [])
    for (let i = 0; i < items.length; i++) {
      buckets[i % cols]!.push(items[i]!)
    }
    return buckets
  }, [items, cols])

  return (
    <div ref={containerRef} className={`flex ${gap} ${className ?? ''}`}>
      {columns.map((col, ci) => (
        <div key={ci} className={`flex flex-1 flex-col ${gap}`}>
          {col.map((item) => (
            <div key={item.key}>{renderItem(item)}</div>
          ))}
        </div>
      ))}
    </div>
  )
}
