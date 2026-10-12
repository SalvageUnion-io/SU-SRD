import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, font, fontSize, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { RollTable } from './RollTable'

export default {
  title: 'Compositions/Catalog/Roll Table',
}

// A real SRD roll table drives the gallery.
const rollTableEntity = SalvageUnionReference.RollTables.all()[0]
const table = rollTableEntity && 'table' in rollTableEntity ? rollTableEntity.table : undefined
const tableName = rollTableEntity?.name ?? 'Attack Roll'

const ROW_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[6],
} satisfies CSSProperties

const ROW_LABEL_STYLE = {
  fontFamily: font.body,
  fontSize: fontSize.badge,
  color: color.wkMuted,
} satisfies CSSProperties

const PAGE_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[24],
  backgroundColor: color.paper,
  padding: space[20],
  color: color.ink,
} satisfies CSSProperties

/** `max-w-2xl` (42rem); `leading-relaxed` wins over `text-xs`'s own line height. */
const INTRO_STYLE = {
  maxWidth: '42rem',
  fontFamily: font.body,
  fontSize: fontSize.xs,
  lineHeight: 1.625,
  color: color.wkMuted,
} satisfies CSSProperties

function Row({
  label,
  width = '600px',
  children,
}: {
  label: string
  width?: string
  children: ReactNode
}) {
  return (
    <div style={ROW_STYLE}>
      <div style={{ width }}>{children}</div>
      <code style={ROW_LABEL_STYLE}>{label}</code>
    </div>
  )
}

/** The banded d20 table — bare, with the roll command, size="compact", and disabled. */
export const Default: Story = () =>
  table ? (
    <div style={PAGE_STYLE}>
      <p style={INTRO_STYLE}>
        The banded d20 roll table. showCommand adds the rust Roll control + command name;
        size=&quot;compact&quot; tightens for rails/tooltips; disabled suppresses the Roll action
        (Reference surface); titleSelect turns the header title into the surface&apos;s table picker
        trigger.
      </p>
      <Row label="bare">
        <RollTable table={table} />
      </Row>
      <Row label="showCommand">
        <RollTable table={table} showCommand tableName={tableName} />
      </Row>
      <Row label='size="compact"' width="420px">
        <RollTable table={table} size="compact" showCommand tableName={tableName} />
      </Row>
      <Row label="disabled (Reference)">
        <RollTable table={table} showCommand tableName={tableName} disabled />
      </Row>
      <Row label="titleSelect (Dashboard Tables)">
        <TitleSelectRow />
      </Row>
    </div>
  ) : null

/**
 * `titleSelect` — the header title as the surface's table picker trigger, the
 * shape the Dashboard Tables focus uses. Toggling stands in for the caller's
 * picker opening: the caret flips and `aria-expanded` follows.
 */
function TitleSelectRow() {
  const [open, setOpen] = useState(false)
  if (!table) return null
  return (
    <RollTable
      table={table}
      showCommand
      tableName={tableName}
      titleSelect={{ onOpen: () => setOpen((v) => !v), open }}
    />
  )
}
