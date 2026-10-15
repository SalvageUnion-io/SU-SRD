import type { CSSProperties } from 'react'
import { resolveChassisRef, resolveModuleRef, resolveSystemRef } from 'salvageunion-reference/rules'
import { FieldError, Panel, ReferenceEntityCard, tokens } from '../../../ui/index'
import type { MechWizardFormState } from '../../lib/wizard/mechFormState'
import '../../styles/wizard.css'
import { readReference } from '../../lib/readReference'
import { Recap, RecapEntity, RecapStat, RecapTokens } from '../wizard/ReviewRecap'
import { textSmStyle } from '../wizard/wizardStyles.model'
import { SavePatternButton } from './Pattern/SavePatternButton'

/** Columns are `.su-wiz-review-grid` (they change at lg). */
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
 * pattern): a recap of the build's fields on the left (with Save-as-pattern
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

  const chassis = form.chassisName
    ? (readReference('MechReviewStep.chassis', () => resolveChassisRef(form.chassisName), null) ??
      undefined)
    : undefined

  return (
    <div className="su-wiz-review-grid" style={LAYOUT}>
      <div style={KV_COLUMN}>
        <Panel className="su-wiz-mech-review-kv">
          {/* The recap: Stats, the chassis as its chip, the parts as Tokens. */}
          <Recap>
            <RecapStat label="Name" value={form.name.trim()} required />
            <RecapEntity label="Chassis" entity={chassis} required />
            <RecapStat label="Pattern" value={form.patternName.trim()} />
            <RecapTokens label="Systems" entities={chosenSystems} />
            <RecapTokens label="Modules" entities={chosenModules} />
          </Recap>
          {submitError && <FieldError className="su-wiz-review-error">{submitError}</FieldError>}
        </Panel>
        <Panel data-testid="banking-callout" className="su-wiz-mech-banking">
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
      <div className="su-wiz-stack su-wiz-stack--12">
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
