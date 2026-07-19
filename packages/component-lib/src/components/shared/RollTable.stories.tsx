import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { RollTable } from './RollTable'
import { SalvageUnionReference } from 'salvageunion-reference'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Catalog/Roll Table',
}

// A real SRD roll table drives the gallery.
const rollTableEntity = SalvageUnionReference.RollTables.all()[0]
const table = rollTableEntity && 'table' in rollTableEntity ? rollTableEntity.table : undefined
const tableName = rollTableEntity?.name ?? 'Attack Roll'

function Row({
  label,
  width = 'w-[600px]',
  children,
}: {
  label: string
  width?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={width}>{children}</div>
      <code className="font-body text-nano text-ink-2">{label}</code>
    </div>
  )
}

/** The banded d20 table — bare, with the roll command, compact, and disabled. */
export const Default: Story = () =>
  table ? (
    <div className="flex flex-col gap-6 bg-paper p-5 text-ink">
      <p className="max-w-2xl font-body text-xs leading-relaxed text-ink-2">
        The banded d20 roll table. showCommand adds the rust Roll control + command name; compact
        tightens for rails/tooltips; disabled suppresses the Roll action (Reference surface).
      </p>
      <Row label="bare">
        <RollTable table={table} />
      </Row>
      <Row label="showCommand">
        <RollTable table={table} showCommand tableName={tableName} />
      </Row>
      <Row label="compact" width="w-[420px]">
        <RollTable table={table} compact showCommand tableName={tableName} />
      </Row>
      <Row label="disabled (Reference)">
        <RollTable table={table} showCommand tableName={tableName} disabled />
      </Row>
    </div>
  ) : null
