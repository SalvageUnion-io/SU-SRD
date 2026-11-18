import { useMemo } from 'react'
import type { RefChassis } from 'salvageunion-reference'
import {
  nameToSlug,
  normalizePatternName,
  SalvageUnionReference,
  visiblePatterns,
} from 'salvageunion-reference'
import { isLegalCreationChassis, legalStartingPatterns } from 'salvageunion-reference/rules'
import { EmptyState, ReferenceEntityCard } from '../../components/index'
import { chassisFitsCreationBudget } from '../../lib/rules/creation'
import { mechCopy } from '../../messages/build-mech'
import type { PickColumn } from '../wizard/PickList'
import { PickList } from '../wizard/PickList'

/** A canonical chassis pattern as stored on the reference chassis record. */
export type ChassisPattern = RefChassis['patterns'][number]

/**
 * MOCK (Working Manual, "compare at a glance"): a chassis's stats in the
 * book's order (ruleset §2.6), then, set apart, what it costs to craft.
 */
const CHASSIS_COLUMNS: readonly PickColumn<RefChassis>[] = [
  { key: 'sp', label: 'SP', title: 'Structure Points', value: (c) => c.structurePoints },
  { key: 'ep', label: 'EP', title: 'Energy Points', value: (c) => c.energyPoints },
  { key: 'sys', label: 'Sys', title: 'System slots', value: (c) => c.systemSlots },
  { key: 'mod', label: 'Mods', title: 'Module slots', value: (c) => c.moduleSlots },
  { key: 'heat', label: 'Heat', title: 'Heat Capacity', value: (c) => c.heatCapacity },
  { key: 'cargo', label: 'Cargo', title: 'Cargo Capacity', value: (c) => c.cargoCapacity },
  {
    key: 'cost',
    label: 'Scrap',
    title: 'Cost in Tech 1 Scrap',
    value: (c) => c.salvageValue,
    apart: true,
  },
]

/** MOCK: a starting-pattern row: a book pattern, or the custom build. */
type PatternRow = { key: string; name: string; line: string; pattern?: ChassisPattern }

const PATTERN_COLUMNS: readonly PickColumn<PatternRow>[] = [
  { key: 'loadout', label: 'Loadout', text: true, value: (row) => row.line },
]

const CUSTOM_KEY = 'custom-build'

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
 * the rows of one picker (`PickList`): one frame in the mech band's paint, a
 * stamped head strip, a select row a chassis with its seven figures in fixed
 * columns, exactly one picked (radio). The pick fills the detail column as its
 * contentful card (art, its ability as a contentful Mini). "Or start from a
 * pattern" is the same picker: the `legalStarting` patterns and Custom build,
 * a name and a loadout line each. The rules are unchanged: only Tech 1 chassis
 * render, Scrap is the Salvage Value, and a pattern prefills step 2 and debits
 * the 20-Scrap pool.
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

  const patternRows: PatternRow[] = [
    ...patternPool.map((pattern) => ({
      key: pattern.name,
      name: pattern.name,
      line: loadoutLine(pattern),
      pattern,
    })),
    {
      key: CUSTOM_KEY,
      name: mechCopy('customBuild'),
      line: mechCopy('noPrefillCraftYourSystems'),
    },
  ]
  const selectedPatternKey = isCustom
    ? CUSTOM_KEY
    : patternPool.find((p) => normalizePatternName(p.name) === normalizePatternName(patternName))
        ?.name

  return (
    <div className="su-wiz-compare-layout">
      <div className="su-wiz-compare-main">
        <div>
          <PickList
            title={mechCopy('tech1Chassis')}
            note="Choose 1"
            rows={chassisPool.filter((c) => chassisFitsCreationBudget(c.salvageValue))}
            rowKey={(c) => nameToSlug(c.name)}
            rowName={(c) => c.name}
            columns={CHASSIS_COLUMNS}
            selected={chassisName || undefined}
            onSelect={onSelectChassis}
            foot={{
              cite: 'Workshop Manual · p.94 · Mech Chassis pp.100–159',
              meta: { label: 'Costs', value: 'its Salvage Value in Tech 1 Scrap' },
            }}
          />
        </div>
        {selectedChassis !== undefined && (
          <div>
            <PickList
              title="Or start from a pattern"
              note="Optional"
              rows={patternRows}
              rowKey={(row) => row.key}
              rowName={(row) => row.name}
              columns={PATTERN_COLUMNS}
              selected={selectedPatternKey}
              onSelect={(key) => {
                const row = patternRows.find((r) => r.key === key)
                if (row?.pattern) onSelectPattern(row.pattern)
                else onSelectCustom()
              }}
            />
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
