/*
 * Ported from the Radio half of
 * packages/component-lib/src/components/chrome/Checkbox.stories.tsx — Radio and
 * Checkbox share one story file and one framed-row skin, but ship as separate
 * exports, so each gets its own card.
 */
import { Radio } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Group } from '../preview-lib/harness'

/**
 * One-of-many. Every row shares a `name`, which is what makes arrow keys move
 * between them and what makes the selection exclusive.
 */
export function ChooseChassis() {
  const chassis = SalvageUnionReference.Chassis.all()
    .slice(0, 4)
    .map((c) => ({ name: c.name, tl: c.techLevel }))
  const chosen = chassis[1]?.name
  return (
    <div className="flex max-w-md flex-col gap-8 bg-paper p-8">
      <Group caption="choose one chassis — shared name, arrow keys move between">
        <div className="space-y-2">
          {chassis.map((c) => (
            <Radio
              key={c.name}
              name="chassis"
              value={c.name}
              checked={chosen === c.name}
              readOnly
              label={c.name}
              description={c.tl != null ? `TL ${c.tl}` : undefined}
            />
          ))}
        </div>
      </Group>
      <Group caption="disabled — an option that cannot be taken">
        <Radio
          name="chassis-locked"
          value="locked"
          label="Cranium Bio-Mech"
          description="Not a legal starting chassis"
          disabled
          checked={false}
          readOnly
        />
      </Group>
    </div>
  )
}
