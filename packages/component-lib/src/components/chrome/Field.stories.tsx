import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { Field, Input, Select, Textarea } from './Field'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Field',
}

/** Base pilot classes (those with core trees), driven from real SRD data. */
function baseClasses(): string[] {
  return SalvageUnionReference.Classes.all()
    .filter(
      (c) =>
        Array.isArray((c as { coreTrees?: unknown[] }).coreTrees) &&
        (c as { coreTrees: unknown[] }).coreTrees.length > 0
    )
    .map((c) => c.name)
}

// Real SRD content for the standalone Input row.
const chassisName = SalvageUnionReference.Chassis.all()[0]?.name ?? 'Chassis'
const systemName = SalvageUnionReference.Systems.all()[0]?.name ?? 'System'
const crawlerName = SalvageUnionReference.Crawlers.all()[0]?.name ?? 'Crawler'

/** Field wrapping each control — Input, Textarea, Select — all one skin. */
export const Default: Story = () => (
  <div className="flex max-w-md flex-col gap-8 bg-paper p-8">
    <div className="flex flex-col gap-2">
      <Caption>Field + Input — stamp label straddling the input's top border.</Caption>
      <Field label="Callsign" htmlFor="callsign" required>
        <Input id="callsign" placeholder="Ace" />
      </Field>
    </div>

    <div className="flex flex-col gap-2">
      <Caption>Field + Textarea — the multiline Input sibling (vertical resize).</Caption>
      <Field label="Motto" htmlFor="motto">
        <Textarea id="motto" placeholder="A line that fits on a dog tag." />
      </Field>
    </div>

    <div className="flex flex-col gap-2">
      <Caption>Field + Select — native select in the Input skin (real pilot classes).</Caption>
      <Field label="Class" htmlFor="class">
        <Select id="class" defaultValue="">
          <option value="" disabled>
            Choose a class…
          </option>
          {baseClasses().map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </Field>
    </div>

    <div className="flex flex-col gap-2">
      <Caption>Select — compact call-site (px-2 py-1.5 via className).</Caption>
      <Select aria-label="Tech level" className="min-h-0 px-2 py-1.5" defaultValue="1">
        <option value="1">Tech Level 1</option>
        <option value="2">Tech Level 2</option>
        <option value="3">Tech Level 3</option>
      </Select>
    </div>

    <div className="flex flex-col gap-2">
      <Caption>Input — standalone variants (empty · filled · disabled).</Caption>
      <div className="flex flex-col gap-3">
        <Input placeholder={`e.g. ${systemName}`} />
        <Input defaultValue={chassisName} />
        <Input disabled defaultValue={crawlerName} />
      </div>
    </div>
  </div>
)
