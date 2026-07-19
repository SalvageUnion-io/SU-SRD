import type { Story } from '@ladle/react'
import { CardSkeleton } from './CardSkeleton'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Containers/Card Skeleton',
}

/** The card loading placeholder — full, compact, and a stacked list. */
export const Default: Story = () => (
  <div className="flex flex-col gap-6 bg-paper p-5 text-ink">
    <p className="max-w-2xl font-body text-xs leading-relaxed text-ink-2">
      The reference-entity card skeleton, shown at full and compact density and as a loading list.
    </p>
    <div className="flex flex-wrap items-start gap-6">
      <div className="flex w-[380px] flex-col gap-1.5">
        <CardSkeleton />
        <code className="font-body text-nano text-ink-2">default</code>
      </div>
      <div className="flex w-[300px] flex-col gap-1.5">
        <CardSkeleton compact />
        <code className="font-body text-nano text-ink-2">compact</code>
      </div>
      <div className="flex w-[380px] flex-col gap-1.5">
        <div className="flex flex-col gap-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <code className="font-body text-nano text-ink-2">list</code>
      </div>
    </div>
  </div>
)
