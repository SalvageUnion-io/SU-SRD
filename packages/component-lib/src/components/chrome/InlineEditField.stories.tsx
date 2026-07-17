import type { Story } from '@ladle/react'
import { useState } from 'react'
import { InlineEditField } from './InlineEditField'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Inline Edit Field',
}

/** Controlled harness — commits persist so you can watch the value change. */
function Live({
  initial,
  ...props
}: { initial: string | number } & Omit<
  React.ComponentProps<typeof InlineEditField>,
  'value' | 'onSave'
>) {
  const [value, setValue] = useState<string | number>(initial)
  return <InlineEditField value={value} onSave={setValue} {...props} />
}

function Cell({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-body text-note text-wk-muted">{caption}</span>
      {children}
    </div>
  )
}

/**
 * Every mode on one page. Click a value to edit; Enter or blur commits, Esc
 * cancels. Real Salvage Union stats stand in for the values.
 */
export const Default: Story = () => (
  <div className="flex max-w-md flex-col gap-8 bg-paper p-8 text-ink">
    <Cell caption="read — click .50 Cal's damage to edit (text)">
      <Live initial=".50 Cal Machine Gun" ariaLabel="Weapon name" />
    </Cell>

    <Cell caption="edit — Ace's HP, number 0–16">
      <Live initial={16} type="number" min={0} max={16} ariaLabel="Pilot HP" />
    </Cell>

    <Cell caption="number-invalid — type 12 and blur (max 10 → red + role=alert)">
      <Live initial={6} type="number" min={0} max={10} ariaLabel="Mule Heat" />
    </Cell>

    <Cell caption="textarea — 3-row multiline with placeholder">
      <Live initial="" multiline placeholder="Add a motto" ariaLabel="Pilot motto" />
    </Cell>

    <Cell caption="labeled — IdentityField look (CALLSIGN / Ace + pen)">
      <Live initial="Ace" label="Callsign" />
    </Cell>

    <Cell caption="readOnly — plain text, no affordance (Mule chassis SP12)">
      <Live initial="Mule" label="Chassis" readOnly />
    </Cell>
  </div>
)
