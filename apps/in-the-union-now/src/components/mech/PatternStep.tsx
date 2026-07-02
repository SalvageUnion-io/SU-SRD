import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { Field, Input, OptRow, ReferenceEntityDisplay, SectionSeparator } from 'suref-react'
import { SelMasonry } from '../wizard/SelMasonry'
import { patternsForChassis } from './patternData'
import type { PatternLike } from './patternData'

/**
 * Resolve a pattern's system/module name refs to display entities. Keys carry
 * the source index so a pattern that installs duplicate equipment renders one
 * card per copy (duplicates are valid — slots are the only limit), instead of
 * colliding on a name-based key and silently dropping the repeat.
 */
function resolvePatternEntities(pattern: PatternLike): { key: string; entity: SURefEntity }[] {
  return [
    ...(pattern.systems ?? []).flatMap((s, i) => {
      const found = SalvageUnionReference.Systems.find((x) => x.name === s.name)
      return found ? [{ key: `sys-${i}-${s.name}`, entity: found as unknown as SURefEntity }] : []
    }),
    ...(pattern.modules ?? []).flatMap((m, i) => {
      const found = SalvageUnionReference.Modules.find((x) => x.name === m.name)
      return found ? [{ key: `mod-${i}-${m.name}`, entity: found as unknown as SURefEntity }] : []
    }),
  ]
}

type PatternOptionListProps = {
  chassisName: string
  /** Selected canonical pattern name; null when custom or nothing chosen. */
  selectedPatternName: string | null
  /** True when the "Custom Pattern" option is active. */
  isCustom: boolean
  onSelectPattern: (pattern: PatternLike) => void
  onSelectCustom: () => void
}

/**
 * Master pane for the Pattern step (mirrors the Chassis step): an OptRow per
 * canonical chassis pattern, plus a "Custom Pattern" row that drops into the
 * manual loadout step.
 */
export function PatternOptionList({
  chassisName,
  selectedPatternName,
  isCustom,
  onSelectPattern,
  onSelectCustom,
}: PatternOptionListProps) {
  const patterns = patternsForChassis(chassisName)
  return (
    <div>
      {patterns.map((pattern) => (
        <OptRow
          key={pattern.name}
          name={pattern.name}
          active={!isCustom && pattern.name === selectedPatternName}
          onClick={() => onSelectPattern(pattern)}
        />
      ))}
      <p className="mb-2 mt-5 font-cond text-xs font-bold uppercase tracking-widest text-wk-muted">
        Or build your own
      </p>
      <OptRow name="Custom Pattern" active={isCustom} onClick={onSelectCustom} />
    </div>
  )
}

type PatternDetailProps = {
  chassisName: string
  isCustom: boolean
  selectedPatternName: string | null
  /** Current custom pattern name (custom mode only). */
  customName: string
  onCustomNameChange: (name: string) => void
}

/**
 * Detail pane for the Pattern step: previews the selected canonical pattern's
 * systems/modules as head-mode cards, or — in custom mode — a required name
 * field (the manual systems/modules selection happens on the next step).
 */
export function PatternDetail({
  chassisName,
  isCustom,
  selectedPatternName,
  customName,
  onCustomNameChange,
}: PatternDetailProps) {
  if (isCustom) {
    return (
      <div className="max-w-3xl space-y-3">
        <Field label="Pattern name" required htmlFor="custom-pattern-name">
          <Input
            id="custom-pattern-name"
            type="text"
            value={customName}
            onChange={(e) => onCustomNameChange(e.target.value)}
            placeholder="e.g. My Custom Build"
            required
          />
        </Field>
        <p className="font-body text-caption text-wk-muted">
          Name your custom pattern. You&rsquo;ll choose its systems and modules next.
        </p>
      </div>
    )
  }

  const pattern = selectedPatternName
    ? patternsForChassis(chassisName).find((p) => p.name === selectedPatternName)
    : undefined

  if (!pattern) {
    return (
      <div className="flex h-full min-h-40 items-center justify-center rounded-[3px] border-chrome border-dashed border-wk-faint p-6 text-center text-sm text-wk-muted">
        Select a pattern to preview its loadout, or choose Custom Pattern to build your own.
      </div>
    )
  }

  const entities = resolvePatternEntities(pattern)

  return (
    <div className="space-y-3">
      <SectionSeparator label={`${pattern.name} · Loadout`} fontSize="text-xs" />
      {entities.length > 0 ? (
        <SelMasonry>
          {entities.map(({ key, entity }) => (
            <ReferenceEntityDisplay
              key={key}
              data={entity}
              mode="head"
              hide={{ actions: true, choices: true }}
            />
          ))}
        </SelMasonry>
      ) : (
        <p className="text-sm text-wk-muted">This pattern installs no systems or modules.</p>
      )}
    </div>
  )
}
