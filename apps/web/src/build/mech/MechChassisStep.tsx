import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import type { RefChassis } from 'salvageunion-reference'
import {
  nameToSlug,
  normalizePatternName,
  SalvageUnionReference,
  visiblePatterns,
} from 'salvageunion-reference'
import { isLegalCreationChassis, legalStartingPatterns } from 'salvageunion-reference/rules'
import {
  EmptyState,
  Entity,
  Eyebrow,
  MasonryColumns,
  ReferenceEntityCard,
  Slab,
  Stat,
  TitledBox,
  tokens,
} from '../../components/index'
import { chassisFitsCreationBudget } from '../../lib/rules/creation'
import { mechCopy } from '../../messages/build-mech'
import { textSmStyle } from '../wizard/wizardStyles.model'

const HINT = {
  ...textSmStyle,
  color: 'currentcolor',
  fontFamily: tokens.font.body,
  margin: 0,
} satisfies CSSProperties

/** MOCK: the table's cost line and its cite, on one line where they fit. */
const COST_LINE = {
  alignItems: 'baseline',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
  justifyContent: 'space-between',
  marginTop: tokens.space[8],
} satisfies CSSProperties

const NO_MARGIN = { margin: 0 } satisfies CSSProperties

const CUSTOM_BODY = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  margin: 0,
} satisfies CSSProperties

/** A canonical chassis pattern as stored on the reference chassis record. */
export type ChassisPattern = RefChassis['patterns'][number]

/**
 * MOCK (Working Manual, "compare at a glance"): a chassis's stats in the
 * book's order (ruleset §2.6), then what it costs to craft. Every pick Compact
 * prints all seven, in this order, on one grid (`.su-wiz-pick-stats`): no
 * right-to-left fill moves a stat from card to card (C2b).
 */
function ChassisStats({ chassis }: { chassis: RefChassis }) {
  return (
    <div className="su-wiz-pick-stats">
      <Stat size="mini" label="SP" value={chassis.structurePoints} />
      <Stat size="mini" label="EP" value={chassis.energyPoints} />
      <Stat size="mini" label="Sys" value={chassis.systemSlots} />
      <Stat size="mini" label="Mod" value={chassis.moduleSlots} />
      <Stat size="mini" label="Heat" value={chassis.heatCapacity} />
      <Stat size="mini" label="Cargo" value={chassis.cargoCapacity} />
      <Stat size="mini" label="Scrap" value={chassis.salvageValue} />
    </div>
  )
}

/**
 * The pick's head is its name alone: its measures are the body's grid, TL is
 * the slab's, and its art is the detail card's beside the grid.
 */
const CHASSIS_OMIT = [
  'art',
  'tech-level',
  'ref-stat-structurePoints',
  'ref-stat-energyPoints',
  'ref-stat-heatCapacity',
  'ref-stat-systemSlots',
  'ref-stat-moduleSlots',
  'ref-stat-cargoCapacity',
  'ref-stat-salvageValue',
] as const

/** MOCK: a pattern's loadout as one line, its systems then its modules. */
function loadoutLine(pattern: ChassisPattern): string {
  const names = (list: readonly { name: string; count?: number | undefined }[]) =>
    list.map((entry) =>
      entry.count && entry.count > 1 ? `${entry.name} ×${entry.count}` : entry.name
    )
  return [...names(pattern.systems ?? []), ...names(pattern.modules ?? [])].join(', ')
}

type MechChassisStepProps = {
  /** Chassis slug ref ('' while unchosen). */
  chassisName: string
  /** Current pattern name — drives the strip's radio state. */
  patternName: string
  /** Radio semantics — a new chassis replaces the old (refund + wipe). */
  onSelectChassis: (chassisSlug: string) => void
  /** Prefill step 2 from a canonical pattern (debits the budget). */
  onSelectPattern: (pattern: ChassisPattern) => void
  /** Custom build — no prefill; craft manually in step 2. */
  onSelectCustom: () => void
}

