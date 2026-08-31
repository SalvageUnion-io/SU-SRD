/*
 * Ported from packages/component-lib/src/components/chrome/Callout.stories.tsx.
 * SRD reads moved into the render body (see Badge.tsx for why).
 */
import { Callout } from 'component-lib'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Group, Stack } from '../preview-lib/harness'

function Body({ children }: { children: ReactNode }) {
  return <span className="block font-body text-sm text-ink">{children}</span>
}

function useListItems(actionName: string) {
  const action = SalvageUnionReference.Actions.all().find((a) => a.name === actionName)
  return ((action?.content ?? []) as { type?: string; label?: string; value?: unknown }[]).filter(
    (b) => b?.type === 'list-item',
  )
}

/**
 * An accent-framed note — stamp header plus accent-bar body. The one shape
 * behind list-item content blocks, "When Damaged" effects, and similar
 * accented notes.
 */
export function Tones() {
  const settlements = useListItems('Mech Acquisition')
  const labelled = (
    SalvageUnionReference.Actions.all().flatMap((a) => a.content ?? []) as {
      type?: string
      label?: string
      value?: unknown
    }[]
  ).find((b) => b?.type === 'list-item' && !!b.label)

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <Group caption="body-only bullets (mech tone)">
        <div className="flex flex-col gap-1.5">
          {settlements.slice(0, 3).map((b) => (
            <Callout key={String(b.value)} tone="mech">
              <Body>{String(b.value ?? '')}</Body>
            </Callout>
          ))}
        </div>
      </Group>

      {labelled && (
        <Group caption="labelled (crawler tone + derived tint)">
          <Callout label={String(labelled.label)} tone="crawler">
            <Body>{String(labelled.value ?? '')}</Body>
          </Callout>
        </Group>
      )}

      <Group caption="when damaged (bad tone)">
        <Callout label="When Damaged" tone="bad">
          <Body>The Med Bay cannot heal Pilots until it is repaired to Intact Condition.</Body>
        </Callout>
      </Group>

      <Group caption="neutral ink (default tone)">
        <Callout label="Reminder">
          <Body>Apply it on each Pilot&rsquo;s sheet yourself.</Body>
        </Callout>
      </Group>
    </div>
  )
}

/** `size="compact"` — the tighter rung, for dense list content. */
export function Compact() {
  const settlements = useListItems('Mech Acquisition')
  return (
    <div className="flex max-w-xl flex-col gap-1.5">
      {settlements.slice(0, 4).map((b) => (
        <Callout key={String(b.value)} size="compact" tone="mech">
          <Body>{String(b.value ?? '')}</Body>
        </Callout>
      ))}
    </div>
  )
}
