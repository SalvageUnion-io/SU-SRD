import type { Story } from '@ladle/react'
import { DisplayCard } from './DisplayCard'
import type { DisplayCardTab } from './DisplayCard'
import { Text } from '../base/Text'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Primitives/DisplayCard',
}

const headerContent = (
  <Text variant="pseudoheader" as="span">
    Sample Card
  </Text>
)

const bodyContent = (
  <div className="p-3">
    <Text as="p" className="text-sm">
      Card body content goes here.
    </Text>
  </div>
)

export const Default: Story = () => (
  <div className="w-[400px]">
    <DisplayCard
      headerBg="bg-su-green"
      headerContent={headerContent}
      footMeta={[
        { label: 'TL', value: 3 },
        { label: 'SV', value: 8 },
      ]}
    >
      {bodyContent}
    </DisplayCard>
  </div>
)

export const Compact: Story = () => (
  <div className="w-[350px]">
    <DisplayCard headerBg="bg-su-green" headerContent={headerContent} compact>
      {bodyContent}
    </DisplayCard>
  </div>
)

export const Listing: Story = () => (
  <div className="w-[400px]">
    <DisplayCard headerBg="bg-su-green" headerContent={headerContent} listing>
      {bodyContent}
    </DisplayCard>
  </div>
)

export const CompactListing: Story = () => (
  <div className="w-[350px]">
    <DisplayCard headerBg="bg-su-green" headerContent={headerContent} compact listing>
      {bodyContent}
    </DisplayCard>
  </div>
)

export const Disabled: Story = () => (
  <div className="w-[400px]">
    <DisplayCard headerBg="bg-su-green" headerContent={headerContent} disabled>
      {bodyContent}
    </DisplayCard>
  </div>
)

export const StatusIntact: Story = () => (
  <div className="w-[400px] pt-3">
    <DisplayCard headerBg="bg-su-green" headerContent={headerContent} status="intact">
      {bodyContent}
    </DisplayCard>
  </div>
)

export const StatusDamaged: Story = () => (
  <div className="w-[400px] pt-3">
    <DisplayCard headerBg="bg-su-green" headerContent={headerContent} status="damaged">
      {bodyContent}
    </DisplayCard>
  </div>
)

export const StatusDestroyed: Story = () => (
  <div className="w-[400px] pt-3">
    <DisplayCard headerBg="bg-su-green" headerContent={headerContent} status="destroyed">
      {bodyContent}
    </DisplayCard>
  </div>
)

const demoTabs: DisplayCardTab[] = [
  { key: 'stats', label: 'Stats', content: <div className="p-3 text-sm">Stats tab content.</div> },
  {
    key: 'notes',
    label: 'Notes',
    content: <div className="p-3 text-sm">Notes tab content.</div>,
  },
]

/** Default (Info) tab active — the tab bar renders alongside the standard body. */
export const WithTabs: Story = () => (
  <div className="w-[420px]">
    <DisplayCard headerBg="bg-su-blue" headerContent={headerContent} tabs={demoTabs}>
      {bodyContent}
    </DisplayCard>
  </div>
)

export const WithFootActionsAndMeta: Story = () => (
  <div className="w-[420px]">
    <DisplayCard
      headerBg="bg-su-green"
      headerContent={headerContent}
      footActions={
        <button type="button" className="rounded-[2px] border border-su-black px-2 py-1 text-xs">
          Repair
        </button>
      }
      footMeta={[{ label: 'AP Cost', value: 1 }]}
    >
      {bodyContent}
    </DisplayCard>
  </div>
)

/**
 * Sticky header inside a scrollable container. The screenshot captures the
 * card at rest (scrollTop 0) — sticky positioning itself only manifests on
 * scroll, so this baseline documents the structural markup (header wrapper +
 * scrollable body) rather than the stuck-to-top visual, which needs a human
 * to verify interactively (see PR description).
 */
export const WithStickyHeader: Story = () => (
  <div className="h-[300px] w-[420px] overflow-y-auto border border-su-grey-dark/30">
    <DisplayCard headerBg="bg-su-blue" headerContent={headerContent} stickyHeader>
      <div className="flex flex-col gap-3 p-3">
        {Array.from({ length: 8 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static demo lines generated from their index
          <Text as="p" className="text-sm" key={i}>
            Scrollable body line {i + 1}.
          </Text>
        ))}
      </div>
    </DisplayCard>
  </div>
)

export const Label: Story = () => (
  <div className="w-[400px] pt-3">
    <DisplayCard
      headerBg="bg-su-green"
      headerContent={headerContent}
      label="Tech Level"
      labelBadge="2"
    >
      {bodyContent}
    </DisplayCard>
  </div>
)
