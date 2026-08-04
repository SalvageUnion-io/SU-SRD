import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Callout } from './Callout'

/**
 * Containers/Callout — an accent-framed note (stamp header + accent-bar body).
 * The one shape behind list-item content blocks, "When Damaged" effects, and
 * similar accented notes. Real SRD content throughout.
 */
export default {
  title: 'Containers/Callout',
}

function listItems(actionName: string): { label?: string; value?: unknown }[] {
  const action = SalvageUnionReference.Actions.all().find((a) => a.name === actionName)
  return (action?.content ?? []).filter((b) => b?.type === 'list-item')
}

const settlements = listItems('Mech Acquisition') // unlabelled tech-level examples
const labelled = SalvageUnionReference.Actions.all()
  .flatMap((a) => a.content ?? [])
  .find((b) => b?.type === 'list-item' && !!b.label)

const Body = ({ children }: { children: string }) => (
  <span className="block font-body text-sm text-ink">{children}</span>
)

/** Every anatomy: body-only, labelled + tinted, damaged, compact. */
export const Default: Story = () => (
  <div className="flex max-w-xl flex-col gap-6">
    <div className="flex flex-col gap-1.5">
      <p className="font-body text-xs text-wk-muted">Body-only bullets (mech tone)</p>
      {settlements.map((b, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static SRD list, order-stable
        <Callout key={i} tone="mech">
          <Body>{String(b.value ?? '')}</Body>
        </Callout>
      ))}
    </div>

    {labelled && (
      <div className="flex flex-col gap-1.5">
        <p className="font-body text-xs text-wk-muted">Labelled (crawler tone + derived tint)</p>
        <Callout label={String(labelled.label)} tone="crawler">
          <Body>{String(labelled.value ?? '')}</Body>
        </Callout>
      </div>
    )}

    <div className="flex flex-col gap-1.5">
      <p className="font-body text-xs text-wk-muted">When Damaged (bad tone)</p>
      <Callout label="When Damaged" tone="bad">
        <Body>The Med Bay cannot heal Pilots until it is repaired to Intact Condition.</Body>
      </Callout>
    </div>

    <div className="flex flex-col gap-1.5">
      <p className="font-body text-xs text-wk-muted">Neutral ink (default tone)</p>
      <Callout label="Reminder">
        <Body>Apply it on each Pilot&rsquo;s sheet yourself.</Body>
      </Callout>
    </div>

    <div className="flex flex-col gap-1.5">
      <p className="font-body text-xs text-wk-muted">Compact</p>
      <Callout size="compact" tone="mech">
        <Body>
          {String(settlements[0]?.value ?? 'Corporate Arcos typically have a Tech Level of 5-6.')}
        </Body>
      </Callout>
    </div>
  </div>
)
