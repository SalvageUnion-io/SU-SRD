/* Ported from packages/component-lib/src/components/base/Text.stories.tsx. */
import { Text } from 'component-lib'
import { Group, Stack } from '../preview-lib/harness'

/**
 * `Text` is the PROSE primitive — every variant on one page. A square ink
 * label plate is `Badge shape="stamp"`, never Text.
 */
export function Variants() {
  return (
    <Stack gap="1.5rem">
      <Group caption='variant="default" — Fira Code body face'>
        <Text>
          Roll on the Core Mechanic Table with a d20; a 20 is a Nailed It, a 1 is a Cascade
          Failure.
        </Text>
      </Group>
      <Group caption='variant="body" — reference prose / labelled values'>
        <Text variant="body">
          The Iron Mongrel is a Tech Level 1 chassis with 10 Structure Points and 3 System Slots.
          It vents 1 Heat at the start of each turn.
        </Text>
      </Group>
      <Group caption='variant="hint" — centered italic rules tip'>
        <Text variant="hint">
          A Mech at 0 Structure Points is Destroyed — the Pilot must Bail Out or be caught in the
          wreck.
        </Text>
      </Group>
      <Group caption='variant="flavor" — muted italic flavour text'>
        <Text variant="flavor">
          Out past the Crawler&rsquo;s floodlights, the scrap fields stretch to the horizon —
          everything the old world left to rust.
        </Text>
      </Group>
    </Stack>
  )
}

/** Body prose at length — the reading setting the reference pages use. */
export function Prose() {
  return (
    <Stack>
      <Text variant="body">
        When a Mech takes damage, reduce its Structure Points. Damage in excess of the Mech&rsquo;s
        remaining Structure Points is not carried over to the Pilot; instead the Mech is Destroyed
        and the Pilot is left exposed in the wreck.
      </Text>
      <Text variant="hint">Structure is the mech&rsquo;s life; Health is the pilot&rsquo;s.</Text>
    </Stack>
  )
}
