import { useMemo, useState } from 'react'
import type { SURefChassis } from 'salvageunion-reference'
import { getChassisAbilities, getChoices } from 'salvageunion-reference'
import { aggregateActions } from '../../lib/aggregateActions'
import type { ActionDisplayData } from '../../lib/pilotActionUtils'
import type { ComradeEntry } from '../../lib/comradeUtils'
import { HeatCheckModal } from './HeatCheckModal'
import { PushModal } from './PushModal'
import { getPilotTraits, getActionsTraits } from '../../lib/actionUsesUtils'
import { useComradeEp } from '../../hooks/useComradeEp'
import { usePlayerChoices } from '../../hooks/useComradeChoices'
import { useActionFilters } from '../../hooks/useActionFilters'
import type {
  EntityRefRow,
  EntityRefUpdate,
  MechRow,
  MechUpdate,
  PilotRow,
  PilotUpdate,
} from '../../types/common'
import { sortActions } from './actionsSectionUtils'
import { ActionItem } from './ActionsSection.ActionItem'
import { ActionsToolbar } from './ActionsSection.Toolbar'
import { MasonryColumns } from './ActionsSection.MasonryColumns'
import { useActionHandlers } from './useActionHandlers'
import type { ActivateActionFn } from './useActionHandlers'

type ActionsSectionProps = {
  pilotRefs: EntityRefRow[]
  pilot: PilotRow
  compact?: boolean
  readOnly: boolean
  userId?: string
  onUpdatePilot: (input: Partial<PilotUpdate>) => void
  onUpdateEntityRef: (refId: string, input: EntityRefUpdate) => void
  mechRefs?: EntityRefRow[]
  mech?: MechRow | null
  mechChassis?: SURefChassis
  comrades?: ComradeEntry[]
  onUpdateMech?: (input: Partial<MechUpdate>) => void
  onUpdateMechEntityRef?: (refId: string, input: EntityRefUpdate) => void
  onUseAction?: ActivateActionFn
}

export function ActionsSection({
  pilotRefs,
  pilot,
  compact,
  readOnly,
  userId,
  onUpdatePilot,
  onUpdateEntityRef,
  mechRefs,
  mech,
  mechChassis,
  comrades: comradesProp,
  onUpdateMech,
  onUpdateMechEntityRef,
  onUseAction,
}: ActionsSectionProps) {
  const [heatCheckOpen, setHeatCheckOpen] = useState(false)
  const [heatCheckCurrentHeat, setHeatCheckCurrentHeat] = useState(0)
  const [pushOpen, setPushOpen] = useState(false)

  const isBoarded = pilot.is_boarded
  const { getComradeCurrentEp, updateComradeEp } = useComradeEp({
    pilotId: pilot.id,
    userId,
    readOnly,
  })
  const comrades = useMemo(() => comradesProp ?? [], [comradesProp])
  const visibleComrades = useMemo(
    () => comrades.filter((c) => c.sourceParent === 'pilot' || isBoarded),
    [comrades, isBoarded]
  )

  // Aggregate all action sources into a single pool
  const aggregated = useMemo(
    () =>
      aggregateActions({
        pilotRefs,
        isBoarded,
        comrades,
        mechRefs,
        mechChassis,
      }),
    [pilotRefs, isBoarded, comrades, mechRefs, mechChassis]
  )

  // Build comrade custom name map from saved player choices
  const { data: mechChoices } = usePlayerChoices(mech?.id)
  const comradeNameMap = useMemo(() => {
    const map = new Map<string, string>()
    if (!mechChoices || comrades.length === 0) return map
    const choiceMap = new Map<string, string>()
    for (const row of mechChoices) {
      if (row.selected_value) choiceMap.set(row.choice_id, row.selected_value)
    }
    for (const c of comrades) {
      const choices = getChoices(c.entity)
      const nameChoice = choices?.find((ch) => ch.name === 'Name')
      if (nameChoice) {
        const saved = choiceMap.get(nameChoice.id)
        if (saved) map.set(c.entity.id, saved)
      }
    }
    return map
  }, [mechChoices, comrades])

  // Override comrade action labels with custom names
  const allActions = useMemo(() => {
    if (comradeNameMap.size === 0) return aggregated.allActions
    return aggregated.allActions.map((action) => {
      if (!action.comradeEntity) return action
      const custom = comradeNameMap.get(action.comradeEntity.id)
      if (!custom) return action
      return {
        ...action,
        sourceLabelOverride: `${action.comradeEntity.name}, \u201C${custom}\u201D`,
      }
    })
  }, [aggregated.allActions, comradeNameMap])

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

  const filters = useActionFilters()

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
        mechSourceTraits,
        getComradeCurrentEp
      ),
    [
      allActions,
      filters.checkMatch,
      filters.hasActiveFilters,
      pilot,
      mech,
      pilotSourceTraits,
      mechSourceTraits,
      getComradeCurrentEp,
    ]
  )

  const { handleUsePilotAction, handleUseMechAction, handleUseComradeAction, handleRefillAction } =
    useActionHandlers({
      pilot,
      pilotRefs,
      mech,
      mechRefs,
      comradeNameMap,
      getComradeCurrentEp,
      updateComradeEp,
      onUpdatePilot,
      onUpdateEntityRef,
      onUpdateMech,
      onUpdateMechEntityRef,
      onUseAction,
      onHeatCheckTriggered: (newHeat) => {
        setHeatCheckCurrentHeat(newHeat)
        setHeatCheckOpen(true)
      },
    })

  if (allActions.length === 0) return null

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div>
        <ActionsToolbar
          filters={filters}
          pilot={pilot}
          mech={mech}
          userId={userId}
          readOnly={readOnly}
          isBoarded={isBoarded}
          compact={compact}
          visibleComrades={visibleComrades}
          comradeNameMap={comradeNameMap}
          getComradeCurrentEp={getComradeCurrentEp}
          onPushClick={() => setPushOpen(true)}
        />

        {/* Actions masonry — round-robin into columns for horizontal reading order */}
        <MasonryColumns
          items={sortedActions}
          gap={compact ? 'gap-1.5' : 'gap-2'}
          className={compact ? 'mt-1.5' : 'mt-2'}
          renderItem={(action: ActionDisplayData) => (
            <ActionItem
              key={action.key}
              action={action}
              pilot={pilot}
              mech={mech}
              mechId={mech?.id}
              mechRefs={mechRefs}
              pilotSourceTraits={pilotSourceTraits}
              mechSourceTraits={mechSourceTraits}
              readOnly={readOnly}
              isBoarded={pilot.is_boarded}
              filteredOut={filters.hasActiveFilters && !filters.checkMatch(action)}
              comradeEpGetter={getComradeCurrentEp}
              onUsePilot={handleUsePilotAction}
              onUseMech={handleUseMechAction}
              onUseComrade={handleUseComradeAction}
              onRefill={handleRefillAction}
            />
          )}
        />
      </div>

      {mech && userId && (
        <PushModal
          open={pushOpen}
          onOpenChange={setPushOpen}
          mech={mech}
          pilot={pilot}
          mechRefs={mechRefs ?? []}
          userId={userId}
        />
      )}

      {mech && userId && (
        <HeatCheckModal
          open={heatCheckOpen}
          onOpenChange={setHeatCheckOpen}
          currentHeat={heatCheckCurrentHeat}
          mech={mech}
          pilot={pilot}
          mechRefs={mechRefs ?? []}
          userId={userId}
        />
      )}
    </div>
  )
}
