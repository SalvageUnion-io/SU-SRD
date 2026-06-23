import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from 'suref-react'
import type { MechWizardFormState } from '../../lib/wizard/mechFormState'
import { totalLotUnits } from '../../lib/schemas/cargoLot'
import { SavePatternButton } from './Pattern/SavePatternButton'

type MechReviewStepProps = {
  form: MechWizardFormState
  /** True when editing an existing mech (suppresses the fresh 'Intact' badge). */
  isEdit: boolean
  submitError: string | null
}

function KvRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-4 border-b border-wk-bg-2 py-2.5 last:border-0">
      <span className="w-[120px] shrink-0 font-cond text-xs font-bold uppercase tracking-[0.1em] text-wk-muted">
        {label}
      </span>
      <span className={value ? 'font-body text-[13.5px] text-ink' : 'text-rust'}>
        {value ?? 'required'}
      </span>
    </div>
  )
}

/**
 * Review step (design §3.2 Review — undrawn for mechs; reuses the pilot
 * pattern): kv-panel of the build's fields on the left (with Save-as-pattern
 * below it), the chosen system + module cards stacked on the right (fresh
 * installs carry an 'Intact' status badge in create mode).
 */
export function MechReviewStep({ form, isEdit, submitError }: MechReviewStepProps) {
  const chosenSystems = form.systems.flatMap((ref) => {
    const found = SalvageUnionReference.Systems.find((s) => s.name === ref)
    return found ? [found as unknown as SURefEntity] : []
  })
  const chosenModules = form.modules.flatMap((ref) => {
    const found = SalvageUnionReference.Modules.find((m) => m.name === ref)
    return found ? [found as unknown as SURefEntity] : []
  })

  const rows: [string, string | null][] = [
    ['Name', form.name.trim() || null],
    ['Chassis', form.chassisName || null],
    ['Pattern', form.patternName.trim() || 'none'],
    ['Systems', form.systems.length > 0 ? form.systems.join(', ') : 'none'],
    ['Modules', form.modules.length > 0 ? form.modules.join(', ') : 'none'],
    [
      'Cargo',
      form.cargoLots.length > 0
        ? `${form.cargoLots.length} lot${form.cargoLots.length === 1 ? '' : 's'} · ${totalLotUnits(form.cargoLots)} units`
        : 'empty',
    ],
  ]

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
      {/* kv-panel */}
      <div className="self-start">
        <div className="rounded-md border-[1.5px] border-ink bg-paper px-6 py-4 text-sm">
          {rows.map(([k, v]) => (
            <KvRow key={k} label={k} value={v} />
          ))}
          {submitError && (
            <p role="alert" className="mt-3 text-sm text-rust">
              {submitError}
            </p>
          )}
        </div>
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
            key={`${(entity as { id?: string }).id ?? 'entity'}-${i}`}
            data={entity}
            compact
            status={isEdit ? undefined : 'intact'}
            hide={{ actions: true, choices: true }}
          />
        ))}
        {chosenSystems.length === 0 && chosenModules.length === 0 && (
          <p className="text-sm text-wk-muted">No systems or modules installed.</p>
        )}
      </div>
    </div>
  )
}
