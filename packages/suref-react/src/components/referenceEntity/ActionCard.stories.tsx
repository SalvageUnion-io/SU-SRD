import type { Story } from '@ladle/react'
import { SalvageUnionReference, extractVisibleActions } from 'salvageunion-reference'
import type { SURefMetaAction } from 'salvageunion-reference'

import { ActionCard } from './ActionCard'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/ActionCard',
}

// Pull a real action off the first system that has one.
let action: SURefMetaAction | undefined
for (const sys of SalvageUnionReference.Systems.all()) {
  const actions = extractVisibleActions(sys)
  if (actions && actions.length > 0) {
    action = actions[0]
    break
  }
}

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="max-w-md p-4">{children}</div>
)

/** Full action card — colour derives from the parent entity's accent (rust here). */
export const Default: Story = () =>
  action ? (
    <Frame>
      <ActionCard data={action} parentHeaderBg="bg-su-rust" />
    </Frame>
  ) : null

/** Compact density (listing / nested). */
export const Compact: Story = () =>
  action ? (
    <Frame>
      <ActionCard data={action} compact parentHeaderBg="bg-su-green" />
    </Frame>
  ) : null

/** Header + data tags only — body suppressed. */
export const HideContent: Story = () =>
  action ? (
    <Frame>
      <ActionCard data={action} hideContent parentHeaderBg="bg-su-blue" />
    </Frame>
  ) : null
