import { useMemo } from 'react'
import {
  SalvageUnionReference,
  nameToSlug,
  normalizePatternName,
  visiblePatterns,
} from 'salvageunion-reference'
import type { SURefChassis } from 'salvageunion-reference'
import {
  isLegalCreationChassis,
  legalStartingPatterns,
  matchesRef,
  MECH_CREATION_SCRAP_CAP,
} from 'salvageunion-reference/rules'
import {
  MasonryColumns,
  ReferenceEntityCard,
  Sel,
  Slab,
  useChassisPatternConfig,
} from 'component-lib'

/** A canonical chassis pattern as stored on the reference chassis record. */
export type ChassisPattern = SURefChassis['patterns'][number]

type MechChassisStepProps = {
  /** Edit mode lifts the Tech-1 filter and the legal-starting pattern filter. */
  isEdit: boolean
  /** Chassis slug ref ('' while unchosen). */
  chassisName: string
  /** Current pattern name — drives the strip's radio state. */
  patternName: string
  /** Radio semantics — a new chassis replaces the old (refund + wipe). */
  onSelectChassis: (chassisSlug: string) => void
  /** Prefill steps 4–5 from a canonical pattern (debits the budget). */
  onSelectPattern: (pattern: ChassisPattern) => void
  /** Custom build — no prefill; craft manually in steps 4–5. */
  onSelectCustom: () => void
}

/**
 * One pattern option as the SRD pattern reference card (the universal
 * entity-card rule): the chassis entity rendered through
 * `useChassisPatternConfig`, which supplies the quoted pattern title and the
 * stored-flag `LEGAL STARTING PATTERN` badge. A component (not an inline
 * map) because the config is a hook.
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
    chassis,
    { name: pattern.name, systems: pattern.systems, modules: pattern.modules },
    true
  )
  return (
    <ReferenceEntityCard
      data={chassis}
      size="medium"
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
 * Step 2 · Craft your Mech Chassis (Mech Workshop p.94) — exactly one, radio
 * semantics. Create mode is HARD (plan §4.2): only Tech 1 chassis render
 * (package `isLegalCreationChassis` — higher TLs are never shown), each card
 * foot shows its crafting cost (`COSTS n SCRAP`), and picking one debits the
 * 20-Scrap budget. Below the pick, a "Start from a pattern?" strip offers
 * ONLY the stored-flag `legalStarting` patterns (or Custom build); picking a
 * pattern prefills steps 4–5 and debits accordingly. Edit mode lifts every
 * filter (all TLs, all patterns) — the soft regime.
 */
export function MechChassisStep({
  isEdit,
  chassisName,
  patternName,
  onSelectChassis,
  onSelectPattern,
  onSelectCustom,
}: MechChassisStepProps) {
  const chassisPool = useMemo(() => {
    const all = SalvageUnionReference.Chassis.all()
    const pool = isEdit ? [...all] : all.filter((c) => isLegalCreationChassis(c.techLevel))
    return pool.sort((a, b) => a.name.localeCompare(b.name))
  }, [isEdit])

  const selectedChassis = chassisName
    ? chassisPool.find((c) => matchesRef(c, chassisName))
    : undefined

  const patternPool: ChassisPattern[] = selectedChassis
    ? isEdit
      ? visiblePatterns(selectedChassis.patterns)
      : legalStartingPatterns(visiblePatterns(selectedChassis.patterns))
    : []

  // Compare NORMALIZED: mechs saved before the data dropped the " Pattern"
  // suffix still store e.g. "Hauler Pattern", which must keep matching the
  // renamed "Hauler" rather than silently reading as a Custom pattern.
  const isCustom = !patternPool.some(
    (p) => normalizePatternName(p.name) === normalizePatternName(patternName)
  )

  return (
    <div className="w-full space-y-5">
      <Slab variant="solid" label={isEdit ? 'Chassis' : 'Tech 1 Chassis'} count="Choose 1" />
      <MasonryColumns maxColumns={2} radio ariaLabel="Chassis">
        {chassisPool.map((chassis) => {
          const cost = chassis.salvageValue
          const reason =
            !isEdit && cost > MECH_CREATION_SCRAP_CAP
              ? `Costs ${cost} scrap · ${MECH_CREATION_SCRAP_CAP} cap`
              : undefined
          return (
            <ReferenceEntityCard
              key={chassis.id}
              data={chassis}
              size="medium"
              selected={matchesRef(chassis, chassisName)}
              selectionRole="radio"
              cardClickLabel={chassis.name}
              selectable={!reason}
              onCardClick={reason ? undefined : () => onSelectChassis(nameToSlug(chassis.name))}
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
          <Slab variant="solid" label="Start from a pattern?" count="Optional" />
          <MasonryColumns maxColumns={2} radio ariaLabel="Starting pattern">
            {patternPool.map((pattern) => (
              <PatternSelCard
                key={pattern.name}
                chassis={selectedChassis}
                pattern={pattern}
                selected={normalizePatternName(pattern.name) === normalizePatternName(patternName)}
                onToggle={() => onSelectPattern(pattern)}
              />
            ))}
            <Sel
              selected={isCustom}
              onToggle={onSelectCustom}
              ariaLabel="Custom build"
              radio
              className={
                isCustom ? 'shadow-[0_0_0_3px_var(--ground),0_0_0_6px_var(--color-ink)]' : undefined
              }
            >
              <div className="rounded-[5px] border-2 border-dashed border-ink/55 bg-paper px-4 py-4">
                <p className="m-0 font-cond text-sm font-bold uppercase tracking-caps text-ink">
                  Custom build
                </p>
                <p className="m-0 mt-1 font-body text-caption text-ink-2">
                  No prefill — craft your Systems and Modules by hand in the next steps.
                </p>
              </div>
            </Sel>
          </MasonryColumns>
        </>
      )}
    </div>
  )
}
