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
import {
  EmptyState,
  Eyebrow,
  Radio,
  ReferenceEntityCard,
  Slab,
  tokens,
} from '../../components/index'
import { chassisFitsCreationBudget } from '../../lib/rules/creation'
import { mechCopy } from '../../messages/build-mech'
import type { CompareColumn } from '../wizard/CompareTable'
import { CompareTable } from '../wizard/CompareTable'
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

/** MOCK: the pattern radios, one under the next. */
const PATTERNS = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
} satisfies CSSProperties

/** A canonical chassis pattern as stored on the reference chassis record. */
export type ChassisPattern = RefChassis['patterns'][number]

/**
 * MOCK (Working Manual, "Compare in columns"): a chassis's stats in the book's
 * order (ruleset §2.6), then what it costs to craft.
 */
const CHASSIS_COLUMNS: readonly CompareColumn<RefChassis>[] = [
  { key: 'sp', label: 'SP', title: 'Structure Points', value: (c) => c.structurePoints },
  { key: 'ep', label: 'EP', title: 'Energy Points', value: (c) => c.energyPoints },
  { key: 'sys', label: 'Sys', title: 'System slots', value: (c) => c.systemSlots },
  { key: 'mod', label: 'Mod', title: 'Module slots', value: (c) => c.moduleSlots },
  { key: 'heat', label: 'Heat', title: 'Heat Capacity', value: (c) => c.heatCapacity },
  { key: 'cargo', label: 'Cargo', title: 'Cargo Capacity', value: (c) => c.cargoCapacity },
  { key: 'cost', label: 'Scrap', title: 'Cost in Tech 1 Scrap', value: (c) => c.salvageValue },
]

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
 * MOCK (Working Manual, mockup C) · Step 1 · Chassis. The Tech 1 chassis are
 * the rows of one compare table (`CompareTable`), exactly one picked (radio).
 * The picked row fills the detail column: the chassis's own card (art, stats,
 * its ability as a contentful Mini), then "or start from a pattern", the
 * `legalStarting` patterns as a radio list. The rules are unchanged: only
 * Tech 1 chassis render, the cost column is the Salvage Value, and a pattern
 * prefills step 2 and debits the 20-Scrap pool.
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
          <CompareTable
            ariaLabel={mechCopy('chassis')}
            nameLabel={mechCopy('chassis')}
            rows={chassisPool}
            rowKey={(c) => nameToSlug(c.name)}
            rowName={(c) => c.name}
            columns={CHASSIS_COLUMNS}
            selected={chassisName || undefined}
            onSelect={onSelectChassis}
            disabledReason={(c) =>
              chassisFitsCreationBudget(c.salvageValue)
                ? undefined
                : `Costs ${c.salvageValue} scrap · ${MECH_CREATION_SCRAP_CAP} cap`
            }
          />
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
            <div role="radiogroup" aria-label={mechCopy('startingPattern')} style={PATTERNS}>
              {patternPool.map((pattern) => (
                <Radio
                  key={pattern.name}
                  name="mech-starting-pattern"
                  stacked
                  label={`${pattern.name} pattern`}
                  description={loadoutLine(pattern)}
                  checked={normalizePatternName(pattern.name) === normalizePatternName(patternName)}
                  onChange={() => onSelectPattern(pattern)}
                />
              ))}
              <Radio
                name="mech-starting-pattern"
                stacked
                label={mechCopy('customBuild')}
                description={mechCopy('noPrefillCraftYourSystems')}
                checked={isCustom}
                onChange={onSelectCustom}
              />
            </div>
          </div>
        )}
      </div>

      <div className="su-wiz-compare-detail">
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
