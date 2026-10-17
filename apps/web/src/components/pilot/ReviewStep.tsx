import type { CSSProperties } from 'react'
import type { RefAbility, RefClass, RefEquipment } from 'salvageunion-reference'
import { nameToSlug, SalvageUnionReference } from 'salvageunion-reference'
import type { PilotWizardFormState } from '../../lib/wizard/pilotFormState'
import { EmptyState, FieldError, Panel, ReferenceEntityCard, tokens } from '../index'
import '../../styles/cantina/wizard.css'
import { Recap, RecapEntity, RecapStat, RecapTokens } from '../wizard/ReviewRecap'

/** Recap and cards; the column split is `.su-wiz-review-grid`. */
const REVIEW_GRID = { display: 'grid', gap: tokens.space[24] } satisfies CSSProperties

/**
 * Typed lookup surfaces for the injectable SUR seam — declared against the
 * real reference entity types so results feed entity cards without casts.
 */
type SURFindAll<T> = { findAll: (fn: (x: T) => boolean) => T[] }
type SURFind<T> = { find: (fn: (x: T) => boolean) => T | undefined }

type ReviewStepProps = {
  form: PilotWizardFormState
  submitError: string | null
  /** Injectable SUR for testing. */
  _sur?: {
    Classes: SURFind<RefClass>
    Abilities: SURFindAll<RefAbility>
    Equipment: SURFindAll<RefEquipment>
  }
}

/**
 * Review step: a recap of the build's fields on the
 * left, the chosen ability + equipment cards stacked on the right (equipment
 * carries an 'Intact' status badge — fresh gear).
 */
export function ReviewStep({ form, submitError, _sur }: ReviewStepProps) {
  const surClasses = _sur?.Classes ?? SalvageUnionReference.Classes
  const surAbilities = _sur?.Abilities ?? SalvageUnionReference.Abilities
  const surEquipment = _sur?.Equipment ?? SalvageUnionReference.Equipment

  const selectedClass = form.classId ? surClasses.find((c) => c.id === form.classId) : undefined
  const chosenAbilities = form.abilities
    .map((slug) => surAbilities.findAll((a) => nameToSlug(a.name) === slug)[0])
    .filter((a) => a !== undefined)
  const chosenEquipment = form.equipment
    .map((slug) => surEquipment.findAll((e) => nameToSlug(e.name) === slug)[0])
    .filter((e) => e !== undefined)

  return (
    <div className="su-wiz-review-grid" style={REVIEW_GRID}>
      {/* The recap: Stats, the class as its chip, the picks as Tokens. */}
      <Panel className="su-wiz-review-panel su-wiz-review-panel--start">
        <Recap>
          <RecapStat label="Name" value={form.name.trim()} required />
          <RecapStat label="Callsign" value={form.callsign.trim()} required />
          <RecapEntity label="Class" entity={selectedClass} required />
          <RecapStat label="Motto" value={form.motto} />
          <RecapStat label="Keepsake" value={form.keepsake} />
          <RecapStat label="Appearance" value={form.appearance} />
          <RecapStat label="Background" value={form.background} />
          <RecapTokens label="Abilities" entities={chosenAbilities} />
          <RecapTokens label="Equipment" entities={chosenEquipment} />
        </Recap>
        {submitError && <FieldError spaceAbove={12}>{submitError}</FieldError>}
      </Panel>

      {/* chosen cards */}
      <div className="su-wiz-stack su-wiz-stack--12">
        {chosenAbilities.map((ability) => (
          <ReferenceEntityCard
            key={ability.id}
            data={ability}
            size="medium"
            hide={{ actions: true, choices: true }}
          />
        ))}
        {chosenEquipment.map((item, i) => (
          <ReferenceEntityCard
            // Duplicates are legal picks (2× the same Tech 1 item), so the id
            // alone cannot key the list.
            // biome-ignore lint/suspicious/noArrayIndexKey: id alone can't disambiguate duplicate picks; id+index is the stablest available key
            key={`${item.id}-${i}`}
            data={item}
            size="medium"
            status="intact"
            hide={{ actions: true, choices: true }}
          />
        ))}
        {chosenAbilities.length === 0 && chosenEquipment.length === 0 && (
          <EmptyState variant="quiet" body="No abilities or equipment chosen." bodyInk="inherit" />
        )}
      </div>
    </div>
  )
}
