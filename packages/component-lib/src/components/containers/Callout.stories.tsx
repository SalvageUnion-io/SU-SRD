import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, font, fontSize, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
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
  const action = SalvageUnionReference.Actions.getByName(actionName)
  return (action?.content ?? []).filter((b) => b?.type === 'list-item')
}

const settlements = listItems('Mech Acquisition') // unlabelled tech-level examples
const labelled = SalvageUnionReference.Actions.all()
  .flatMap((a) => a.content ?? [])
  .find((b) => b?.type === 'list-item' && !!b.label)

const BODY = {
  display: 'block',
  fontFamily: font.body,
  fontSize: fontSize.sm,
  lineHeight: '20px',
  color: color.ink,
} satisfies CSSProperties

const GROUP = { display: 'flex', flexDirection: 'column', gap: space[6] } satisfies CSSProperties

const NOTE = {
  fontFamily: font.body,
  fontSize: fontSize.xs,
  lineHeight: '16px',
  color: color.wkMuted,
} satisfies CSSProperties

const Body = ({ children }: { children: string }) => <span style={BODY}>{children}</span>

/** Every anatomy: body-only, labelled + tinted, damaged, compact. */
export const Default: Story = () => (
  <div style={{ display: 'flex', maxWidth: '36rem', flexDirection: 'column', gap: space[24] }}>
    <div style={GROUP}>
      <p style={NOTE}>Body-only bullets (mech tone)</p>
      {settlements.map((b, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static SRD list, order-stable
        <Callout key={i} tone="mech">
          <Body>{String(b.value ?? '')}</Body>
        </Callout>
      ))}
    </div>

    {labelled && (
      <div style={GROUP}>
        <p style={NOTE}>Labelled (crawler tone + derived tint)</p>
        <Callout label={String(labelled.label)} tone="crawler">
          <Body>{String(labelled.value ?? '')}</Body>
        </Callout>
      </div>
    )}

    <div style={GROUP}>
      <p style={NOTE}>When Damaged (bad tone)</p>
      <Callout label="When Damaged" tone="bad">
        <Body>The Med Bay cannot heal Pilots until it is repaired to Intact Condition.</Body>
      </Callout>
    </div>

    <div style={GROUP}>
      <p style={NOTE}>Neutral ink (default tone)</p>
      <Callout label="Reminder">
        <Body>Apply it on each Pilot&rsquo;s sheet yourself.</Body>
      </Callout>
    </div>
  </div>
)
