import { useState, useMemo, useCallback } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefGuide } from 'salvageunion-reference'
import { ReferenceEntityDisplay, Text } from 'suref-react'
import {
  useCombatGuideInteractiveConfig,
  COMBAT_GUIDE_IDS,
} from '../../hooks/useCombatGuideInteractiveConfig'
import type { MechRow, PilotRow, EntityRefRow } from '../../types/common'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CombatGuidesPanelProps = {
  pilot: PilotRow
  mech: MechRow
  mechRefs?: EntityRefRow[]
  userId?: string
  /** Called when the Push button is pressed — should open PushModal */
  onPush?: () => void
}

// ---------------------------------------------------------------------------
// Inner: selected guide renderer (isolated so the hook resets per guide)
// ---------------------------------------------------------------------------

type GuideDisplayProps = {
  guide: SURefGuide
  onPush?: () => void
}

function GuideDisplay({ guide, onPush }: GuideDisplayProps) {
  const interactive = useCombatGuideInteractiveConfig({ guide, onPush })
  return <ReferenceEntityDisplay data={guide} compact={true} interactive={interactive} />
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function CombatGuidesPanel({ onPush }: CombatGuidesPanelProps) {
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null)

  const combatGuides = useMemo(() => {
    const found: SURefGuide[] = []
    for (const id of COMBAT_GUIDE_IDS) {
      const guide = SalvageUnionReference.Guides.find((g) => g.id === id)
      if (guide) found.push(guide as SURefGuide)
    }
    return found
  }, [])

  const selectedGuide = useMemo(
    () => combatGuides.find((g) => g.id === selectedGuideId) ?? null,
    [combatGuides, selectedGuideId]
  )

  const handleSelect = useCallback((id: string) => {
    setSelectedGuideId((prev) => (prev === id ? null : id))
  }, [])

  return (
    <div className="space-y-2">
      <div className="space-y-0.5">
        {combatGuides.map((guide) => {
          const isSelected = guide.id === selectedGuideId
          return (
            <button
              key={guide.id}
              type="button"
              onClick={() => handleSelect(guide.id)}
              className="flex w-full cursor-pointer items-center border border-su-black bg-su-white px-3 py-2 text-left transition-colors hover:bg-su-grey-light data-[selected=true]:bg-su-black data-[selected=true]:text-su-white"
              data-selected={isSelected}
            >
              <Text
                variant="pseudoheader"
                as="span"
                className={`text-sm uppercase ${isSelected ? 'text-su-white' : 'text-su-black'}`}
              >
                {guide.name}
              </Text>
            </button>
          )
        })}
      </div>

      {selectedGuide && (
        <div className="mt-2">
          <GuideDisplay guide={selectedGuide} onPush={onPush} />
        </div>
      )}
    </div>
  )
}
