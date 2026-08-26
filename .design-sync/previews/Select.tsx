/*
 * Composed from the Select clusters in
 * packages/component-lib/src/components/chrome/Field.stories.tsx. Select has no
 * story file of its own — it ships from `./Field` and is exercised there.
 */
import { Field, Select } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Group } from '../preview-lib/harness'

/** A native `<select>` wearing the Input skin. */
export function Variants() {
  const classes = SalvageUnionReference.Classes.all()
    .filter((c) => 'coreTrees' in c && Array.isArray(c.coreTrees) && c.coreTrees.length > 0)
    .map((c) => c.name)
  return (
    <div className="flex max-w-md flex-col gap-8 bg-paper p-8">
      <Group caption="in a Field — real pilot classes">
        <Field label="Class" htmlFor="select-class">
          <Select id="select-class" defaultValue={classes[0] ?? ''}>
            {classes.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
      </Group>
      <Group caption="compact call-site — px-2 py-1.5 via className">
        <Select aria-label="Tech level" className="min-h-0 px-2 py-1.5" defaultValue="1">
          <option value="1">Tech Level 1</option>
          <option value="2">Tech Level 2</option>
          <option value="3">Tech Level 3</option>
        </Select>
      </Group>
      <Group caption="disabled">
        <Select aria-label="Locked" disabled defaultValue="locked">
          <option value="locked">Mediator only</option>
        </Select>
      </Group>
    </div>
  )
}
