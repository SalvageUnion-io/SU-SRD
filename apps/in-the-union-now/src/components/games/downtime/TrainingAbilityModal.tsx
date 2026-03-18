import { useState, useMemo, useCallback } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { getSource } from 'salvageunion-reference'
import { ReferenceEntityDisplay, FilterChip } from 'suref-react'
import { GraduationCap } from 'lucide-react'
import { Input } from '../../ui/input'
import { FilterRow, ModalShell } from 'suref-react'
import { filterAndSplitEntities, getEntityId } from '../../../lib/entitySelectionUtils'
import {
  getTrainableAbilities,
  getAbilityCost,
  meetsPrerequisites,
  meetsNamedPrerequisites,
} from '../../../lib/trainingUtils'

type TrainingAbilityModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  classRef: string
  crawlerTL: number
  existingAbilityIds: Set<string>
  learnedAbilityNames: Set<string>
  abilityCounts: { core: number; advanced: number; legendary: number }
  currentTP: number
  onSelect: (entity: SURefEntity) => void
}

export function TrainingAbilityModal({
  open,
  onOpenChange,
  classRef,
  crawlerTL,
  existingAbilityIds,
  learnedAbilityNames,
  abilityCounts,
  currentTP,
  onSelect,
}: TrainingAbilityModalProps) {
  const abilities = useMemo(
    () => getTrainableAbilities(classRef, crawlerTL, existingAbilityIds),
    [classRef, crawlerTL, existingAbilityIds]
  )

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Choose Ability"
      subtitle={`${currentTP} TP available`}
      description="Select an ability to learn."
    >
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-hidden bg-su-white p-3">
        {/* Prerequisite info */}
        <div className="flex flex-wrap gap-2 text-[10px] text-su-grey-dark">
          <span>Core: {abilityCounts.core}</span>
          <span>Advanced: {abilityCounts.advanced}</span>
          <span>Legendary: {abilityCounts.legendary}</span>
        </div>

        <AbilityList
          abilities={abilities}
          abilityCounts={abilityCounts}
          learnedAbilityNames={learnedAbilityNames}
          currentTP={currentTP}
          onSelect={onSelect}
        />
      </div>
    </ModalShell>
  )
}

function AbilityList({
  abilities,
  abilityCounts,
  learnedAbilityNames,
  currentTP,
  onSelect,
}: {
  abilities: SURefEntity[]
  abilityCounts: { core: number; advanced: number; legendary: number }
  learnedAbilityNames: Set<string>
  currentTP: number
  onSelect: (entity: SURefEntity) => void
}) {
  const [search, setSearch] = useState('')
  const [activeSourceFilters, setActiveSourceFilters] = useState<Set<string>>(new Set())

  const availableSources = useMemo(() => {
    const found = new Set<string>()
    for (const entity of abilities) {
      const src = getSource(entity)
      if (src) found.add(src)
    }
    return [...found].sort()
  }, [abilities])

  const toggleSource = useCallback(
    (source: string) => {
      setActiveSourceFilters((prev) => {
        if (prev.size === 0) return new Set([source])
        const next = new Set(prev)
        if (next.has(source)) next.delete(source)
        else next.add(source)
        if (availableSources.every((s) => next.has(s))) return new Set()
        return next
      })
    },
    [availableSources]
  )

  const { selectable } = useMemo(
    () =>
      filterAndSplitEntities({
        entities: abilities,
        search,
        activeTechLevels: new Set(),
        activeSourceFilters,
      }),
    [abilities, search, activeSourceFilters]
  )

  return (
    <div className="flex flex-col gap-2">
      <Input
        placeholder="Search abilities..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border-su-grey-light/50 bg-su-white text-su-black placeholder:text-su-grey-dark"
      />

      {availableSources.length > 1 && (
        <FilterRow label="Source" gap="gap-1.5">
          <FilterChip
            label="All"
            active={activeSourceFilters.size === 0}
            onClick={() => setActiveSourceFilters(new Set())}
          />
          {availableSources.map((source) => (
            <FilterChip
              key={source}
              label={source}
              active={activeSourceFilters.has(source)}
              onClick={() => toggleSource(source)}
            />
          ))}
        </FilterRow>
      )}

      <div
        className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto px-1 py-1 pr-3"
        style={{ scrollbarGutter: 'stable' }}
      >
        {selectable.length === 0 ? (
          <p className="py-4 text-center text-sm text-su-grey-dark">No abilities available.</p>
        ) : (
          selectable.map((entity) => {
            const id = getEntityId(entity)
            const level = 'level' in entity ? entity.level : 1
            const cost = getAbilityCost(level as number | string)
            const canAfford = currentTP >= cost
            const prereqMet =
              meetsPrerequisites(level as number | string, abilityCounts) &&
              meetsNamedPrerequisites(entity.name, learnedAbilityNames)
            const available = canAfford && prereqMet

            const tierLabel = level === 1 ? 'Core' : level === 2 ? 'Adv/Hybrid' : 'Legendary'

            return (
              <div key={id} className={available ? '' : 'pointer-events-none opacity-40'}>
                <ReferenceEntityDisplay
                  data={entity}
                  compact
                  subtitleExtra={
                    <span className="text-[10px] text-su-grey-dark">
                      {tierLabel} ({cost} TP)
                      {!prereqMet && ' — prerequisites not met'}
                    </span>
                  }
                  controls={
                    available
                      ? [
                          {
                            key: 'learn',
                            icon: (props: { className?: string }) => <GraduationCap {...props} />,
                            onClick: () => onSelect(entity),
                            ariaLabel: `Learn ${entity.name}`,
                          },
                        ]
                      : undefined
                  }
                />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
