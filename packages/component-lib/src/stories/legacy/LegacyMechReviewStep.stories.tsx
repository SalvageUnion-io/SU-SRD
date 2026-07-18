import type { Story } from '@ladle/react'
import { SalvageUnionReference, nameToSlug } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { resolveModuleRef, resolveSystemRef } from 'salvageunion-reference/rules'
import { Btn } from '../../components/chrome/Btn'
import { ReferenceEntityDisplay } from '../../components/referenceEntity/card/referenceEntityDisplayShim'
import { cn } from '../../utils/cn'
import { Caption } from '../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Mech Review Step' }

// Minimal local mirror of the app-only MechWizardFormState fields this step
// reads (mechFormState.ts). `LAYOUT.reviewLabelRail` = 'w-[120px]' (layout.ts).
type MechReviewForm = {
  name: string
  chassisName: string
  patternName: string
  systems: string[]
  modules: string[]
}
const REVIEW_LABEL_RAIL = 'w-[120px]'

/** Verbatim from MechReviewStep.tsx `KvRow` (lines 24-40). */
function KvRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-4 border-b border-wk-bg-2 py-2.5 last:border-0">
      <span
        className={cn(
          REVIEW_LABEL_RAIL,
          'shrink-0 font-cond text-xs font-bold uppercase tracking-widest text-wk-muted'
        )}
      >
        {label}
      </span>
      <span className={value ? 'font-body text-[13.5px] text-ink' : 'text-rust'}>
        {value ?? 'required'}
      </span>
    </div>
  )
}

/**
 * Reproduction of apps/in-the-union-now/src/components/mech/MechReviewStep.tsx
 * (lines 48-127): a kv-panel of the build's fields on the left (with a
 * Save-as-pattern button below it), the chosen system + module cards stacked on
 * the right (fresh installs carry an 'Intact' status badge in create mode).
 * APPROXIMATION: the app-only SavePatternButton is stood in by a plain Btn;
 * cargo lots are omitted (totalLotUnits is app-only and create-mode grants no
 * starting cargo, so the row never appears here).
 */
function LegacyMechReviewStep({
  form,
  isEdit,
  submitError,
  bankedScrap,
}: {
  form: MechReviewForm
  isEdit: boolean
  submitError: string | null
  bankedScrap?: number
}) {
  const chosenSystems = form.systems.flatMap((ref) => {
    const found = resolveSystemRef(ref)
    return found ? [found as unknown as SURefEntity] : []
  })
  const chosenModules = form.modules.flatMap((ref) => {
    const found = resolveModuleRef(ref)
    return found ? [found as unknown as SURefEntity] : []
  })

  const rows: [string, string | null][] = [
    ['Name', form.name.trim() || null],
    ['Chassis', form.chassisName || null],
    ['Pattern', form.patternName.trim() || 'none'],
    ['Systems', form.systems.length > 0 ? form.systems.join(', ') : 'none'],
    ['Modules', form.modules.length > 0 ? form.modules.join(', ') : 'none'],
  ]

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
      {/* kv-panel */}
      <div className="self-start">
        <div className="rounded-[3px] border-chrome border-ink bg-paper px-6 py-4 text-sm">
          {rows.map(([k, v]) => (
            <KvRow key={k} label={k} value={v} />
          ))}
          {submitError && (
            <p role="alert" className="mt-3 text-sm text-rust">
              {submitError}
            </p>
          )}
        </div>
        {bankedScrap !== undefined && (
          <p
            data-testid="banking-callout"
            className="mt-3 rounded-[3px] border-chrome border-ink bg-paper px-4 py-3 font-cond text-sm font-bold uppercase tracking-caps text-ink"
          >
            {bankedScrap} Tech 1 Scrap banks to your Union Crawler — note it in the Crawler&rsquo;s
            Scrap Pool.
          </p>
        )}
        {form.chassisName && (
          <div className="mt-3">
            {/* App-only SavePatternButton stood in by a plain Btn. */}
            <Btn size="sm">Save as pattern</Btn>
          </div>
        )}
      </div>

      {/* chosen cards */}
      <div className="space-y-3">
        {[...chosenSystems, ...chosenModules].map((entity, i) => (
          <ReferenceEntityDisplay
            // biome-ignore lint/suspicious/noArrayIndexKey: the same system/module may be chosen more than once, so the id alone is not unique; the list only appends/removes at stable positions during review
            key={`${(entity as { id?: string }).id ?? 'entity'}-${i}`}
            data={entity}
            compact
            status={isEdit ? undefined : 'intact'}
            hide={{ actions: true, choices: true }}
          />
        ))}
        {chosenSystems.length === 0 && chosenModules.length === 0 && (
          <p className="text-sm text-current">No systems or modules installed.</p>
        )}
      </div>
    </div>
  )
}

/** Build a real create-mode form from the first legal chassis + two real installs. */
function useReviewFixture(): MechReviewForm {
  const chassis = SalvageUnionReference.Chassis.all()[0]
  const system = SalvageUnionReference.Systems.all()[0]
  const module = SalvageUnionReference.Modules.all()[0]
  return {
    name: 'Ravager',
    chassisName: chassis ? nameToSlug(chassis.name) : '',
    patternName: '',
    systems: system ? [nameToSlug(system.name)] : [],
    modules: module ? [nameToSlug(module.name)] : [],
  }
}

export const CreateMode: Story = () => {
  const form = useReviewFixture()
  return (
    <div className="flex flex-col gap-4">
      <Caption>
        Legacy · Mech Review step, create mode with banking callout (ITUN MechReviewStep, lines
        48-127)
      </Caption>
      <LegacyMechReviewStep form={form} isEdit={false} submitError={null} bankedScrap={4} />
    </div>
  )
}

export const WithError: Story = () => {
  const form = { ...useReviewFixture(), name: '' }
  return (
    <div className="flex flex-col gap-4">
      <Caption>Legacy · Mech Review step with a required-field error + submit error</Caption>
      <LegacyMechReviewStep form={form} isEdit={false} submitError="Name is required." />
    </div>
  )
}
