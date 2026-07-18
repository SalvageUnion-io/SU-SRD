import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefClass, SURefEntity } from 'salvageunion-reference'
import { isLegalCreationEquipment, legalCreationAbilities } from 'salvageunion-reference/rules'
import { ReferenceEntityDisplay } from '../../../components/referenceEntity/card/referenceEntityDisplayShim'
import { cn } from '../../../utils/cn'
import { Caption } from '../../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Wizard/Pilot Review Step' }

/** Mirror of ITUN's PilotWizardFormState (app-only; cannot import from apps). */
type PilotWizardFormState = {
  name: string
  classId: string
  abilities: string[]
  equipment: string[]
  callsign: string
  motto: string
  keepsake: string
  appearance: string
  background: string
  description: string
}

type Named = { id: string; name: string }

// Mirror of ReviewStep's `_sur` accessor shape (unknown-returning, like the
// source's injectable deps) so the type-guard narrowing reproduces faithfully.
type SURFindAll = { findAll: (fn: (x: unknown) => boolean) => unknown[] }
type SURFind = { find: (fn: (x: unknown) => boolean) => unknown }

/** LAYOUT.reviewLabelRail from ITUN's lib/layout (inlined literal: 'w-[120px]'). */
const REVIEW_LABEL_RAIL = 'w-[120px]'

/**
 * Verbatim reproduction of ReviewStep.KvRow
 * (apps/in-the-union-now/src/components/pilot/ReviewStep.tsx lines 22-38).
 */
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
      <span className={value ? 'font-body text-sm text-ink' : 'text-rust'}>
        {value ?? 'required'}
      </span>
    </div>
  )
}

/**
 * Verbatim reproduction of the presentational shell of
 * apps/in-the-union-now/src/components/pilot/ReviewStep.tsx (lines 45-123):
 * kv-panel of the build's fields on the left, chosen ability + equipment cards
 * (equipment carries an 'Intact' status badge) stacked on the right.
 */
function ReviewStep({
  form,
  trainingPoints,
  submitError,
}: {
  form: PilotWizardFormState
  trainingPoints?: number
  submitError: string | null
}) {
  const surClasses = SalvageUnionReference.Classes as unknown as SURFind
  const surAbilities = SalvageUnionReference.Abilities as unknown as SURFindAll
  const surEquipment = SalvageUnionReference.Equipment as unknown as SURFindAll

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
      <div className="self-start rounded-[3px] border-chrome border-ink bg-paper p-4 text-sm">
        {rows.map(([k, v]) => (
          <KvRow key={k} label={k} value={v} />
        ))}
        {submitError && (
          <p role="alert" className="mt-3 text-sm text-rust">
            {submitError}
          </p>
        )}
      </div>

      {/* chosen cards */}
      <div className="space-y-3">
        {chosenAbilities.map((ability) => (
          <ReferenceEntityDisplay
            key={ability.id}
            data={ability as unknown as SURefEntity}
            compact
            hide={{ actions: true, choices: true }}
          />
        ))}
        {chosenEquipment.map((item, i) => (
          <ReferenceEntityDisplay
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

/** Builds a real, completed pilot form from reference data. */
function buildFilledForm(): PilotWizardFormState {
  const baseClass = SalvageUnionReference.Classes.all().find(
    (c) =>
      Array.isArray((c as { coreTrees?: unknown }).coreTrees) &&
      ((c as { coreTrees: string[] }).coreTrees?.length ?? 0) > 0
  ) as (SURefClass & { coreTrees: string[] }) | undefined
  const allAbilities = SalvageUnionReference.Abilities.findAll(() => true) as Named[]
  const ability = legalCreationAbilities(
    allAbilities as unknown as { tree: string; level: number | 'L' | 'G' }[],
    baseClass?.coreTrees
  )[0] as unknown as Named | undefined
  const equipment = SalvageUnionReference.Equipment.findAll((e: unknown) =>
    isLegalCreationEquipment(e as { techLevel: number })
  )[0] as Named | undefined

  return {
    name: 'Vesper Kade',
    classId: baseClass?.id ?? '',
    abilities: ability ? [ability.id] : [],
    // Two copies of the same Tech-1 item — a legal creation pick, exercises the
    // duplicate-key path and the Intact status badge.
    equipment: equipment ? [equipment.id, equipment.id] : [],
    callsign: 'Ratchet',
    motto: 'Salvage first, ask never.',
    keepsake: 'A cracked reactor coil.',
    appearance: 'Wiry, soot-streaked, welding goggles pushed up.',
    background: 'Grew up in the scrap fields of the Union crawler routes.',
    description: '',
  }
}

export const Default: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>
      Legacy · Pilot Review step (ReviewStep.tsx lines 45-123) — kv-panel + chosen ability /
      equipment cards (equipment stamped Intact)
    </Caption>
    <ReviewStep form={buildFilledForm()} submitError={null} />
  </div>
)

export const EditModeWithError: Story = () => {
  const form = { ...buildFilledForm(), name: '', callsign: '' }
  return (
    <div className="flex flex-col gap-4">
      <Caption>
        Legacy · Review step, edit mode — Training Pts row + missing required fields (red
        'required') + submit error
      </Caption>
      <ReviewStep form={form} trainingPoints={3} submitError="Name and Callsign are required." />
    </div>
  )
}
