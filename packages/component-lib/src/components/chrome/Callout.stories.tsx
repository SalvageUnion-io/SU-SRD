import type { Story } from '@ladle/react'
import { SalvageUnionReference, type SURefObjectContentBlock } from 'salvageunion-reference'

import { Callout } from './Callout'

/**
 * Containers/Callout — an accent-framed note (stamp header + accent-bar body).
 * The one shape behind list-item content blocks, "When Damaged" effects, and
 * similar accented notes. Real SRD content throughout.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Containers/Callout',
}

function listItems(actionName: string): { label?: string; value?: unknown }[] {
  const action = SalvageUnionReference.Actions.all().find(
    (a) => (a as { name?: string }).name === actionName
  ) as { content?: SURefObjectContentBlock[] } | undefined
  return (action?.content ?? []).filter((b) => b?.type === 'list-item') as {
    label?: string
    value?: unknown
  }[]
}

const settlements = listItems('Mech Acquisition') // unlabelled tech-level examples
const labelled = SalvageUnionReference.Actions.all()
  .flatMap((a) => (a as { content?: SURefObjectContentBlock[] }).content ?? [])
  .find((b) => b?.type === 'list-item' && !!(b as { label?: string }).label) as
  | { label?: string; value?: unknown }
  | undefined

const MECH = 'var(--color-sheet-mech)'
const CRAWLER = 'var(--color-sheet-crawler)'
const DAMAGED = 'var(--color-status-bad)'

const Body = ({ children }: { children: string }) => (
  <span className="block font-body text-sm text-ink">{children}</span>
)

/** Every anatomy: body-only, labelled, tinted, damaged, compact. */
export const Default: Story = () => (
  <div className="flex max-w-xl flex-col gap-6">
    <div className="flex flex-col gap-1.5">
      <p className="font-mono text-xs text-wk-muted">Body-only bullets (mech accent)</p>
      {settlements.map((b, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static SRD list, order-stable
        <Callout key={i} accent={MECH}>
          <Body>{String(b.value ?? '')}</Body>
        </Callout>
      ))}
    </div>

    {labelled && (
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-xs text-wk-muted">Labelled (crawler accent + tint)</p>
        <Callout
          label={String(labelled.label)}
          accent={CRAWLER}
          headerBg="color-mix(in srgb, var(--color-sheet-crawler) 12%, var(--color-paper))"
        >
          <Body>{String(labelled.value ?? '')}</Body>
        </Callout>
      </div>
    )}

    <div className="flex flex-col gap-1.5">
      <p className="font-mono text-xs text-wk-muted">When Damaged (status-bad accent)</p>
      <Callout
        label="When Damaged"
        accent={DAMAGED}
        headerBg="color-mix(in srgb, var(--color-status-bad) 15%, var(--color-paper))"
      >
        <Body>The Med Bay cannot heal Pilots until it is repaired to Intact Condition.</Body>
      </Callout>
    </div>

    <div className="flex flex-col gap-1.5">
      <p className="font-mono text-xs text-wk-muted">Compact</p>
      <Callout compact accent={MECH}>
        <Body>
          {String(settlements[0]?.value ?? 'Corporate Arcos typically have a Tech Level of 5-6.')}
        </Body>
      </Callout>
    </div>
  </div>
)
