/* Ported from packages/component-lib/src/components/chrome/SectionHeader.stories.tsx. */
import { SectionHeader } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Group, Stack } from '../preview-lib/harness'

/** The centered "rule / LABEL / rule" catalog band that divides a long list. */
export function Categories() {
  const chassis = SalvageUnionReference.Chassis.all()[0]
  return (
    <Stack gap="1.5rem">
      <Group caption="catalog category">
        <SectionHeader label="Mech Chassis" />
      </Group>
      <Group caption="another category">
        <SectionHeader label="Systems & Modules" />
      </Group>
      <Group caption="driven by real data">
        <SectionHeader label={chassis?.name ?? 'Chassis'} />
      </Group>
    </Stack>
  )
}
