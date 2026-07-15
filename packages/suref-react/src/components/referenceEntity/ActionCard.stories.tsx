import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference, extractVisibleActions } from 'salvageunion-reference'
import type { SURefMetaAction } from 'salvageunion-reference'

import { ActionCard } from './ActionCard'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/ActionCard',
}

// A real action off the first system that has one.
let action: SURefMetaAction | undefined
for (const sys of SalvageUnionReference.Systems.all()) {
  const actions = extractVisibleActions(sys)
  if (actions && actions.length > 0) {
    action = actions[0]
    break
  }
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="w-[420px]">{children}</div>
      <code className="font-mono text-nano text-ink-2">{label}</code>
    </div>
  )
}

/** An action as a full entity-card — full, compact, header-only; colour derives from the parent. */
export const Variants: Story = () =>
  action ? (
    <div className="flex flex-col gap-6 bg-paper p-5 text-ink">
      <p className="max-w-2xl font-mono text-xs leading-relaxed text-ink-2">
        A single action rendered as a DisplayCard; its colour is the deep variant of the parent
        entity's accent. compact tightens; hideContent drops the body to header + data tags.
      </p>
      <Row label="default (rust parent)">
        <ActionCard data={action} parentHeaderBg="bg-su-rust" />
      </Row>
      <Row label="compact (green parent)">
        <ActionCard data={action} compact parentHeaderBg="bg-su-green" />
      </Row>
      <Row label="hideContent (blue parent)">
        <ActionCard data={action} hideContent parentHeaderBg="bg-su-blue" />
      </Row>
    </div>
  ) : null
