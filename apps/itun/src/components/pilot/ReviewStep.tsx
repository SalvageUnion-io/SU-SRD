import { FieldError, KvRow, Panel, ReferenceEntityCard } from 'component-lib'
import type { SURefAbility, SURefClass, SURefEquipment } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { PilotWizardFormState } from '../../lib/wizard/pilotFormState'

/**
 * Typed lookup surfaces for the injectable SUR seam — declared against the
 * real reference entity types so results feed entity cards without casts.
 */
type SURFindAll<T> = { findAll: (fn: (x: T) => boolean) => T[] }
type SURFind<T> = { find: (fn: (x: T) => boolean) => T | undefined }

type ReviewStepProps = {
  form: PilotWizardFormState
  /** Shown in edit mode — Training Points are advancement currency (plan 3.3). */
  trainingPoints?: number
  submitError: string | null
  /** Injectable SUR for testing. */
  _sur?: {
    Classes: SURFind<SURefClass>
    Abilities: SURFindAll<SURefAbility>
    Equipment: SURFindAll<SURefEquipment>
  }
}

/**
 * Review step (design §3.2 Review): kv-panel of the build's fields on the
 * left, the chosen ability + equipment cards stacked on the right (equipment
 * carries an 'Intact' status badge — fresh gear).
 */
export function ReviewStep({ form, trainingPoints, submitError, _sur }: ReviewStepProps) {
  const surClasses = _sur?.Classes ?? SalvageUnionReference.Classes
  const surAbilities = _sur?.Abilities ?? SalvageUnionReference.Abilities
  const surEquipment = _sur?.Equipment ?? SalvageUnionReference.Equipment

  const selectedClass = form.classId ? surClasses.find((c) => c.id === form.classId) : undefined
  const chosenAbilities = form.abilities
    .map((id) => surAbilities.findAll((a) => a.id === id)[0])
    .filter((a) => a !== undefined)
  const chosenEquipment = form.equipment
    .map((id) => surEquipment.findAll((e) => e.id === id)[0])
    .filter((e) => e !== undefined)

  const rows: [string, string | null][] = [
    ['Name', form.name.trim() || null],
    ['Callsign', form.callsign.trim() || null],
    ['Class', selectedClass?.name ?? null],
    [
      'Abilities',
      chosenAbilities.length > 0 ? chosenAbilities.map((a) => a.name).join(', ') : 'none',
    ],
    [
      'Equipment',
      chosenEquipment.length > 0 ? chosenEquipment.map((e) => e.name).join(', ') : 'none',
    ],
    ['Motto', form.motto || '—'],
    ['Keepsake', form.keepsake || '—'],
    ['Appearance', form.appearance || '—'],
    ['Background', form.background || '—'],
  ]
  if (trainingPoints !== undefined) {
    rows.push(['Training Pts', String(trainingPoints)])
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
      {/* kv-panel */}
      <Panel className="self-start p-4 text-sm">
        {rows.map(([k, v]) => (
          <KvRow key={k} label={k} value={v} />
        ))}
        {submitError && <FieldError className="mt-3">{submitError}</FieldError>}
      </Panel>

      {/* chosen cards */}
      <div className="space-y-3">
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
          <p className="text-sm text-wk-muted">No abilities or equipment chosen.</p>
        )}
      </div>
    </div>
  )
}
