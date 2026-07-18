import type { SURefEntity } from 'salvageunion-reference'
import { KvRow, Panel, ReferenceEntityDisplay } from 'component-lib'
import type { MechWizardFormState } from '../../lib/wizard/mechFormState'
import { totalLotUnits } from '../../lib/schemas/cargoLot'
import { SavePatternButton } from './Pattern/SavePatternButton'
import { resolveModuleRef, resolveSystemRef } from '../../lib/rules/resolveRefs'

type MechReviewStepProps = {
  form: MechWizardFormState
  /** True when editing an existing mech (suppresses the fresh 'Intact' badge). */
  isEdit: boolean
  submitError: string | null
  /**
   * Unspent Tech 1 Scrap (create mode) — rendered as the banking callout
   * "N Tech 1 Scrap banks to your Union Crawler". TEXT ONLY, deliberately:
   * no cross-entity write (ADR-007 automation boundary) — the crawler's
   * Scrap Pool field is the manual landing spot.
   */
  bankedScrap?: number
}

/**
 * Review step (design §3.2 Review — undrawn for mechs; reuses the pilot
 * pattern): kv-panel of the build's fields on the left (with Save-as-pattern
 * below it), the chosen system + module cards stacked on the right (fresh
 * installs carry an 'Intact' status badge in create mode).
 */
export function MechReviewStep({ form, isEdit, submitError, bankedScrap }: MechReviewStepProps) {
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
  // Guided create grants no starting cargo (the input left the wizard in
  // Phase 4) — the row only appears when an edited mech actually holds some.
  if (form.cargoLots.length > 0) {
    rows.push([
      'Cargo',
      `${form.cargoLots.length} lot${form.cargoLots.length === 1 ? '' : 's'} · ${totalLotUnits(form.cargoLots)} units`,
    ])
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
      {/* kv-panel */}
      <div className="self-start">
        <Panel className="px-6 py-4 text-sm">
          {rows.map(([k, v]) => (
            <KvRow key={k} label={k} value={v} />
          ))}
          {submitError && (
            <p role="alert" className="mt-3 text-sm text-rust">
              {submitError}
            </p>
          )}
        </Panel>
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
            <SavePatternButton
              mechName={form.name.trim() || 'Unnamed Mech'}
              chassisRef={form.chassisName}
              systems={form.systems}
              modules={form.modules}
              cargoLots={form.cargoLots}
            />
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
