import { FieldError, KvRow, Panel, ReferenceEntityCard, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import { resolveModuleRef, resolveSystemRef } from 'salvageunion-reference/rules'
import type { MechWizardFormState } from '../../lib/wizard/mechFormState'
import '../../styles/wizard.css'
import { textSmStyle } from '../wizard/wizardStyles.model'
import { SavePatternButton } from './Pattern/SavePatternButton'

/** Columns are `.wiz-review-grid` (they change at lg). */
const LAYOUT = { display: 'grid', gap: tokens.space[24] } satisfies CSSProperties

const KV_COLUMN = { alignSelf: 'flex-start' } satisfies CSSProperties

const SAVE_ROW = { marginTop: tokens.space[12] } satisfies CSSProperties

const EMPTY_NOTE = { ...textSmStyle, color: 'currentcolor' } satisfies CSSProperties

type MechReviewStepProps = {
  form: MechWizardFormState
  submitError: string | null
  /**
   * Unspent Tech 1 Scrap — rendered as the banking callout
   * "N Tech 1 Scrap banks to your Union Crawler". TEXT ONLY, deliberately:
   * no cross-entity write (ADR-007 automation boundary) — the crawler's
   * Scrap Pool field is the manual landing spot.
   */
  bankedScrap: number
}

/**
 * Review step (undrawn for mechs; reuses the pilot
 * pattern): kv-panel of the build's fields on the left (with Save-as-pattern
 * below it), the chosen system + module cards stacked on the right (fresh
 * installs carry an 'Intact' status badge).
 */
export function MechReviewStep({ form, submitError, bankedScrap }: MechReviewStepProps) {
  const chosenSystems = form.systems.flatMap((ref) => {
    const found = resolveSystemRef(ref)
    return found ? [found] : []
  })
  const chosenModules = form.modules.flatMap((ref) => {
    const found = resolveModuleRef(ref)
    return found ? [found] : []
  })

  const rows: [string, string | null][] = [
    ['Name', form.name.trim() || null],
    ['Chassis', form.chassisName || null],
    ['Pattern', form.patternName.trim() || 'none'],
    ['Systems', form.systems.length > 0 ? form.systems.join(', ') : 'none'],
    ['Modules', form.modules.length > 0 ? form.modules.join(', ') : 'none'],
  ]

  return (
    <div className="wiz-review-grid" style={LAYOUT}>
      {/* kv-panel */}
      <div style={KV_COLUMN}>
        <Panel className="wiz-mech-review-kv">
          {rows.map(([k, v]) => (
            <KvRow key={k} label={k} value={v} />
          ))}
          {submitError && <FieldError className="wiz-review-error">{submitError}</FieldError>}
        </Panel>
        <Panel data-testid="banking-callout" className="wiz-mech-banking">
          {bankedScrap} Tech 1 Scrap banks to your Union Crawler — note it in the Crawler&rsquo;s
          Scrap Pool.
        </Panel>
        {form.chassisName && (
          <div style={SAVE_ROW}>
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
      <div className="wiz-stack wiz-stack--12">
        {[...chosenSystems, ...chosenModules].map((entity, i) => (
          <ReferenceEntityCard
            // biome-ignore lint/suspicious/noArrayIndexKey: the same system/module may be chosen more than once, so the id alone is not unique; the list only appends/removes at stable positions during review
            key={`${(entity as { id?: string }).id ?? 'entity'}-${i}`}
            data={entity}
            size="medium"
            status="intact"
            hide={{ actions: true, choices: true }}
          />
        ))}
        {chosenSystems.length === 0 && chosenModules.length === 0 && (
          <p style={EMPTY_NOTE}>No systems or modules installed.</p>
        )}
      </div>
    </div>
  )
}
