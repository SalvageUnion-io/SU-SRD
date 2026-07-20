import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { KvRow, Panel, ReferenceEntityCard, FieldError } from 'component-lib'
import type { PilotWizardFormState } from '../../lib/wizard/pilotFormState'

type SURFindAll = { findAll: (fn: (x: unknown) => boolean) => unknown[] }
type SURFind = { find: (fn: (x: unknown) => boolean) => unknown }

type ReviewStepProps = {
  form: PilotWizardFormState
  /** Shown in edit mode — Training Points are advancement currency (plan 3.3). */
  trainingPoints?: number
  submitError: string | null
  /** Injectable SUR for testing. */
  _sur?: { Classes: SURFind; Abilities: SURFindAll; Equipment: SURFindAll }
}

type Named = { id: string; name: string }

/**
 * Review step (design §3.2 Review): kv-panel of the build's fields on the
 * left, the chosen ability + equipment cards stacked on the right (equipment
 * carries an 'Intact' status badge — fresh gear).
 */
export function ReviewStep({ form, trainingPoints, submitError, _sur }: ReviewStepProps) {
  const surClasses = _sur?.Classes ?? SalvageUnionReference.Classes
  const surAbilities = _sur?.Abilities ?? SalvageUnionReference.Abilities
  const surEquipment = _sur?.Equipment ?? SalvageUnionReference.Equipment

  const selectedClass = form.classId
    ? (surClasses.find((c) => (c as Named).id === form.classId) as Named | undefined)
    : undefined
  const chosenAbilities = form.abilities
    .map((id) => surAbilities.findAll((a) => (a as Named).id === id)[0])
    .filter((a): a is Named => a !== undefined)
  const chosenEquipment = form.equipment
    .map((id) => surEquipment.findAll((e) => (e as Named).id === id)[0])
    .filter((e): e is Named => e !== undefined)

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
            data={ability as unknown as SURefEntity}
            compact
            hide={{ actions: true, choices: true }}
          />
        ))}
        {chosenEquipment.map((item, i) => (
          <ReferenceEntityCard
            // Duplicates are legal picks (2× the same Tech 1 item), so the id
            // alone cannot key the list.
            // biome-ignore lint/suspicious/noArrayIndexKey: id alone can't disambiguate duplicate picks; id+index is the stablest available key
            key={`${item.id}-${i}`}
            data={item as unknown as SURefEntity}
            compact
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
