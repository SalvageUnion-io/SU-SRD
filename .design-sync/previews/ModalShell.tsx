/*
 * Ported from packages/component-lib/src/components/shared/ModalShell.stories.tsx.
 *
 * The story renders a trigger Button and opens the dialog on click. A card is a
 * still image, so `open` is passed as `true` here — a card showing a button the
 * viewer cannot press would document nothing. `cfg.overrides.ModalShell` sets
 * `cardMode: "single"` so the overlay renders inside the cell instead of
 * escaping it.
 */
import { ModalShell, Text } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'

function Body() {
  const chassis = SalvageUnionReference.Chassis.all()[0]
  return (
    <div className="p-4">
      <Text as="p" className="text-sm text-wk-muted">
        Structure {chassis?.structurePoints} · Cargo {chassis?.cargoCapacity} · Tech Level{' '}
        {chassis?.techLevel}
      </Text>
    </div>
  )
}

/**
 * A centered dialog on the Card shell. `tone="action"` (the default) is the
 * constructive header; Esc, the backdrop and × all close it.
 */
export function Action() {
  const name = SalvageUnionReference.Chassis.all()[0]?.name ?? 'Mule'
  return (
    <div className="min-h-[420px] bg-paper">
      <ModalShell
        open
        onOpenChange={() => {}}
        title={name}
        subtitle="Chassis"
        description={`${name} details`}
      >
        <Body />
      </ModalShell>
    </div>
  )
}

/** `tone="danger"` — adversary rust with a light close button, for destructive confirms. */
export function Danger() {
  const name = SalvageUnionReference.Chassis.all()[0]?.name ?? 'Mule'
  return (
    <div className="min-h-[420px] bg-paper">
      <ModalShell
        open
        onOpenChange={() => {}}
        title={name}
        subtitle="Chassis"
        tone="danger"
        description={`Delete ${name}`}
      >
        <Body />
      </ModalShell>
    </div>
  )
}
