import { MasonryColumns, ReferenceEntityCard, Sel, Slab, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import type { RefChassis } from 'salvageunion-reference'
import {
  nameToSlug,
  normalizePatternName,
  SalvageUnionReference,
  visiblePatterns,
} from 'salvageunion-reference'
import {
  isLegalCreationChassis,
  legalStartingPatterns,
  MECH_CREATION_SCRAP_CAP,
} from 'salvageunion-reference/rules'
import { chassisFitsCreationBudget } from '../../lib/rules/creation'
import '../../styles/wizard.css'
import { fullWidthStyle, textSmStyle } from '../wizard/wizardStyles.model'

const HINT = {
  ...textSmStyle,
  color: 'currentcolor',
  fontFamily: tokens.font.body,
} satisfies CSSProperties

/** The Custom-build door: a dashed, user-made-looking pick card. */
const CUSTOM_CARD = {
  backgroundColor: tokens.color.paper,
  borderColor: tokens.color.ink55,
  borderRadius: tokens.radius.panel,
  borderStyle: 'dashed',
  borderWidth: tokens.borderWidth.pill,
  padding: tokens.space[16],
} satisfies CSSProperties

const CUSTOM_TITLE = {
  ...textSmStyle,
  color: tokens.color.ink,
  fontFamily: tokens.font.cond,
  fontWeight: tokens.weight.bold,
  letterSpacing: tokens.tracking.caps,
  margin: 0,
  textTransform: 'uppercase',
} satisfies CSSProperties

const CUSTOM_BODY = {
  color: tokens.color.wkMuted,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  margin: `${tokens.space[4]} 0 0`,
} satisfies CSSProperties

/** A canonical chassis pattern as stored on the reference chassis record. */
export type ChassisPattern = RefChassis['patterns'][number]

type MechChassisStepProps = {
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
 * One pattern option as the pattern reference card (the universal entity-card
 * rule): the chassis rendered in its PATTERN view, as everywhere else a
 * pattern is drawn — the quoted pattern title, the `Legal Starting Pattern`
 * label and the loadout as Tokens.
 */
function PatternSelCard({
  chassis,
  pattern,
  selected,
  onToggle,
}: {
  chassis: RefChassis
  pattern: ChassisPattern
  selected: boolean
  onToggle: () => void
}) {
  return (
    <ReferenceEntityCard
      data={chassis}
      pattern={pattern}
      size="medium"
      selected={selected}
      selectionRole="radio"
      cardClickLabel={`${pattern.name} pattern`}
      onCardClick={onToggle}
      hide={{ actions: true, choices: true }}
      // Choosing a pattern needs its chassis ability (E19's builder exception).
      showChassisAbility
    />
  )
}

/**
 * Step 2 · Craft your Mech Chassis (Mech Workshop p.94) — exactly one, radio
 * semantics, enforced HARD: only Tech 1 chassis render
 * (package `isLegalCreationChassis` — higher TLs are never shown), each card
 * foot shows its crafting cost (`COSTS n SCRAP`), and picking one debits the
 * 20-Scrap budget. Below the pick, a "Start from a pattern?" strip offers
 * ONLY the stored-flag `legalStarting` patterns (or Custom build); picking a
 * pattern prefills steps 4–5 and debits accordingly.
 */
export function MechChassisStep({
  chassisName,
  patternName,
  onSelectChassis,
  onSelectPattern,
  onSelectCustom,
}: MechChassisStepProps) {
  const chassisPool = useMemo(
    () =>
      SalvageUnionReference.Chassis.all()
        .filter((c) => isLegalCreationChassis(c.techLevel))
        .sort((a, b) => a.name.localeCompare(b.name)),
    []
  )

  const selectedChassis = chassisName
    ? chassisPool.find((c) => nameToSlug(c.name) === chassisName)
    : undefined

  const patternPool: ChassisPattern[] = selectedChassis
    ? legalStartingPatterns(visiblePatterns(selectedChassis.patterns))
    : []

  // Compare NORMALIZED: mechs saved before the data dropped the " Pattern"
  // suffix still store e.g. "Hauler Pattern", which must keep matching the
  // renamed "Hauler" rather than silently reading as a Custom pattern.
  const isCustom = !patternPool.some(
    (p) => normalizePatternName(p.name) === normalizePatternName(patternName)
  )

  return (
    <div className="su-wiz-stack su-wiz-stack--20" style={fullWidthStyle}>
      <Slab variant="solid" label="Tech 1 Chassis" count="Choose 1" countInk="inherit" />
      <MasonryColumns maxColumns={2} radio ariaLabel="Chassis">
        {chassisPool.map((chassis) => {
          const cost = chassis.salvageValue
          const reason = chassisFitsCreationBudget(cost)
            ? undefined
            : `Costs ${cost} scrap · ${MECH_CREATION_SCRAP_CAP} cap`
          return (
            <ReferenceEntityCard
              key={chassis.id}
              data={chassis}
              size="medium"
              selected={nameToSlug(chassis.name) === chassisName}
              selectionRole="radio"
              cardClickLabel={chassis.name}
              selectable={!reason}
              onCardClick={reason ? undefined : () => onSelectChassis(nameToSlug(chassis.name))}
              hide={{ actions: true, choices: true, patterns: true }}
              // Choosing a chassis needs its ability (E19's builder exception).
              showChassisAbility
              footMeta={[
                { label: 'Costs', value: `${cost} scrap` },
                ...(reason ? [{ label: reason, value: '' }] : []),
              ]}
            />
          )
        })}
      </MasonryColumns>

      {selectedChassis === undefined ? (
        <p style={HINT}>Pick a chassis to reveal its starting patterns.</p>
      ) : (
        <>
          <Slab variant="solid" label="Start from a pattern?" count="Optional" countInk="inherit" />
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
              className={isCustom ? 'su-wiz-custom-build-ring' : undefined}
            >
              <div style={CUSTOM_CARD}>
                <p style={CUSTOM_TITLE}>Custom build</p>
                <p style={CUSTOM_BODY}>
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
