/*
 * Ported from packages/component-lib/src/components/chrome/CountStepper.stories.tsx.
 * Counts are fixed rather than stateful — the boundary states are the subject,
 * and a card is a still image.
 */
import { CountStepper, ReferenceEntityCard } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../preview-lib/harness'

/**
 * The `[− n +]` duplicate-quantity control. The ± buttons carry real accessible
 * labels ("Add one …" / "Remove one …") built from `subject`.
 */
export function Bounds() {
  const subject = SalvageUnionReference.Equipment.all()[0]?.name ?? 'Item'
  return (
    <div className="flex flex-col gap-4 bg-paper p-4">
      <Caption>at floor (0), mid, and cap (3) — the bounding button disables</Caption>
      <div className="flex items-center gap-6">
        {[
          ['Floor', 0],
          ['Mid', 2],
          ['Cap', 3],
        ].map(([label, count]) => (
          <div key={label as string} className="flex flex-col items-start gap-1">
            <span className="font-cond text-label uppercase tracking-caps text-wk-muted">
              {label}
            </span>
            <CountStepper
              subject={subject}
              count={count as number}
              onChange={() => {}}
              max={3}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * The two surfaces. `instrument` absorbed the former standalone `DamageStepper`:
 * same control and accessible contract, a looser cluster with a large tabular
 * readout for the dashboard's Take-Damage overlay.
 *
 * The instrument cluster sits on a band-cream chassis, not on the dashboard's
 * dark ground: its readout is `text-ink` and its buttons are the ink-hairline
 * instrument Button, so both are invisible on `--color-ink-deep`. The dark
 * ground goes BEHIND the chassis, never under the controls.
 *
 * `items-start` is load-bearing too — the sheet pill is intrinsically sized, and
 * a stretch-aligned flex column pulls it to full width.
 */
export function Surfaces() {
  return (
    <div className="flex flex-col items-start gap-4 bg-paper p-4">
      <Caption>sheet (default) — the joined ink pill</Caption>
      <CountStepper subject="Assault Rifle" count={2} onChange={() => {}} max={5} />
      <Caption>instrument — the dashboard overlay cluster, floored at 1</Caption>
      <div className="rounded-panel bg-[var(--color-ink-deep)] p-4">
        <div className="rounded-panel bg-[var(--color-band-cream)] px-4 py-3">
          <CountStepper
            subject="damage point"
            count={3}
            onChange={() => {}}
            min={1}
            surface="instrument"
          />
        </div>
      </div>
    </div>
  )
}

/** In its real home: an entity card's controls overlay, with the selected ring. */
export function InCard() {
  const item = SalvageUnionReference.Equipment.all()[0]
  if (!item) return null
  return (
    <div className="flex max-w-md flex-col gap-3 bg-paper p-4">
      <Caption>how pickers use it — a `stepper` control on the card</Caption>
      <ReferenceEntityCard
        data={item}
        size="medium"
        selected
        hide={{ actions: true, choices: true }}
        controls={[
          { key: 'qty', stepper: { subject: item.name, count: 2, onChange: () => {}, max: 5 } },
        ]}
      />
    </div>
  )
}
