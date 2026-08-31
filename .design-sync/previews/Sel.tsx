/*
 * Ported from packages/component-lib/src/components/chrome/Sel.stories.tsx.
 *
 * Two changes from the story. The `useState` toggles become settled
 * selected/unselected pairs — the ring is the subject and a card is a still
 * image. And the cards render at `extent="head"` rather than the story's full
 * medium card: a full Mule card is taller than a preview cell, so the selected
 * and unselected states could not be seen together, which is the entire
 * comparison this component exists for.
 */
import { ReferenceEntityCard, Sel } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Group, Stack } from '../preview-lib/harness'

/**
 * The selection-ring wrapper for wizard entity cards — a 3px rust box-shadow
 * ring that does not shift layout, so a selected card never nudges its
 * neighbours.
 */
export function Ring() {
  const chassis = SalvageUnionReference.Chassis.all()[0]
  if (!chassis) return null
  return (
    <div className="flex max-w-md flex-col gap-6">
      <Group caption="unselected — no ring, same box">
        <Sel selected={false}>
          <ReferenceEntityCard data={chassis} size="medium" extent="head" />
        </Sel>
      </Group>
      <Group caption="selected — the rust ring, layout unchanged">
        <Sel selected>
          <ReferenceEntityCard data={chassis} size="medium" extent="head" />
        </Sel>
      </Group>
    </div>
  )
}

/**
 * `radio` — one-of-many semantics (`aria-checked`), the form the wizard's class
 * step uses. Without `radio` and with `onToggle`, it is a button carrying
 * `aria-pressed` instead.
 */
export function RadioGroup() {
  const classes = SalvageUnionReference.Classes.all().slice(0, 3)
  if (classes.length < 2) return null
  return (
    <div role="radiogroup" aria-label="Pilot class" className="flex max-w-md flex-col gap-3">
      {classes.map((pilotClass, i) => (
        <Sel
          key={pilotClass.name}
          selected={i === 1}
          onToggle={() => {}}
          radio
          ariaLabel={pilotClass.name}
        >
          <ReferenceEntityCard data={pilotClass} size="medium" extent="head" />
        </Sel>
      ))}
    </div>
  )
}
