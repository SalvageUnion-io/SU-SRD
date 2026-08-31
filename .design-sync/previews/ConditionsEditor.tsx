/*
 * Ported from the ConditionsEditor cluster in
 * packages/component-lib/src/components/sheet/SheetPresentation.stories.tsx.
 * The `Conditions` / `ConditionChip` story covers the primitives underneath;
 * this is the sheet-level editor that wraps them.
 */
import { ConditionsEditor } from 'component-lib'
import { Group } from '../preview-lib/harness'

/**
 * The pilot/mech condition list. Chips carry a × to clear one, and an Add
 * affordance sits at the end of the row.
 */
export function Editable() {
  return (
    <div className="sheet--mech flex flex-col gap-6 bg-paper p-4">
      <Group caption="one condition applied">
        <ConditionsEditor conditions={['Impaired']} onChange={() => {}} />
      </Group>
      <Group caption="several">
        <ConditionsEditor conditions={['Prone', 'Blind', 'Irradiated']} onChange={() => {}} />
      </Group>
      <Group caption="none yet — just the Add affordance">
        <ConditionsEditor conditions={[]} onChange={() => {}} />
      </Group>
    </div>
  )
}

/** `readOnly` — a locked section or a shared snapshot: no × and no Add. */
export function ReadOnly() {
  return (
    <div className="sheet--mech flex flex-col gap-6 bg-paper p-4">
      <Group caption="read-only">
        <ConditionsEditor conditions={['Shutdown', 'Prone']} onChange={() => {}} readOnly />
      </Group>
    </div>
  )
}