/**
 * MOCK (Working Manual, mockup C) · Step 1 · Chassis, in the app's own picker
 * pattern (EDL "Wizard or picker: Compact, select", N7): the Tech 1 chassis
 * are a grid of select Compacts, exactly one picked (radio; the ink ring and
 * the Selected seal), each with its seven stats in one fixed order. The pick
 * fills the detail column as its contentful card (art, its ability as a
 * contentful Mini). "Or start from a pattern" is the same pattern again: the
 * `legalStarting` patterns as select Compacts, and Custom build. The rules are
 * unchanged: only Tech 1 chassis render, Scrap is the Salvage Value, and a
 * pattern prefills step 2 and debits the 20-Scrap pool.
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
    <div className="su-wiz-compare-layout">
      <div className="su-wiz-compare-main">
        <div>
          <Slab label={mechCopy('tech1Chassis')} count="Choose 1" countInk="inherit" />
          <MasonryColumns maxColumns={2} radio ariaLabel={mechCopy('chassis')}>
            {chassisPool.map((chassis) => {
              const slug = nameToSlug(chassis.name)
              // Every Tech 1 chassis fits the 20-Scrap cap; one that did not
              // would not be offered (the gate re-checks it).
              if (!chassisFitsCreationBudget(chassis.salvageValue)) return null
              return (
                <Entity
                  key={chassis.id}
                  size="compact"
                  entity={chassis}
                  omit={CHASSIS_OMIT}
                  leading={<ChassisStats chassis={chassis} />}
                  mode={{
                    kind: 'select',
                    role: 'radio',
                    selected: slug === chassisName,
                    onSelect: () => onSelectChassis(slug),
                    label: chassis.name,
                  }}
                />
              )
            })}
          </MasonryColumns>
          <div style={COST_LINE}>
            <p style={HINT}>A chassis costs its Salvage Value in Tech 1 Scrap.</p>
            <Eyebrow as="p" tone="muted" style={NO_MARGIN}>
              Workshop Manual · p.94 · Mech Chassis pp.100–159
            </Eyebrow>
          </div>
        </div>
        {selectedChassis !== undefined && (
          <div>
            <Slab label="Or start from a pattern" count="Optional" countInk="inherit" />
            <MasonryColumns maxColumns={2} radio ariaLabel={mechCopy('startingPattern')}>
              {patternPool.map((pattern) => (
                <Entity
                  key={pattern.name}
                  size="compact"
                  entity={selectedChassis}
                  pattern={pattern}
                  omit={CHASSIS_OMIT}
                  leading={<p className="su-wiz-pick-line">{loadoutLine(pattern)}</p>}
                  mode={{
                    kind: 'select',
                    role: 'radio',
                    selected:
                      normalizePatternName(pattern.name) === normalizePatternName(patternName),
                    onSelect: () => onSelectPattern(pattern),
                    label: `${pattern.name} pattern`,
                  }}
                />
              ))}
              {/* No entity, so no Card: the Compact's frame in select mode, solid, since a
                  custom build is not user-made (ruleset §3.9). */}
              <TitledBox
                title={mechCopy('customBuild')}
                select={{
                  kind: 'select',
                  role: 'radio',
                  selected: isCustom,
                  onSelect: onSelectCustom,
                  label: mechCopy('customBuild'),
                }}
              >
                <p style={CUSTOM_BODY}>{mechCopy('noPrefillCraftYourSystems')}</p>
              </TitledBox>
            </MasonryColumns>
          </div>
        )}
      </div>

      <div className="su-wiz-compare-detail su-wiz-compare-detail--sticky">
        {selectedChassis === undefined ? (
          <EmptyState variant="quiet" body={mechCopy('pickAChassisToReveal')} bodyInk="inherit" />
        ) : (
          <ReferenceEntityCard
            data={selectedChassis}
            size="compact"
            hide={{ actions: true, choices: true, patterns: true }}
            // Choosing a chassis needs its ability: nested in the pick, a
            // contentful Mini (N3, E19).
            showChassisAbility
          />
        )}
      </div>
    </div>
  )
}
