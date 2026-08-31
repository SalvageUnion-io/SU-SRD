/*
 * Ported from packages/component-lib/src/components/chrome/Field.stories.tsx.
 * `onSave` handlers are dropped — a card renders one settled frame, and the
 * dashed edit cue is visible without a live commit.
 */
import { Field, Input, Select } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Group } from '../preview-lib/harness'

function useBaseClasses(): string[] {
  return SalvageUnionReference.Classes.all()
    .filter((c) => 'coreTrees' in c && Array.isArray(c.coreTrees) && c.coreTrees.length > 0)
    .map((c) => c.name)
}

/**
 * `Field` wraps each control in one skin — a stamp label straddling the
 * control's top border.
 */
export function Controls() {
  const classes = useBaseClasses()
  return (
    <div className="flex max-w-md flex-col gap-8 bg-paper p-8">
      <Group caption="Field + Input — stamp label straddling the top border">
        <Field label="Callsign" htmlFor="callsign" required>
          <Input id="callsign" placeholder="Ace" />
        </Field>
      </Group>
      <Group caption="Field + Select — native select in the Input skin, real pilot classes">
        <Field label="Class" htmlFor="class">
          <Select id="class" defaultValue={classes[0] ?? ''}>
            {classes.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
      </Group>
    </div>
  )
}

/**
 * Edit-in-place and picker-backed. The dashed cue — not a pen — marks an
 * editable field; a read-only field carries a plain ink border. The sheet
 * identity rows render exactly this way.
 */
export function Identity() {
  const classes = useBaseClasses()
  return (
    <div className="sheet--pilot flex max-w-md flex-col gap-8 bg-paper p-8">
      <Group caption='edit-in-place — dashed cue = "write here"'>
        <Field label="Callsign" value="Ace" onSave={() => {}} />
      </Group>
      <Group caption="read-only — plain ink border, no cue (locked section / snapshot)">
        <Field label="Callsign" value="Ace" />
      </Group>
      <Group caption="picker-backed — a button box opening the shared modal">
        <Field label="Class" value={classes[0] ?? 'Salvager'} onEditClick={() => {}} />
      </Group>
      <Group caption="multiline + labelAction — the USED plate rides the opposite seam">
        <Field
          label="Motto"
          value="No retreat, no surrender"
          multiline
          onSave={() => {}}
          labelAction={
            <span className="rounded-full border-2 border-ink bg-ink px-2 py-0.5 font-cond text-[9.5px] font-bold uppercase leading-none tracking-caps-wide text-paper">
              Used
            </span>
          }
        />
      </Group>
    </div>
  )
}
