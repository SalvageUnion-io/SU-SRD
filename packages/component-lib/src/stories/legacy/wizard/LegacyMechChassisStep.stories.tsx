import type { Story } from '@ladle/react'
import { useMemo, useState } from 'react'
import { SalvageUnionReference, nameToSlug } from 'salvageunion-reference'
import type { SURefChassis, SURefEntity } from 'salvageunion-reference'
import {
  isLegalCreationChassis,
  legalStartingPatterns,
  matchesRef,
  MECH_CREATION_SCRAP_CAP,
} from 'salvageunion-reference/rules'
import { TreeSep } from '../../../components/chrome/TreeSep'
import { MasonryColumns } from '../../../components/shared/MasonryColumns'
import { ReferenceEntityDisplay } from '../../../components/referenceEntity/card/referenceEntityDisplayShim'
import { useChassisPatternConfig } from '../../../components/referenceEntity/ReferenceEntityDisplay/useChassisPatternConfig'
import { Caption } from '../../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Mech Chassis Craft Step' }

/** A canonical chassis pattern as stored on the reference chassis record. */
type ChassisPattern = SURefChassis['patterns'][number]

/**
 * Verbatim from MechChassisStep.tsx `PatternSelCard` (lines 43-71): one pattern
 * option as the SRD pattern reference card, driven through
 * `useChassisPatternConfig` (the quoted pattern title + stored-flag LEGAL
 * STARTING PATTERN badge).
 */
function PatternSelCard({
  chassis,
  pattern,
  selected,
  onToggle,
}: {
  chassis: SURefChassis
  pattern: ChassisPattern
  selected: boolean
  onToggle: () => void
}) {
  const config = useChassisPatternConfig(
    chassis as SURefEntity,
    { name: pattern.name, systems: pattern.systems, modules: pattern.modules },
    true
  )
  return (
    <ReferenceEntityDisplay
      data={chassis as SURefEntity}
      compact
      selected={selected}
      selectionRole="radio"
      cardClickLabel={`${pattern.name} pattern`}
      onCardClick={onToggle}
      hide={{ actions: true, choices: true }}
      {...(config ?? {})}
    />
  )
}

/**
 * Reproduction of the chassis-pool + pattern-pool body of
 * apps/in-the-union-now/src/components/mech/MechChassisStep.tsx (lines 83-176),
 * MINUS the "Custom build" door (Sel slice, lines 156-173) — that door is
 * captured separately in LegacyCustomBuildDoor.stories.tsx. Create mode is HARD:
 * only Tech-1 chassis render (package `isLegalCreationChassis`), each foot shows
 * `COSTS n SCRAP`, and a chassis whose SV exceeds the 20-Scrap cap dims with a
 * reason chip. Below the pick, the "Start from a pattern?" strip offers only the
 * stored-flag `legalStarting` patterns (`legalStartingPatterns`).
 */
function LegacyMechChassisStep({ isEdit }: { isEdit: boolean }) {
  const chassisPool = useMemo(() => {
    const all = SalvageUnionReference.Chassis.all()
    const pool = isEdit ? [...all] : all.filter((c) => isLegalCreationChassis(c.techLevel))
    return pool.sort((a, b) => a.name.localeCompare(b.name))
  }, [isEdit])

  const [chassisName, setChassisName] = useState('')
  const [patternName, setPatternName] = useState('')

  const selectedChassis = chassisName
    ? chassisPool.find((c) => matchesRef(c, chassisName))
    : undefined

  const patternPool: ChassisPattern[] = selectedChassis
    ? isEdit
      ? selectedChassis.patterns
      : legalStartingPatterns(selectedChassis.patterns)
    : []

  return (
    <div className="w-full space-y-5">
      <TreeSep name={isEdit ? 'Chassis' : 'Tech 1 Chassis'} suffix="Choose 1" />
      <MasonryColumns maxColumns={2} radio ariaLabel="Chassis">
        {chassisPool.map((chassis) => {
          const cost = chassis.salvageValue
          const reason =
            !isEdit && cost > MECH_CREATION_SCRAP_CAP
              ? `Costs ${cost} scrap · ${MECH_CREATION_SCRAP_CAP} cap`
              : undefined
          return (
            <ReferenceEntityDisplay
              key={chassis.id}
              data={chassis as SURefEntity}
              compact
              selected={matchesRef(chassis, chassisName)}
              selectionRole="radio"
              cardClickLabel={chassis.name}
              selectable={!reason}
              onCardClick={
                reason
                  ? undefined
                  : () => {
                      setChassisName(nameToSlug(chassis.name))
                      setPatternName('')
                    }
              }
              hide={{ actions: true, choices: true, patterns: true }}
              footMeta={[
                ...(isEdit ? [] : [{ label: 'Costs', value: `${cost} scrap` }]),
                ...(reason ? [{ label: reason, value: '' }] : []),
              ]}
            />
          )
        })}
      </MasonryColumns>

      {selectedChassis === undefined ? (
        <p className="font-body text-sm text-current">
          Pick a chassis to reveal its starting patterns.
        </p>
      ) : (
        <>
          <TreeSep name="Start from a pattern?" suffix="Optional" />
          <MasonryColumns maxColumns={2} radio ariaLabel="Starting pattern">
            {patternPool.map((pattern) => (
              <PatternSelCard
                key={pattern.name}
                chassis={selectedChassis}
                pattern={pattern}
                selected={pattern.name === patternName}
                onToggle={() => setPatternName(pattern.name)}
              />
            ))}
            {/* The "Custom build" Sel door (MechChassisStep lines 156-173) is a
                trailing MasonryColumns child in the real step; it is captured
                verbatim in LegacyCustomBuildDoor.stories.tsx and omitted here to
                avoid duplication (per the capture assignment). */}
          </MasonryColumns>
        </>
      )}
    </div>
  )
}

export const CreateMode: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>
      Legacy · Craft Chassis step, create mode (Tech-1 only, cost feet) — ITUN MechChassisStep lines
      83-176, custom-build door excluded. Click a chassis, then a pattern.
    </Caption>
    <LegacyMechChassisStep isEdit={false} />
  </div>
)

export const EditMode: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>
      Legacy · Craft Chassis step, edit mode (all TLs, all patterns, no cost feet) — ITUN
      MechChassisStep soft regime
    </Caption>
    <LegacyMechChassisStep isEdit={true} />
  </div>
)
