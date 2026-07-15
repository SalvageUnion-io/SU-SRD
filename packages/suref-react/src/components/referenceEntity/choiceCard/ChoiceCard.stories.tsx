import type { Story } from '@ladle/react'
import { useState, type ReactNode } from 'react'
import { ChoiceCard, FreeTextChoiceCard, StaticChoiceCard } from './ChoiceCard'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/ChoiceCard',
}

const G = 'bg-su-green'

function Cell({
  label,
  width = 'w-[280px]',
  children,
}: {
  label: string
  width?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={`${width} pt-3`}>{children}</div>
      <code className="font-mono text-nano text-ink-2">{label}</code>
    </div>
  )
}

function InteractiveCard() {
  const [chosen, setChosen] = useState(false)
  return (
    <ChoiceCard
      label="High Calibre Rounds"
      description="+1 SP damage."
      chosen={chosen}
      onToggle={() => setChosen((c) => !c)}
      parentHeaderBg={G}
    />
  )
}

/** The toggle choice card — not-chosen / chosen / disabled / compact / interactive. */
export const Toggle: Story = () => (
  <div className="flex flex-wrap items-start gap-6 bg-paper p-5 text-ink">
    <Cell label="not chosen">
      <ChoiceCard
        label="Ballistic"
        description="Deals kinetic damage."
        chosen={false}
        onToggle={() => {}}
        parentHeaderBg={G}
      />
    </Cell>
    <Cell label="chosen">
      <ChoiceCard
        label="Energy"
        description="Deals energy damage."
        chosen
        onToggle={() => {}}
        parentHeaderBg={G}
      />
    </Cell>
    <Cell label="disabled">
      <ChoiceCard
        label="Rangefinder"
        description="Increases Range to Far."
        chosen={false}
        disabled
        parentHeaderBg={G}
      />
    </Cell>
    <Cell label="compact" width="w-[220px]">
      <ChoiceCard
        label="Laser Guidance"
        description="Spend 2 AP to hit."
        chosen
        compact
        onToggle={() => {}}
        parentHeaderBg={G}
      />
    </Cell>
    <Cell label="interactive (click)">
      <InteractiveCard />
    </Cell>
  </div>
)

/** The free-text choice card — editable, filled (multiline), read-only. */
export const FreeText: Story = () => (
  <div className="flex flex-wrap items-start gap-6 bg-paper p-5 text-ink">
    <Cell label="editable" width="w-[320px]">
      <FreeTextChoiceCard
        label="Name"
        description="The name of your companion."
        value=""
        onValueChange={() => {}}
        parentHeaderBg={G}
      />
    </Cell>
    <Cell label="with value (multiline)" width="w-[320px]">
      <FreeTextChoiceCard
        label="Appearance"
        value="A rusted quadruped drone with a single glowing optic."
        onValueChange={() => {}}
        multiline
        parentHeaderBg={G}
      />
    </Cell>
    <Cell label="read-only" width="w-[320px]">
      <FreeTextChoiceCard
        label="A.I. Personality"
        value="Cheerfully paranoid."
        onValueChange={() => {}}
        readOnly
        parentHeaderBg={G}
      />
    </Cell>
  </div>
)

/** The static (display-only) choice card — labelled, and an unlabelled bullet. */
export const Static: Story = () => (
  <div className="flex flex-wrap items-start gap-6 bg-paper p-5 text-ink">
    <Cell label="labelled" width="w-[320px]">
      <StaticChoiceCard
        label="Scavenger's Luck"
        description="Once per session, reroll a failed Salvage check."
        parentHeaderBg={G}
      />
    </Cell>
    <Cell label="unlabelled bullet" width="w-[320px]">
      <StaticChoiceCard
        description="Scour the wastelands for a working power cell."
        parentHeaderBg={G}
      />
    </Cell>
  </div>
)
