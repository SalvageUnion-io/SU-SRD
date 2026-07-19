import type { Story } from '@ladle/react'
import { Caption } from '../../stories/_harness'
import { Text } from './Text'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Text',
}

/** Every Text variant on one page — default/body prose, hint + flavor asides, and the pseudoheader stamps. */
export const Default: Story = () => (
  <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-2">
      <Caption>variant="default" — Fira Code body face</Caption>
      <Text>
        Roll on the Core Mechanic Table with a d20; a 20 is a Nailed It, a 1 is a Cascade Failure.
      </Text>
    </div>

    <div className="flex flex-col gap-2">
      <Caption>variant="body" — reference prose / labelled values</Caption>
      <Text variant="body">
        The Iron Mongrel is a Tech Level 1 chassis with 10 Structure Points and 3 System Slots. It
        vents 1 Heat at the start of each turn.
      </Text>
    </div>

    <div className="flex flex-col gap-2">
      <Caption>variant="hint" — centered italic rules tip</Caption>
      <Text variant="hint">
        A Mech at 0 Structure Points is Destroyed — the Pilot must Bail Out or be caught in the
        wreck.
      </Text>
    </div>

    <div className="flex flex-col gap-2">
      <Caption>variant="flavor" — muted italic flavour text</Caption>
      <Text variant="flavor">
        Out past the Crawler's floodlights, the scrap fields stretch to the horizon — everything the
        old world left to rust.
      </Text>
    </div>

    <div className="flex flex-col gap-2">
      <Caption>variant="pseudoheader" — ink stamp (lg / sm / xs)</Caption>
      <Text variant="pseudoheader">Salvage Union</Text>
      <Text variant="pseudoheader" className="text-sm">
        Melee Weapons
      </Text>
      <Text variant="pseudoheader" className="text-xs">
        Heat &amp; Damage
      </Text>
    </div>

    <div className="flex flex-col gap-2 bg-ink p-3">
      <Caption>variant="pseudoheaderInverse" — paper stamp on ink</Caption>
      <Text variant="pseudoheaderInverse">Overheated</Text>
      <Text variant="pseudoheaderInverse" className="text-sm">
        Cascade Failure
      </Text>
    </div>
  </div>
)
