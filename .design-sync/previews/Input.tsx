/*
 * Composed from the standalone-Input cluster in
 * packages/component-lib/src/components/chrome/Field.stories.tsx. Input has no
 * story file of its own — it ships from `./Field` alongside `Select` and
 * `Textarea` and is exercised there.
 */
import { Field, Input } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Group, Stack } from '../preview-lib/harness'

/** The text box on its own: empty, filled, and disabled. */
export function States() {
  const systemName = SalvageUnionReference.Systems.all()[0]?.name ?? 'System'
  const chassisName = SalvageUnionReference.Chassis.all()[0]?.name ?? 'Chassis'
  const crawlerName = SalvageUnionReference.Crawlers.all()[0]?.name ?? 'Crawler'
  return (
    <div className="flex max-w-md flex-col gap-3 bg-paper p-8">
      <Input placeholder={`e.g. ${systemName}`} />
      <Input defaultValue={chassisName} />
      <Input disabled defaultValue={crawlerName} />
    </div>
  )
}

/** In a `Field` — the labelled form the app actually uses. */
export function Labelled() {
  return (
    <div className="flex max-w-md flex-col gap-8 bg-paper p-8">
      <Group caption="required — the stamp label straddles the input's top border">
        <Field label="Callsign" htmlFor="input-callsign" required>
          <Input id="input-callsign" placeholder="Ace" />
        </Field>
      </Group>
      <Group caption="filled">
        <Field label="Pattern name" htmlFor="input-pattern">
          <Input id="input-pattern" defaultValue="Mule — Scrapper" />
        </Field>
      </Group>
    </div>
  )
}
