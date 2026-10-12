import type { CSSProperties } from 'react'
import { useState } from 'react'
import { color, font, fontSize, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { InlineEditField } from './InlineEditField'

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

const PAGE = {
  backgroundColor: color.paper,
  color: color.ink,
  display: 'flex',
  flexDirection: 'column',
  gap: space[32],
  maxWidth: '28rem',
  padding: space[32],
} satisfies CSSProperties

const CELL = { display: 'flex', flexDirection: 'column', gap: space[8] } satisfies CSSProperties

const CELL_CAPTION = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.note,
} satisfies CSSProperties

function Cell({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <div style={CELL}>
      <span style={CELL_CAPTION}>{caption}</span>
      {children}
    </div>
  )
}

/**
 * Every mode on one page. Click a value to edit; Enter or blur commits, Esc
 * cancels. Real Salvage Union stats stand in for the values.
 */
export const Default: Story = () => (
  <div style={PAGE}>
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

    <Cell caption="bordered — the ink value-box shape Field wraps its stamp around">
      <Live initial="Ace" bordered ariaLabel="Callsign" />
    </Cell>

    <Cell caption="readOnly — plain text, no affordance (Mule chassis SP12)">
      <Live initial="Mule" readOnly ariaLabel="Chassis" />
    </Cell>
  </div>
)
